import React, { useState } from 'react';
import { PlayCircle, FileText, Search, MonitorPlay } from 'lucide-react';
import { sendToBackend } from '../services/apiClient';
import ResponseModal from './ResponseModal';
import './YouTubeOverlay.css';

const YouTubeOverlay = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ voiceText: '', markdownData: '' });

  const handleAction = async (action) => {
    setIsLoading(true);
    
    const context = {
      title: document.title,
      url: window.location.href,
      description: (document.querySelector('meta[name="description"]')?.content || "").substring(0, 1500)
    };

    try {
      const response = await sendToBackend({
        type: 'youtube_action',
        action: action,
        context: context
      });
      setModalData({ 
        voiceText: response.message || '', 
        markdownData: response.data || '' 
      });
      setModalOpen(true);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="youtube-overlay-wrapper">
      <div className="youtube-overlay-header">
        <MonitorPlay className="yt-icon" size={24} />
        <span>Contexto: Video Activo</span>
      </div>
      
      <div className="youtube-buttons-container">
        <button className="glass-button yt-action-btn explain" onClick={() => handleAction('explain')}>
          <div className="icon-wrapper">
            <PlayCircle size={18} />
          </div>
          <span className="btn-text">Resumir video</span>
        </button>

        <button className="glass-button yt-action-btn summarize" onClick={() => handleAction('notes')}>
          <div className="icon-wrapper">
            <FileText size={18} />
          </div>
          <span className="btn-text">Tomar apuntes</span>
        </button>

        <button className="glass-button yt-action-btn investigate" onClick={() => handleAction('expand')}>
          <div className="icon-wrapper">
            <Search size={18} />
          </div>
          <span className="btn-text">Ampliar conceptos</span>
        </button>
      </div>
      <ResponseModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        voiceText={modalData.voiceText} 
        markdownData={modalData.markdownData} 
      />
    </div>
  );
};

export default YouTubeOverlay;
