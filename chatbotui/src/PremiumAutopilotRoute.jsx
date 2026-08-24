import React from 'react';
import OmniRagAutopilotStudio from './OmniRagAutopilotStudio.jsx';
import './autopilot-premium.css';

export default function PremiumAutopilotRoute() {
  return (
    <div className="omnirag-premium-route">
      <div className="omni-premium-orbit" aria-hidden="true" />
      <div className="omni-premium-scanline" aria-hidden="true" />
      <OmniRagAutopilotStudio />
    </div>
  );
}
