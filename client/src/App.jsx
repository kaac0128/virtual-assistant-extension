import React, { useState, useEffect } from 'react';
import { Mic, Send, Loader, Settings as SettingsIcon } from 'lucide-react';
import { sendToBackend, checkConfigStatus } from './services/apiClient';
import Settings from './components/Settings';
import LightRing from './components/LightRing';
import ResponseModal from './components/ResponseModal';
import './index.css';

const App = () => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [assistantState, setAssistantState] = useState('esperando');
  const [errorMessage, setErrorMessage] = useState('');
  
  useEffect(() => {
    const verifyConfig = async () => {
      const localKeys = localStorage.getItem('api_key_groq') || localStorage.getItem('api_key_gemini') || localStorage.getItem('api_key_openrouter');
      const backendStatus = await checkConfigStatus();
      
      if (backendStatus.configured || localKeys) {
        setIsConfigured(true);
      }
      setIsChecking(false);
    };
    verifyConfig();
  }, []);

  const handleSettingsCompleted = () => {
    setIsConfigured(true);
  };

  // Extension popup styles
  const popupStyle = {
    width: '400px',
    height: '500px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-dark)'
  };

  const [popupInput, setPopupInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ voiceText: '', markdownData: '' });
  
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(voice => 
        (voice.name.toLowerCase().includes('female') || 
         voice.name.toLowerCase().includes('femenina') || 
         voice.name.toLowerCase().includes('google español')) && 
        voice.lang.startsWith('es')
      ) || voices.find(v => v.lang.startsWith('es'));
      
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.lang = 'es-ES';
      window.speechSynthesis.speak(utterance);
    }
  };

  const getActiveTabContext = () => {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_PAGE_CONTEXT' }, (response) => {
              if (chrome.runtime.lastError || !response) {
                resolve({});
              } else {
                resolve(response);
              }
            });
          } else {
            resolve({});
          }
        });
      } else {
        resolve({});
      }
    });
  };

  const handleSendApp = async (textOverride = null) => {
    const userMessage = textOverride || popupInput;
    if (!userMessage.trim()) return;
    
    setPopupInput('');
    setAssistantState('pensando');

    try {
      const context = await getActiveTabContext();
      const response = await sendToBackend({ 
        type: 'chat', 
        text: userMessage, 
        context: context 
      });
      
      setModalData({
        voiceText: response.message || '',
        markdownData: response.data || ''
      });
      setModalOpen(true);
      setAssistantState('respondiendo');
      
      if (response && response.message) {
        speakText(response.message);
      }
      
      setTimeout(() => setAssistantState('esperando'), 1000);
    } catch {
      console.error("Content Script Mic Error");
      setAssistantState('error');
      setErrorMessage('Error al conectar con el servidor.');
    }
  };

  const toggleListen = async () => {
    setErrorMessage('');
    if (assistantState === 'escuchando') {
      // STOP recording remotely
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            setAssistantState('pensando');
            chrome.tabs.sendMessage(tabs[0].id, { action: 'STOP_RECORDING' }, (result) => {
              if (result && result.estado === 'ok' && result.transcript) {
                setPopupInput(result.transcript);
                handleSendApp(result.transcript);
                setAssistantState('esperando');
              } else {
                setErrorMessage(result?.message || "Error al detener grabación o transcribir.");
                setAssistantState('esperando');
              }
            });
          }
        });
      }
    } else {
      // START recording remotely
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'START_RECORDING' }, (response) => {
              if (response && response.status === 'ok') {
                setAssistantState('escuchando');
              } else {
                setErrorMessage(response?.message || "La página actual no permite acceso al micrófono.");
                setAssistantState('esperando');
              }
            });
          } else {
            setErrorMessage("No hay una pestaña activa para grabar.");
          }
        });
      } else {
        setErrorMessage("Entorno no compatible con extensiones.");
      }
    }
  };

  if (isChecking) {
    return (
      <div className="va-extension-container" style={{ ...popupStyle, backgroundColor: 'var(--bg-dark)' }}>
        <Loader className="spinner" size={40} style={{ color: 'var(--accent-cyan)', animation: 'va-spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="va-extension-container" style={{ ...popupStyle, backgroundColor: 'var(--bg-dark)' }}>
      {!isConfigured ? (
        <Settings onComplete={handleSettingsCompleted} />
      ) : (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px', width: '100%', padding: '0 20px', position: 'relative' }}>
          <button 
            onClick={() => setIsConfigured(false)}
            style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            title="Configuración de APIs"
          >
            <SettingsIcon size={22} />
          </button>
          
          <LightRing state={assistantState} size={180} />
          <h3 style={{ fontWeight: 500, letterSpacing: '1px', marginTop: '20px', fontSize: '0.8rem' }}>Asistente Activado</h3>
          
          {errorMessage && (
            <div style={{ color: 'var(--accent-pink)', fontSize: '0.75rem', marginTop: '10px', maxWidth: '80%', textAlign: 'center', fontWeight: 500 }}>
              {errorMessage}
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '24px', border: '1px solid var(--border-glass)' }}>
            <button 
              onClick={toggleListen}
              className={`mic-button ${assistantState === 'escuchando' ? 'active-mic' : ''}`}
              style={{
                background: 'transparent',
                color: assistantState === 'escuchando' ? 'var(--accent-pink)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s'
               }}
               title="Hablar por micrófono en la pantalla actual"
            >
              <Mic size={20} />
            </button>
            <input 
              type="text" 
              value={popupInput}
              onChange={(e) => setPopupInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendApp()}
              placeholder="Pregúntame algo..."
              style={{
                flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none'
              }}
            />
            <button onClick={() => handleSendApp()} style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer' }}>
              <Send size={20} />
            </button>
          </div>
          <ResponseModal 
            isOpen={modalOpen} 
            onClose={() => setModalOpen(false)} 
            voiceText={modalData.voiceText} 
            markdownData={modalData.markdownData} 
          />
        </div>
      )}
    </div>
  );
};

export default App;
