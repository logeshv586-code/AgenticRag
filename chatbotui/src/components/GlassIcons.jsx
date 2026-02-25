import React from 'react';
import './GlassIcons.css';
import { Search, Wand2, MessageCircle, Layers, Database, Workflow, Brain, Cpu, Users, Languages, Mic, Book, Shield, ShoppingCart, Briefcase } from 'lucide-react';

const defaultItems = [
  { icon: <Search />, color: '#22d3ee', label: 'Basic RAG' },
  { icon: <Wand2 />, color: '#a78bfa', label: 'Hybrid RAG' },
  { icon: <MessageCircle />, color: '#22c55e', label: 'Conversational' },
  { icon: <Layers />, color: '#f97316', label: 'Multimodal' },
  { icon: <Database />, color: '#fb7185', label: 'Structured' },
  { icon: <Workflow />, color: '#38bdf8', label: 'Graph' },
  { icon: <Brain />, color: '#fde047', label: 'Agentic' },
  { icon: <Cpu />, color: '#60a5fa', label: 'Realtime' },
  { icon: <Users />, color: '#34d399', label: 'Personalized' },
  { icon: <Languages />, color: '#f43f5e', label: 'Cross‑lingual' },
  { icon: <Mic />, color: '#00b4d8', label: 'Voice' },
  { icon: <Book />, color: '#eab308', label: 'Citations' },
  { icon: <Shield />, color: '#64748b', label: 'Guardrails' },
  { icon: <ShoppingCart />, color: '#fb7185', label: 'Sales' },
  { icon: <Briefcase />, color: '#22c55e', label: 'HR' },
];

const GlassIcons = ({ items = defaultItems, className = '', onSelect }) => {
  return (
    <div className={`glass-icons ${className}`}>
      {items.map((it, idx) => (
        <button key={idx} className="glass-icon" onClick={() => onSelect && onSelect(it)}>
          <div className="glass-icon-bg" style={{ backgroundColor: `${it.color}20` }} />
          <div className="glass-icon-blur" />
          <div className="glass-icon-inner" style={{ color: it.color }}>
            <div className="glass-icon-shine" />
            <div className="glass-icon-ring" />
            <div className="glass-icon-content">
              <div className="glass-icon-circle" style={{ borderColor: it.color }}>
                {React.cloneElement(it.icon, { className: 'w-5 h-5' })}
              </div>
              <div className="glass-icon-label">{it.label}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default GlassIcons;
