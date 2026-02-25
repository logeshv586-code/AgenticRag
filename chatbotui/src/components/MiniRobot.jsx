import React from 'react';
import './MiniRobot.css';

const MiniRobot = () => {
  return (
    <div className="chat-avatar-container">
      <div className="mini-robot">
        <div className="mini-robot-head">
          <div className="mini-robot-face">
            <div className="mini-eyes">
              <div className="mini-eye"></div>
              <div className="mini-eye"></div>
            </div>
            <div className="mini-mouth"></div>
          </div>
        </div>
        <div className="mini-robot-body"></div>
      </div>
    </div>
  );
};

export default MiniRobot;
