export const getClientId = async () => {
  let clientId;
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    const result = await new Promise((resolve) =>
      chrome.storage.local.get(["va_client_id"], resolve),
    );
    clientId = result.va_client_id;
    if (!clientId) {
      clientId =
        "client_" +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      chrome.storage.local.set({ va_client_id: clientId });
    }
  } else {
    clientId = localStorage.getItem("va_client_id");
    if (!clientId) {
      clientId =
        "client_" +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      localStorage.setItem("va_client_id", clientId);
    }
  }
  return clientId;
};

export const getApiKeys = async () => {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["api_key_groq", "api_key_gemini", "api_key_openrouter"],
        (result) => {
          resolve({
            groq:
              result.api_key_groq || localStorage.getItem("api_key_groq") || "",
            gemini:
              result.api_key_gemini ||
              localStorage.getItem("api_key_gemini") ||
              "",
            openrouter:
              result.api_key_openrouter ||
              localStorage.getItem("api_key_openrouter") ||
              "",
          });
        },
      );
    });
  } else {
    return {
      groq: localStorage.getItem("api_key_groq") || "",
      gemini: localStorage.getItem("api_key_gemini") || "",
      openrouter: localStorage.getItem("api_key_openrouter") || "",
    };
  }
};

export const saveConfigToBackend = async (keys) => {
  try {
    const clientId = await getClientId();
    const response = await fetch("http://localhost:8000/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        gemini_key: keys.gemini || null,
        groq_key: keys.groq || null,
        openrouter_key: keys.openrouter || null,
      }),
    });
    return await response.json();
  } catch (error) {
    console.error("Error saving config:", error);
    return { estado: "error", message: "No se pudo conectar con el servidor." };
  }
};

export const checkConfigStatus = async () => {
  try {
    const clientId = await getClientId();
    const response = await fetch(
      `http://localhost:8000/api/config/${clientId}`,
    );
    return await response.json();
  } catch (error) {
    console.error("Error checking config:", error);
    return { estado: "error", configured: false };
  }
};

export const sendToBackend = async (data) => {
  try {
    const clientId = await getClientId();
    const keys = await getApiKeys();
    const payload = { ...data, client_id: clientId, keys };
    const response = await fetch("http://localhost:8000/api/assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error de red: código ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error al comunicarse con el backend:", error);
    return {
      estado: "error",
      message:
        "No se pudo conectar con el servidor. Verifica que tu backend en FastAPI esté corriendo.",
      data: {},
    };
  }
};
export const sendVoiceToBackend = async (audioBlob) => {
  try {
    const clientId = await getClientId();
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    const response = await fetch(`http://localhost:8000/api/transcribe?client_id=${clientId}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error de transcripción: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending voice to backend:", error);
    return { estado: "error", message: error.message };
  }
};
