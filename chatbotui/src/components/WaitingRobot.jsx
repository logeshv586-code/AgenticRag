import React from 'react';
import './WaitingRobot.css';

const WaitingRobot = () => {
  return (
    <div className="waiting-robot">
      <div className="waiting-robot-head">
        <div className="waiting-robot-face">
          <div className="waiting-eyes">
            <div className="waiting-eye"></div>
            <div className="waiting-eye"></div>
          </div>
          <div className="waiting-mouth"></div>
        </div>
        <div className="thinking-dots">
          <div className="thinking-dot"></div>
          <div className="thinking-dot"></div>
          <div className="thinking-dot"></div>
        </div>
      </div>
      <div className="waiting-robot-body"></div>
    </div>
  );
};

export default WaitingRobot;
