import React, { useState, useEffect, useRef } from 'react';
import { Send, Settings as SettingsIcon, Maximize2, Mic, Copy, Volume2, VolumeX, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import LightRing from './LightRing';
import { sendToBackend, sendVoiceToBackend } from '../services/apiClient';
import './ChatBubble.css';

const ChatBubble = ({ onOpenSettings, listenTrigger }) => {
  const [inputText, setInputText] = useState('');
  const [assistantState, setAssistantState] = useState('esperando'); 
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hola! Soy tu asistente virtual. ¿En qué te puedo ayudar hoy?' }
  ]);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    // Setup background audio
    if (!window.bgAudio) {
      window.bgAudio = new Audio('https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3');
      window.bgAudio.loop = true;
      window.bgAudio.volume = 0.5;
    }
  }, []);

  const getPageSummary = () => {
    // Get visible text and clean it up
    const bodyText = document.body.innerText || "";
    const cleanText = bodyText
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!¡?¿áéíóúÁÉÍÓÚñÑ]/g, '')
      .substring(0, 3000); 
    return cleanText;
  };

  const speakText = (text) => {
    if (isMuted) return;
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
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (textToSend = inputText) => {
    const userMessage = typeof textToSend === 'string' ? textToSend : inputText;
    if (!userMessage.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    if (userMessage === inputText) setInputText('');
    setAssistantState('pensando');

    try {
      const context = {
        title: document.title,
        url: window.location.href,
        description: (document.querySelector('meta[name="description"]')?.content || "").substring(0, 1000),
        pageText: getPageSummary()
      };
      const response = await sendToBackend({ type: 'chat', text: userMessage, context: context });
      const assistantMessage = response.message;
      const markdownData = response.data;
      const action = response.action;
      
      setMessages(prev => [...prev, { role: 'assistant', text: assistantMessage, data: markdownData }]);
      setAssistantState('respondiendo');
      speakText(assistantMessage);

      if (action === 'PLAY_MUSIC') {
        window.bgAudio?.play();
      } else if (action === 'PAUSE_MUSIC') {
        window.bgAudio?.pause();
      }
      
      setTimeout(() => {
        setAssistantState('esperando');
      }, 1000);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', text: 'Hubo un error de conexión.' }]);
      setAssistantState('esperando');
    }
  };

  const toggleListen = async () => {
    if (assistantState === 'escuchando') {
      mediaRecorderRef.current?.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          setAssistantState('pensando');
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const result = await sendVoiceToBackend(audioBlob);
          
          if (result.estado === 'ok' && result.transcript) {
            setInputText(result.transcript);
            handleSend(result.transcript);
          } else if (result.estado === 'error') {
            alert(result.message || "Error al transcribir voz.");
          }
          setAssistantState('esperando');
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setAssistantState('escuchando');
      } catch (err) {
        console.error("Mic permission denied:", err);
        setAssistantState('esperando');
        alert('Debes conceder permisos de micrófono para usar la voz.');
      }
    }
  };

  useEffect(() => {
    if (listenTrigger > 0 && assistantState === 'esperando') {
      // Usar un microtask o timeout para evitar el error de renderizado en cascada
      setTimeout(() => {
        toggleListen();
      }, 0);
    }
  }, [listenTrigger]); 

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, assistantState]);



  const handleDownloadMd = (text, data, index) => {
    const fullContent = `# Apuntes - ${document.title}\n\n${text}\n\n${data || ""}`;
    const blob = new Blob([fullContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apuntes_asistente_${index}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };



  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="chat-bubble-container glass-panel">
      <div className="chat-header">
        <button className="icon-button" onClick={onOpenSettings} title="Configuración">
          <SettingsIcon size={16} />
        </button>
        <div className="light-ring-wrapper" title="Estado">
          <LightRing state={assistantState} size={45} />
        </div>
        <button 
          className="icon-button" 
          onClick={() => {
            setIsMuted(!isMuted);
            if (!isMuted && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
          }} 
          title={isMuted ? "Activar Voz" : "Silenciar Voz"}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-content">
              {msg.text}
              {msg.data && (
                <div className="markdown-box">
                  <ReactMarkdown>{msg.data}</ReactMarkdown>
                </div>
              )}
              {msg.role === 'assistant' && (
                <div className="message-actions">
                  <button 
                    className="action-button" 
                    onClick={() => handleCopy(msg.text + (msg.data ? '\n\n' + msg.data : ''), idx)}
                    title="Copiar texto"
                  >
                    {copiedIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button 
                    className="action-button" 
                    onClick={() => handleDownloadMd(msg.text, msg.data, idx)}
                    title="Descargar MD"
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {assistantState === 'pensando' && (
          <div className="message assistant thinking-message">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-suggestions">
        <button className="suggestion-chip" onClick={() => handleSend('Tomar apuntes')}>Tomar apuntes</button>
        <button className="suggestion-chip" onClick={() => handleSend('Explicar contenido de la página')}>Explicar contenido de la página</button>
        <button className="suggestion-chip" onClick={() => handleSend('Ampliar conceptos')}>Ampliar conceptos</button>
      </div>

      <div className="chat-input-area">
        <div className="input-wrapper">
          <button 
            className={`icon-button mic-button ${assistantState === 'escuchando' ? 'active-mic' : ''}`}
            onClick={toggleListen}
            title="Dictar por voz"
          >
            <Mic size={18} />
          </button>
          <input 
            type="text" 
            placeholder="Pregúntame algo..." 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="glass-input"
          />
          <button className="icon-button send-button" onClick={handleSend} title="Enviar">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
