import json
import datetime
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from tools import get_all_tools, search_internet

def get_llm(user_config):
    # Inicializa el motor que tenga disponible
    if user_config.get("gemini_key"):
        return ChatGoogleGenerativeAI(api_key=user_config["gemini_key"], model="gemini-2.5-flash")
    elif user_config.get("groq_key"):
        # Llama 3 70B tiene capacidades de razonamiento/tools buenas
        return ChatGroq(api_key=user_config["groq_key"], model_name="llama-3.3-70b-versatile")
    elif user_config.get("openrouter_key"):
        return ChatOpenAI(api_key=user_config["openrouter_key"], base_url="https://openrouter.ai/api/v1", model="meta-llama/llama-3-8b-instruct:free")
    return None

def execute_agent(client_id, request_data, db):
    user_config = db.get(client_id, {})
    llm = get_llm(user_config)
    
    if not llm:
        return {
            "estado": "error",
            "message": "Falta configurar firmemente las API Keys.",
            "data": "",
            "action": None
        }
        
    tools = get_all_tools()
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Eres VOIDRA, un asistente de Inteligencia Artificial avanzado con un diseño futurista y eficiente.
Tu objetivo es ayudar al usuario analizando el contexto de la página actual (especialmente si es YouTube) y ejecutando tareas complejas.

Si el usuario solicita acciones como 'Explicar', 'Apuntes' o 'Ampliar' sobre un video de YouTube, utiliza el título y la descripción proporcionados para generar contenido de alta calidad.

IMPORTANTE: Tu respuesta DEBE ser SIEMPRE un bloque JSON puro al final de tu razonamiento (o solo el JSON).
Schema:
```json
{{
  "voice_text": "Breve resumen hablado (2-3 frases) para el usuario.",
  "markdown_data": "Contenido extenso y detallado en Markdown (explicaciones, apuntes, tablas, código, etc.).",
  "action": null
}}
```
Si usas una herramienta, el estado se reflejará en 'action'.
"""),
        ("human", "Contexto/Petición Actual:\n{input}")
    ])
    
    # Organizar el Request
    req_type = request_data.type
    req_text = request_data.text or ""
    req_action = request_data.action or ""
    req_context = request_data.context or {}
    
    page_context = f"Título de la Página: {req_context.get('title', 'N/A')}\nURL: {req_context.get('url', 'N/A')}\nMeta Descripción: {req_context.get('description', 'N/A')}\nContenido de la Página: {req_context.get('pageText', 'No se pudo obtener el texto de la página.')}\n"
    
    if req_type == "youtube_action":
        if req_action == "explain":
            final_query = f"{page_context}\n[INSTRUCCIÓN VITAL]: Actúa como profesor experto. Analiza el contenido de la página/video y explícame de qué trata con detalle. Redacta una explicación completa en 'markdown_data' y preséntala amigablemente en 'voice_text'."
        elif req_action == "notes":
            final_query = f"{page_context}\n[INSTRUCCIÓN VITAL]: Quiero que me tomes Apuntes super detallados, estructurados y limpios del contenido actual en 'markdown_data'. En 'voice_text' dime que ya tomaste los apuntes principales."
        elif req_action == "expand":
            final_query = f"{page_context}\n[INSTRUCCIÓN VITAL]: Amplía drásticamente la información mostrada. Busca conceptos relacionados o profundiza en lo que la página menciona. Usa 'markdown_data' para el contenido extenso."
    else:
        # Modo chat
        hist = "\n".join([f"- {h['query']} -> {h['summary'][:50]}" for h in user_config.get("history", [])[-4:]])
        final_query = f"[Historial de Sesión]:\n{hist}\n\n[Contexto Actual de la Página]:\n{page_context}\n\n[Instrucción del Usuario]: {req_text}\nAnaliza la petición. Si te pide algo sobre la página, usa el contexto que te pasé. Genera tu respuesta en el formato JSON requerido."

    try:
        # Binding de las herramientas de Python directas
        llm_with_tools = llm.bind_tools(tools)
        chain = prompt | llm_with_tools
        completion = chain.invoke({"input": final_query})
        
        # Tool execution routine pseudo-agent
        tool_action_payload = None
        if hasattr(completion, "tool_calls") and getattr(completion, "tool_calls"):
            tool_call = completion.tool_calls[0]
            name = tool_call["name"]
            args = tool_call["args"]
            
            if name == "control_music":
                res = control_music.invoke(args)
                if res == "SUCCESS_PLAY_MUSIC": tool_action_payload = "PLAY_MUSIC"
                elif res == "SUCCESS_PAUSE_MUSIC": tool_action_payload = "PAUSE_MUSIC"
                # Volver a pasarle al llm que ya se hizo
                final_query += f"\n\n[Sistema: Ejecutó música exitosamente. Termina de responder con json vacio de datos o el voice confirmando.]"
                completion = chain.invoke({"input": final_query})
            elif name == "get_weather":
                w = get_weather.invoke(args)
                final_query += f"\n\n[Resultados CLI Clima: {w}. Genera ahora tu respuesta final json usando esta información]."
                completion = chain.invoke({"input": final_query})
            elif name == "translate_text":
                t = translate_text.invoke(args)
                final_query += f"\n\n[Resultados Traducción: {t}. Entrégaselo al usuario json format]."
                completion = chain.invoke({"input": final_query})
            elif name == "search_internet":
                s = search_internet.invoke(args)
                final_query += f"\n\n[Resultados de búsqueda en Internet: {s}. Utiliza esta información para ampliar tu respuesta y entrégala en formato JSON]."
                completion = chain.invoke({"input": final_query})
                
        # Parse output JSON for React frontend
        raw_content = completion.content
        if isinstance(raw_content, list):
            raw_content = raw_content[0].get("text", "")
            
        if "```json" in raw_content:
            raw_content = raw_content.split("```json")[-1].split("```")[0]
        print(raw_content)
        parsed_json = json.loads(raw_content.strip())
        
        if tool_action_payload:
            parsed_json["action"] = tool_action_payload
            
        user_config.setdefault("history", []).append({
            "date": str(datetime.datetime.now().time()),
            "query": req_text or req_action,
            "summary": parsed_json.get("voice_text", "Done.")
        })
        db[client_id] = user_config
        
        return {
            "estado": "ok",
            "message": parsed_json.get("voice_text", ""),
            "data": parsed_json.get("markdown_data", ""),
            "action": parsed_json.get("action", None)
        }
    except Exception as e:
        print("AGENT EXCEPTION CRITICAL:", e)
        # Attempt fallback to simple LLM without tools if tool invocation strictly failed
        return {
            "estado": "error",
            "message": "Se me cruzaron los cables calculando, reintenta.",
            "data": str(e),
            "action": None
        }
