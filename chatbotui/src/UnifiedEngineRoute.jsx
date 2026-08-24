import React from 'react';
import App from './App.jsx';
import GlobalRagAutopilot from './GlobalRagAutopilot.jsx';

export default function UnifiedEngineRoute() {
  return (
    <div className="relative min-h-screen bg-[#020508]">
      <App />
      <GlobalRagAutopilot />
    </div>
  );
}
