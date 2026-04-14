import React from 'react';
import ReactDOM from 'react-dom/client';
import ContentApp from './ContentApp';

// We import the same CSS so the injected elements look correct
// NOTE: When running Vite dev server this won't inject automatically,
// but works correctly for the production build if manifest.json is right.
import './index.css';

// Create a container for our React app on the webpage
const appContainer = document.createElement('div');
appContainer.id = 'virtual-assistant-extension-root';
document.body.appendChild(appContainer);

const root = ReactDOM.createRoot(appContainer);
root.render(
  <React.StrictMode>
    <ContentApp />
  </React.StrictMode>
);
