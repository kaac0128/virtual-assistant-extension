import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X, Copy, Check } from 'lucide-react';
import './ResponseModal.css';

const ResponseModal = ({ isOpen, onClose, markdownData, voiceText }) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    const textToCopy = voiceText + (markdownData ? '\n\n' + markdownData : '');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="va-response-modal-backdrop" onClick={onClose}>
      <div className="va-response-modal-content glass-panel" onClick={e => e.stopPropagation()}>
        <div className="va-response-modal-header">
          <h3>Respuesta del Asistente</h3>
          <div className="va-modal-actions">
            <button className="icon-button" onClick={handleCopy} title="Copiar texto" style={{ color: "var(--accent-cyan)", background: "transparent", border: "none", cursor: "pointer"}}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
            <button className="icon-button" onClick={onClose} title="Cerrar" style={{ color: "var(--text-secondary)", background: "transparent", border: "none", cursor: "pointer"}}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="va-response-modal-body">
          {voiceText && <div className="va-voice-text">{voiceText}</div>}
          {markdownData && (
            <div className="va-markdown-data markdown-box">
              <ReactMarkdown>{markdownData}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponseModal;
