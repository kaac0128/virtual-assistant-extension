from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
import os

app = FastAPI(title="Virtual Assistant API")

# Configurar CORS para permitir peticiones desde cualquier origen (la extensión)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "db.json"

def load_db():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_db(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

class ApiKeysConfig(BaseModel):
    client_id: str
    gemini_key: Optional[str] = None
    groq_key: Optional[str] = None
    openrouter_key: Optional[str] = None

@app.post("/api/config")
async def save_config(config: ApiKeysConfig):
    db = load_db()
    db[config.client_id] = {
        "gemini_key": config.gemini_key,
        "groq_key": config.groq_key,
        "openrouter_key": config.openrouter_key
    }
    save_db(db)
    return {"estado": "ok", "message": "Claves guardadas exitosamente"}

@app.get("/api/config/{client_id}")
async def get_config_status(client_id: str):
    db = load_db()
    user_config = db.get(client_id, {})
    has_keys = bool(user_config.get("gemini_key") or user_config.get("groq_key") or user_config.get("openrouter_key"))
    return {"estado": "ok", "configured": has_keys}

class AssistantRequest(BaseModel):
    client_id: str
    type: str  # "youtube_action" o "chat"
    action: Optional[str] = None
    text: Optional[str] = None
    context: Optional[dict] = None
    keys: Optional[dict] = None

@app.post("/api/assistant")
async def handle_assistant_request(request: AssistantRequest):
    print(f"Recibida petición del cliente {request.client_id}: {request.type}")
    
    db = load_db()
    
    # Asegurarnos de que el cliente exista
    if request.client_id not in db:
        db[request.client_id] = {}
        
    # Guardar dinámicamente las llaves desde la solicitud del Frontend
    if request.keys:
        if request.keys.get("gemini"): db[request.client_id]["gemini_key"] = request.keys.get("gemini")
        if request.keys.get("groq"): db[request.client_id]["groq_key"] = request.keys.get("groq")
        if request.keys.get("openrouter"): db[request.client_id]["openrouter_key"] = request.keys.get("openrouter")
    
    from agent import execute_agent
    
    result = execute_agent(request.client_id, request, db)
    
    # El agent ya actualiza db en memoria, persistimos.
    save_db(db)
    
    return result

# Transcription endpoint using Groq
from fastapi import UploadFile, File

@app.post("/api/transcribe")
async def transcribe_audio(client_id: str, file: UploadFile = File(...)):
    db = load_db()
    user_config = db.get(client_id, {})
    groq_key = user_config.get("groq_key")
    
    if not groq_key:
        return {"estado": "error", "message": "Se requiere una Groq Key para la transcripción de voz avanzada."}
    
    try:
        import httpx
        # Save temporary file
        temp_filename = f"temp_{client_id}.webm"
        with open(temp_filename, "wb") as f:
            f.write(await file.read())
            
        # Call Groq Whisper API
        async with httpx.AsyncClient() as client:
            with open(temp_filename, "rb") as audio_file:
                response = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {groq_key}"},
                    files={"file": (temp_filename, audio_file)},
                    data={"model": "whisper-large-v3", "language": "es"}
                )
        
        os.remove(temp_filename)
        res_json = response.json()
        return {"estado": "ok", "transcript": res_json.get("text", "")}
    except Exception as e:
        print("Transcription error:", e)
        return {"estado": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
