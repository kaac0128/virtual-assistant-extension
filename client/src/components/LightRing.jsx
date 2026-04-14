import React from 'react';
import './LightRing.css';

const LightRing = ({ state = 'esperando', size = 150 }) => {
  // state can be: "esperando", "escuchando", "pensando", "respondiendo"
  
  const getContainerStyle = () => {
    return {
      width: `${size}px`,
      height: `${size}px`,
    };
  };

  return (
    <div className={`light-ring-container state-${state}`} style={getContainerStyle()}>
      <div className="ring ring-outer"></div>
      <div className="ring ring-inner"></div>
      <div className="core-glow"></div>
      
      {size > 60 && (
        <div className="state-label">
          {state.charAt(0).toUpperCase() + state.slice(1)}...
        </div>
      )}
    </div>
  );
};

export default LightRing;
