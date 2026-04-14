import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ChatBubble from './components/ChatBubble';
import YouTubeOverlay from './components/YouTubeOverlay';
import { sendVoiceToBackend } from './services/apiClient';

const ContentApp = () => {
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [ytNativeTarget, setYtNativeTarget] = useState(null);
  const [listenTrigger, setListenTrigger] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    // A robust watcher for YouTube SPA navigations
    let observer;
    
    const checkYouTubeDOM = () => {
      if (!window.location.hostname.includes('youtube.com')) return;
      if (!window.location.pathname.includes('/watch')) return;
      
      const bottomRow = document.querySelector('ytd-watch-metadata #bottom-row');
      const description = document.querySelector('ytd-watch-metadata #description');
      
      if (bottomRow && description && !document.getElementById('va-yt-native-container')) {
        const container = document.createElement('div');
        container.id = 'va-yt-native-container';
        container.className = 'va-extension-container';
        bottomRow.insertBefore(container, description);
        setYtNativeTarget(container);
      }
    };

    const intervalId = setInterval(checkYouTubeDOM, 1000);
    
    const startRemoteRecording = async (sendResponse) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const options = { mimeType: 'audio/webm;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'audio/webm';
        }
        
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.start(200);
        sendResponse({ status: "ok", message: "Recording started in page" });
      } catch (err) {
        console.error("Content Script Mic Error:", err);
        sendResponse({ status: "error", message: "Microphone permission denied on this page." });
      }
    };

    const stopRemoteRecording = async (sendResponse) => {
      if (!mediaRecorderRef.current) {
        sendResponse({ status: "error", message: "No active recording" });
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          const result = await sendVoiceToBackend(audioBlob);
          sendResponse(result);
        } catch (err) {
          sendResponse({ status: "error", message: "Transcription failed" });
        }
        // Cleanup stream
        const tracks = mediaRecorderRef.current.stream.getTracks();
        tracks.forEach(t => t.stop());
        mediaRecorderRef.current = null;
      };

      mediaRecorderRef.current.stop();
    };
    
    const handleMessage = (request, sender, sendResponse) => {
      if (request.action === 'OPEN_AND_LISTEN') {
        setBubbleOpen(true);
        setListenTrigger(prev => prev + 1);
        sendResponse({status: "ok"});
      } else if (request.action === 'GET_PAGE_CONTEXT') {
        const bodyText = document.body.innerText || "";
        const cleanText = bodyText
          .replace(/\s+/g, ' ')
          .replace(/[^\w\s.,!¡?¿áéíóúÁÉÍÓÚñÑ]/g, '')
          .substring(0, 3000);

        sendResponse({
          title: document.title,
          url: window.location.href,
          description: (document.querySelector('meta[name="description"]')?.content || "").substring(0, 1000),
          pageText: cleanText
        });
      } else if (request.action === 'START_RECORDING') {
        startRemoteRecording(sendResponse);
        return true; 
      } else if (request.action === 'STOP_RECORDING') {
        stopRemoteRecording(sendResponse);
        return true;
      }
      return true;
    };
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(handleMessage);
    }
    
    return () => {
      clearInterval(intervalId);
      if (observer) observer.disconnect();
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(handleMessage);
      }
    };
  }, []);

  const floatingBtnStyle = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '55px',
    height: '55px',
    borderRadius: '50%',
    background: 'rgba(20, 20, 23, 0.98)', /* Less transparent */
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0, 242, 254, 0.4)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    zIndex: 2147483647,
    boxShadow: '0 4px 15px rgba(0,242,254,0.4)',
    color: 'var(--accent-cyan)'
  };

  const bubbleContainerStyle = {
    position: 'fixed',
    bottom: '90px',
    right: '20px',
    zIndex: 2147483647,
  };

  return (
    <div className="va-extension-container">
      {/* Floating Toggle Button everywhere */}
      <div 
        style={floatingBtnStyle} 
        onClick={() => setBubbleOpen(!bubbleOpen)}
        title="Abrir Asistente Virtual"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>

      {/* Floating Chat Bubble */}
      {bubbleOpen && (
        <div style={bubbleContainerStyle}>
          <ChatBubble listenTrigger={listenTrigger} onOpenSettings={() => {
            alert("Ve a la barra de extensiones arriba a la derecha y abre el asistente para configurar tus API Keys.");
          }} />
        </div>
      )}

      {/* YouTube Specific Buttons (Injected via Portal into YouTube DOM) */}
      {ytNativeTarget && createPortal(
        <div style={{ width: '100%', marginBottom: '16px' }}>
          <YouTubeOverlay />
        </div>,
        ytNativeTarget
      )}
    </div>
  );
};

export default ContentApp;
