import React from 'react';
import './Robot3D.css';

const Robot3D = ({ onClick, notificationCount = 0 }) => {
  return (
    <div className="robot-wrapper" onClick={onClick}>
      <div className="robot">
        <div className="robot-head">
          <div className="robot-antenna">
            <div className="antenna-ball"></div>
          </div>
          <div className="robot-face">
            <div className="robot-eyes">
              <div className="eye"></div>
              <div className="eye"></div>
            </div>
            <div className="robot-mouth"></div>
          </div>
        </div>
        <div className="robot-body">
          <div className="robot-arms">
            <div className="arm arm-left">
              <div className="hand"></div>
            </div>
            <div className="arm arm-right">
              <div className="hand"></div>
            </div>
          </div>
        </div>
        {notificationCount > 0 && (
          <div className="notification-bubble">{notificationCount}</div>
        )}
      </div>
    </div>
  );
};

export default Robot3D;
