import json
from langchain_core.tools import tool

@tool
def search_internet(query: str) -> str:
    """Útil para investigar, ampliar información, buscar en internet sobre un tema o responder preguntas que requieren datos actualizados.
    - query: El termino de busqueda o pregunta a investigar.
    """
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = [r for r in ddgs.text(query, max_results=4)]
            if not results:
                return "No se encontraron resultados en internet para esa búsqueda."
            
            res_str = ""
            for i, r in enumerate(results):
                res_str += f"\n[{i+1}] {r['title']}\n{r['body']}\nFuente: {r['href']}\n"
            return res_str
    except Exception as e:
        return f"Error al buscar en internet: {str(e)}"

def get_all_tools():
    return [search_internet]
