import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import StandaloneChat from './StandaloneChat.jsx'
import CustomerRagStudio from './CustomerRagStudio.jsx'
import ChatRagStudio from './ChatRagStudio.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatRagStudio />} />
        <Route path="/starter" element={<CustomerRagStudio />} />
        <Route path="/advanced" element={<App />} />
        <Route path="/chat/:pipelineId" element={<StandaloneChat />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)