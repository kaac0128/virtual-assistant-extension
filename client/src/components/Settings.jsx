import React, { useState, useEffect } from 'react';
import { Key, Check, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import { saveConfigToBackend } from '../services/apiClient';
import './Settings.css';

const Settings = ({ onComplete }) => {
  const [keys, setKeys] = useState({
    groq: '',
    gemini: '',
    openrouter: ''
  });
  
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['api_key_groq', 'api_key_gemini', 'api_key_openrouter'], (result) => {
        setKeys({
          groq: result.api_key_groq || localStorage.getItem('api_key_groq') || '',
          gemini: result.api_key_gemini || localStorage.getItem('api_key_gemini') || '',
          openrouter: result.api_key_openrouter || localStorage.getItem('api_key_openrouter') || ''
        });
      });
    } else {
      const savedGroq = localStorage.getItem('api_key_groq') || '';
      const savedGemini = localStorage.getItem('api_key_gemini') || '';
      const savedOpenRouter = localStorage.getItem('api_key_openrouter') || '';
      
      setKeys({ groq: savedGroq, gemini: savedGemini, openrouter: savedOpenRouter });
    }
  }, []);

  const handleChange = (e) => {
    setKeys({ ...keys, [e.target.name]: e.target.value });
    setError(''); // clear error when user types
  };

  const handleSave = async () => {
    if (!keys.groq && !keys.gemini && !keys.openrouter) {
      setError('Por favor, ingresa al menos una API Key para continuar.');
      return;
    }
    
    // Guardar en el backend primero
    const res = await saveConfigToBackend(keys);
    if (res.estado === 'error') {
      setError(res.message || 'Error guardando en el servidor: Asegúrate que FastAPI está corriendo.');
      return;
    }
    
    // Guardar localmente
    localStorage.setItem('api_key_groq', keys.groq);
    localStorage.setItem('api_key_gemini', keys.gemini);
    localStorage.setItem('api_key_openrouter', keys.openrouter);
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        'api_key_groq': keys.groq,
        'api_key_gemini': keys.gemini,
        'api_key_openrouter': keys.openrouter
      });
    }
    
    onComplete();
  };

  return (
    <div className="settings-wrapper glass-panel">
      <div className="settings-header">
        <div className="icon-pulse">
          <SettingsIcon size={28} className="text-accent" />
        </div>
        <h2>Configuración Inicial</h2>
        <p>Configura al menos un proveedor de IA para activar el asistente.</p>
      </div>

      <div className="settings-form">
        <div className="input-group">
          <label>
            <span className="provider-name groq">Groq</span> API Key
          </label>
          <div className="input-wrapper">
            <Key size={18} className="input-icon" />
            <input 
              type="password" 
              name="groq"
              placeholder="gsk_..." 
              value={keys.groq}
              onChange={handleChange}
              className="glass-input"
            />
            {keys.groq && <Check size={18} className="success-icon" />}
          </div>
        </div>

        <div className="input-group">
          <label>
            <span className="provider-name gemini">Gemini</span> API Key
          </label>
          <div className="input-wrapper">
            <Key size={18} className="input-icon" />
            <input 
              type="password" 
              name="gemini"
              placeholder="AIzaSy..." 
              value={keys.gemini}
              onChange={handleChange}
              className="glass-input"
            />
            {keys.gemini && <Check size={18} className="success-icon" />}
          </div>
        </div>

        <div className="input-group">
          <label>
            <span className="provider-name openrouter">OpenRouter</span> API Key
          </label>
          <div className="input-wrapper">
            <Key size={18} className="input-icon" />
            <input 
              type="password" 
              name="openrouter"
              placeholder="sk-or-v1-..." 
              value={keys.openrouter}
              onChange={handleChange}
              className="glass-input"
            />
            {keys.openrouter && <Check size={18} className="success-icon" />}
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="settings-footer">
        <button className="glass-button active settings-save-btn" onClick={handleSave}>
          Comenzar <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default Settings;
