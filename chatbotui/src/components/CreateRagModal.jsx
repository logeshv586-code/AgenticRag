import React, { useState } from 'react';
import { Bot, Link as LinkIcon, Upload, Database, LayoutTemplate, Palette, X, ChevronRight, Check, Settings2, Globe, Server, Code, Terminal, MessageSquare, Play } from 'lucide-react';
import RagVisualizer from './RagVisualizer';
import RagChatTester from './RagChatTester';

const RAG_TYPES = [
  { id: 'agentic', name: 'Agentic RAG', desc: 'Uses tools and reasoning logic.' },
  { id: 'hybrid', name: 'Hybrid RAG', desc: 'Combines dense + sparse retrieval.' },
  { id: 'conversational', name: 'Conversational RAG', desc: 'Maintains long-term chat history.' },
  { id: 'basic', name: 'Basic Semantic RAG', desc: 'Standard vector similarity search.' },
];

const USE_CASES = [
  { id: 'faq', name: 'FAQ Bot' },
  { id: 'support', name: 'Customer Support' },
  { id: 'sales', name: 'Sales Assistant' },
  { id: 'hr', name: 'HR / Internal Docs' },
];

const VECTORDBS = [
  { id: 'pinecone', name: 'Pinecone' },
  { id: 'chroma', name: 'ChromaDB' },
  { id: 'inmemory', name: 'In-Memory Store' },
];

const FEATURES = [
  { id: 'multilingual', name: 'Multi-lingual Support' },
  { id: 'citations', name: 'Source Citations' },
  { id: 'sentiment', name: 'Sentiment Analysis' },
  { id: 'voice', name: 'Voice Interaction Ready' },
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
    files: [],
    ragType: 'agentic',
    useCase: 'faq',
    vectorDb: 'pinecone',
    features: [],
    theme: THEMES[0].id,
    deploymentType: 'api'
  });
  const [deployData, setDeployData] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);

  if (!isOpen) return null;

  const totalSteps = 9;

  const handleNext = async () => {
    if (step === 7) {
      await handleDeploy();
    } else if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Final Finish
      const selectedTheme = THEMES.find(t => t.id === config.theme);
      onComplete({ ...config, themeHue: selectedTheme.hue, deployData });
    }
  };

  const updateConfig = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  const toggleFeature = (featId) => {
    setConfig(prev => {
      const current = prev.features;
      if (current.includes(featId)) return { ...prev, features: current.filter(f => f !== featId) };
      return { ...prev, features: [...current, featId] };
    });
  };

  const handleDeploy = async () => {
    setStep(8); // Move to deployment status step
    setIsDeploying(true);
    setDeployProgress(10);

    let extractedTexts = [];

    try {
      setDeployProgress(30);
      const validUrls = config.urls.filter(u => u.trim());
      if (validUrls.length > 0) {
        const scrapeRes = await fetch('http://localhost:8000/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: validUrls })
        });
        if (scrapeRes.ok) {
          const data = await scrapeRes.json();
          if (data.texts) extractedTexts.push(...data.texts);
        }
      }

      setDeployProgress(50);
      for (const file of config.files) {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('http://localhost:8000/api/upload', {
          method: 'POST',
          body: formData
        });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          if (data.text) extractedTexts.push(`Source: ${file.name}\n${data.text}`);
        }
      }

      setDeployProgress(70);
      const deployRes = await fetch('http://localhost:8000/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extracted_texts: extractedTexts,
          ragType: config.ragType,
          useCase: config.useCase,
          vectorDb: config.vectorDb,
          theme: config.theme,
          features: config.features,
          deploymentType: config.deploymentType
        })
      });

      if (deployRes.ok) {
        const data = await deployRes.json();
        setDeployData(data);
        setDeployProgress(100);
      }
    } catch (err) {
      console.error("Deploy error:", err);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setConfig(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
    }
  };

  const selectedThemeObj = THEMES.find(t => t.id === config.theme);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in backdrop-blur-sm bg-black/50">
      <div className="absolute inset-0 bg-zinc-950/80" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-[#0b0b0e] border border-cyan-500/20 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/10 flex flex-col h-[650px] animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5 relative overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-800">
            <div className="h-full transition-all duration-300 ease-out" style={{ width: `${(step / totalSteps) * 100}%`, backgroundColor: selectedThemeObj.color }} />
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Bot className="w-5 h-5" style={{ color: selectedThemeObj.color }} />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                Custom RAG Factory
              </h2>
              <div className="text-xs text-zinc-500 font-medium">Step {step} of {totalSteps}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800 relative">

          {/* BACKGROUND ICON INDICATORS FOR AESTHETICS */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none overflow-hidden">
            {step === 1 && <Database className="w-96 h-96 -mr-20" />}
            {step === 2 && <LayoutTemplate className="w-96 h-96 -mr-20" />}
            {step === 6 && <Layers className="w-96 h-96 -mr-20" />}
            {step === 9 && <MessageSquare className="w-96 h-96 -mr-20" />}
          </div>

          {step === 1 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                  <LinkIcon className="w-5 h-5 text-cyan-400" /> Connect Data Sources
                </h3>
                <p className="text-sm text-zinc-400 mb-6">URLs to scrape for knowledge indexing.</p>
                <div className="space-y-3">
                  {config.urls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => {
                          const newUrls = [...config.urls];
                          newUrls[i] = e.target.value;
                          updateConfig('urls', newUrls);
                        }}
                        placeholder="https://example.com/docs"
                        className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition"
                      />
                    </div>
                  ))}
                  <button onClick={() => updateConfig('urls', [...config.urls, ''])} className="text-sm text-cyan-400 hover:text-cyan-300 font-medium transition">+ Add another URL</button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                  <Upload className="w-5 h-5 text-cyan-400" /> File Upload
                </h3>
                <label className="border-2 border-dashed border-zinc-800 hover:border-cyan-500/30 bg-zinc-900/20 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition cursor-pointer group">
                  <input type="file" multiple className="hidden" onChange={handleFileChange} />
                  <div className="w-12 h-12 rounded-full bg-zinc-800 group-hover:bg-cyan-500/20 flex items-center justify-center mb-3 transition">
                    <Upload className="w-6 h-6 text-zinc-400 group-hover:text-cyan-400 transition" />
                  </div>
                  <span className="text-sm font-medium text-white mb-1">Click to upload or drag and drop</span>
                  <span className="text-xs text-zinc-500">PDF, TXT, DOCX</span>
                </label>
                {config.files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {config.files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-sm text-zinc-300 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
                        {f.name}
                        <button onClick={() => updateConfig('files', config.files.filter((_, idx) => idx !== i))} className="text-red-400">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <LayoutTemplate className="w-5 h-5 text-cyan-400" /> Architecture Selection
              </h3>
              <p className="text-sm text-zinc-400 mb-6">Choose the foundational Haystack topology for your Assistant.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {RAG_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => updateConfig('ragType', type.id)}
                    className={`p-5 rounded-2xl border text-left transition group ${config.ragType === type.id
                        ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/50'
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`font-semibold ${config.ragType === type.id ? 'text-cyan-400' : 'text-zinc-200 group-hover:text-white'}`}>
                        {type.name}
                      </span>
                      {config.ragType === type.id && <Check className="w-5 h-5 text-cyan-400" />}
                    </div>
                    <p className="text-sm text-zinc-500">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-cyan-400" /> Persona Selection
              </h3>
              <p className="text-sm text-zinc-400 mb-6">How should the AI behave and structure its answers?</p>

              <div className="grid grid-cols-2 gap-4">
                {USE_CASES.map(use => (
                  <button
                    key={use.id}
                    onClick={() => updateConfig('useCase', use.id)}
                    className={`p-4 rounded-xl border text-center transition ${config.useCase === use.id
                        ? 'bg-white/10 border-white/30 text-white shadow-lg'
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                      }`}
                  >
                    <span className="text-sm font-medium">{use.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-cyan-400" /> Vector Database
              </h3>
              <p className="text-sm text-zinc-400 mb-6">Select the document store for embedding retrieval.</p>

              <div className="flex flex-col gap-3">
                {VECTORDBS.map(db => (
                  <button
                    key={db.id}
                    onClick={() => updateConfig('vectorDb', db.id)}
                    className={`p-4 rounded-xl border flex items-center justify-between transition ${config.vectorDb === db.id
                        ? 'bg-gradient-to-r from-zinc-800 to-zinc-900 border-zinc-600 text-white shadow-lg'
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Server className={`w-5 h-5 ${config.vectorDb === db.id ? 'text-cyan-400' : 'text-zinc-600'}`} />
                      <span className="font-medium">{db.name}</span>
                    </div>
                    {config.vectorDb === db.id && <Check className="w-4 h-4 text-cyan-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Settings2 className="w-5 h-5 text-cyan-400" /> Optional Features
              </h3>
              <p className="text-sm text-zinc-400 mb-6">Enhance your pipelines with specialized components.</p>

              <div className="grid grid-cols-2 gap-4">
                {FEATURES.map(feat => {
                  const isActive = config.features.includes(feat.id);
                  return (
                    <button
                      key={feat.id}
                      onClick={() => toggleFeature(feat.id)}
                      className={`p-4 rounded-xl border flex items-center justify-between transition ${isActive
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                          : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-700'
                        }`}
                    >
                      <span className="text-sm font-medium">{feat.name}</span>
                      <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition ${isActive ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'}`}>
                        {isActive && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-6 border-t border-white/5">
                <h4 className="text-sm font-semibold text-white mb-4">Bot Theming</h4>
                <div className="flex gap-3">
                  {THEMES.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => updateConfig('theme', theme.id)}
                      className={`w-10 h-10 rounded-full transition-transform ${config.theme === theme.id ? 'scale-110 ring-2 ring-offset-2 ring-offset-zinc-950 ring-white' : 'hover:scale-110'}`}
                      style={{ backgroundColor: theme.color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <RagVisualizer config={config} />
          )}

          {step === 7 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Globe className="w-5 h-5 text-cyan-400" /> Deployment Options
              </h3>
              <p className="text-sm text-zinc-400 mb-6">How do you want to interact with your RAG system?</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => updateConfig('deploymentType', 'api')}
                  className={`p-6 rounded-2xl border text-left flex flex-col items-start transition ${config.deploymentType === 'api'
                      ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/50'
                      : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                >
                  <Globe className={`w-8 h-8 mb-4 ${config.deploymentType === 'api' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  <h4 className="font-semibold text-white mb-1">Online API Access</h4>
                  <p className="text-xs text-zinc-500">Deploy to cloud/local server and expose standard REST API endpoints.</p>
                </button>

                <button
                  onClick={() => updateConfig('deploymentType', 'offline')}
                  className={`p-6 rounded-2xl border text-left flex flex-col items-start transition ${config.deploymentType === 'offline'
                      ? 'bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/50'
                      : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                >
                  <Code className={`w-8 h-8 mb-4 ${config.deploymentType === 'offline' ? 'text-purple-400' : 'text-zinc-500'}`} />
                  <h4 className="font-semibold text-white mb-1">Offline Embedded Model</h4>
                  <p className="text-xs text-zinc-500">Export the Haystack pipeline for embedding directly into edge devices or local apps.</p>
                </button>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-8 animate-fade-in flex flex-col items-center justify-center h-full">
              {isDeploying ? (
                <>
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-t-cyan-500 border-r-cyan-500 border-b-transparent border-l-transparent rounded-full animate-spin w-16 h-16" />
                    <Bot className="w-6 h-6 text-zinc-500 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white">Compiling Components</h3>
                    <p className="text-sm text-zinc-400">Embedding documents and building pipeline...</p>
                  </div>
                  <div className="w-full max-w-sm h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 transition-all duration-500" style={{ width: `${deployProgress}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-2">
                    <Check className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">Ready to Launch!</h3>
                    <p className="text-sm text-zinc-400 mb-6">Your customized Agentic RAG is active.</p>
                  </div>

                  {deployData && (
                    <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl w-full max-w-sm relative group">
                      <Terminal className="w-4 h-4 text-zinc-500 absolute top-3 right-3" />
                      <div className="text-xs text-zinc-500 mb-1">API Endpoint</div>
                      <code className="text-sm text-cyan-300 font-mono break-all">{deployData.deployment_info?.query_endpoint || 'http://localhost:8000/api/rag/mock/query'}</code>
                    </div>
                  )}

                  <button
                    onClick={() => setStep(9)}
                    className="mt-4 px-6 py-3 bg-white text-black font-semibold rounded-full hover:bg-zinc-200 transition flex items-center gap-2"
                  >
                    Enter Live Test Arena <Play className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}

          {step === 9 && (
            <RagChatTester themeColor={selectedThemeObj.color} themeName={selectedThemeObj.name} />
          )}

        </div>

        {/* Footer Navigation */}
        {step < 8 && (
          <div className="p-6 border-t border-white/5 bg-zinc-950 flex items-center justify-between z-20">
            <button
              onClick={() => step > 1 && setStep(step - 1)}
              className={`text-sm font-medium ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-zinc-400 hover:text-white transition'}`}
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className={`px-6 py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-full flex items-center gap-2 transition active:scale-95`}
            >
              {step === 7 ? 'Initialize Deployment' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 9 && (
          <div className="p-4 border-t border-white/5 bg-zinc-950 flex items-center justify-end z-20">
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-semibold rounded-full hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition active:scale-95"
            >
              Finish & Return
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
