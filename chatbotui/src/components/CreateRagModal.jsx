import React, { useState } from 'react';
import { Bot, Link as LinkIcon, Upload, Database, LayoutTemplate, Palette, X, ChevronRight, Check } from 'lucide-react';

const RAG_TYPES = [
  { id: 'agentic', name: 'Agentic RAG' },
  { id: 'hybrid', name: 'Hybrid RAG' },
  { id: 'conversational', name: 'Conversational RAG' },
  { id: 'multimodal', name: 'Multimodal RAG' },
];

const USE_CASES = [
  { id: 'faq', name: 'FAQ Bot' },
  { id: 'support', name: 'Customer Support' },
  { id: 'sales', name: 'Sales Assistant' },
  { id: 'hr', name: 'HR / Internal' },
];

const VECTORDBS = [
  { id: 'pinecone', name: 'Pinecone' },
  { id: 'milvus', name: 'Milvus' },
  { id: 'weaviate', name: 'Weaviate' },
];

const THEMES = [
  { id: 'cyan', name: 'Cyber Cyan', hue: 0, color: '#22d3ee' },
  { id: 'pink', name: 'Neon Pink', hue: 300, color: '#ff2e93' },
  { id: 'emerald', name: 'Emerald', hue: 120, color: '#10b981' },
  { id: 'violet', name: 'Deep Violet', hue: 250, color: '#8b5cf6' },
  { id: 'gold', name: 'Luxury Gold', hue: 45, color: '#fbbf24' },
];

export default function CreateRagModal({ isOpen, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    urls: [''],
    ragType: 'agentic',
    useCase: 'faq',
    vectorDb: 'pinecone',
    theme: THEMES[0].id
  });

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else {
      const selectedTheme = THEMES.find(t => t.id === config.theme);
      onComplete({ ...config, themeHue: selectedTheme.hue });
      setStep(1); // Reset
    }
  };

  const updateConfig = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  const addUrl = () => {
    setConfig(prev => ({ ...prev, urls: [...prev.urls, ''] }));
  };

  const updateUrl = (i, val) => {
    const nextUrls = [...config.urls];
    nextUrls[i] = val;
    setConfig(prev => ({ ...prev, urls: nextUrls }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in backdrop-blur-sm bg-black/50">
      <div className="absolute inset-0 bg-zinc-950/80" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[#0b0b0e] border border-cyan-500/20 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/10 flex flex-col h-[600px] animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                Deploy Agentic RAG
              </h2>
              <div className="text-xs text-zinc-500 font-medium">Step {step} of 3</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800">
          
          {step === 1 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <LinkIcon className="w-5 h-5 text-cyan-400" />
                   Connect Data Sources
                </h3>
                <p className="text-sm text-zinc-400 mb-4">
                  Provide URLs to scrape. We will automatically embed and index this data.
                </p>
                <div className="space-y-3">
                  {config.urls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                       <input 
                         type="text" 
                         value={url}
                         onChange={(e) => updateUrl(i, e.target.value)}
                         placeholder="https://example.com/docs"
                         className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition"
                       />
                    </div>
                  ))}
                  <button onClick={addUrl} className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition flex items-center gap-1 mt-2">
                    + Add another URL
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Upload className="w-5 h-5 text-cyan-400" />
                   File Upload
                </h3>
                <div className="border-2 border-dashed border-zinc-800 hover:border-cyan-500/30 bg-zinc-900/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-cyan-500/20 flex items-center justify-center mb-3 transition">
                    <Upload className="w-6 h-6 text-zinc-400 group-hover:text-cyan-400 transition" />
                  </div>
                  <span className="text-sm font-medium text-white mb-1">Click to upload or drag and drop</span>
                  <span className="text-xs text-zinc-500">PDF, TXT, DOCX, CSV (max. 50MB)</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <LayoutTemplate className="w-5 h-5 text-cyan-400" />
                   RAG Architecture & Persona
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {RAG_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => updateConfig('ragType', type.id)}
                      className={`p-4 rounded-xl border text-left transition ${config.ragType === type.id ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/50' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
                    >
                      <div className="font-medium text-white text-sm flex justify-between">
                        {type.name}
                        {config.ragType === type.id && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="text-sm font-medium text-zinc-400 mb-3">Target Persona</div>
                <div className="grid grid-cols-2 gap-3">
                  {USE_CASES.map(use => (
                    <button
                      key={use.id}
                      onClick={() => updateConfig('useCase', use.id)}
                      className={`p-3 rounded-xl border text-left transition ${config.useCase === use.id ? 'bg-white/10 border-white/30 text-white' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'}`}
                    >
                      <span className="text-sm">{use.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Database className="w-5 h-5 text-cyan-400" />
                   Vector Database
                </h3>
                <div className="flex gap-3">
                  {VECTORDBS.map(db => (
                    <button
                      key={db.id}
                      onClick={() => updateConfig('vectorDb', db.id)}
                      className={`flex-1 py-3 px-4 rounded-xl border text-center transition ${config.vectorDb === db.id ? 'bg-[#1e1e1e] border-zinc-600 text-white' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <span className="text-sm font-medium">{db.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-fade-in h-full flex flex-col justify-center">
              <div className="text-center mb-8">
                <Palette className="w-12 h-12 text-cyan-400 mx-auto mb-4 opacity-80" />
                <h3 className="text-2xl font-bold text-white mb-2">
                   Brand Your Assistant
                </h3>
                <p className="text-sm text-zinc-400 max-w-sm mx-auto">
                  Select a thematic color that fits your enterprise's visual identity.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {THEMES.map(theme => {
                  const isSelected = config.theme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => updateConfig('theme', theme.id)}
                      className={`flex flex-col items-center p-4 rounded-2xl border transition group ${isSelected ? 'bg-white/5 border-white ring-2 ring-white/20 scale-105' : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'}`}
                    >
                      <div 
                        className={`w-12 h-12 rounded-full mb-3 shadow-lg transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}
                        style={{ backgroundColor: theme.color, boxShadow: `0 0 20px ${theme.color}66` }}
                      />
                      <span className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                        {theme.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-zinc-950 flex items-center justify-between">
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${step >= i ? 'w-8 bg-cyan-400' : 'w-4 bg-zinc-800'}`} />
            ))}
          </div>
          <button 
            onClick={handleNext}
            className="px-6 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-black font-semibold rounded-full flex items-center gap-2 transition hover:scale-105 active:scale-95"
          >
            {step === 3 ? 'Deploy RAG' : 'Next Step'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
