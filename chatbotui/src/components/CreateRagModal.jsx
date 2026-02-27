import React, { useState } from 'react';
import { Bot, Link as LinkIcon, Upload, Database, LayoutTemplate, Palette, X, ChevronRight, Check, Settings2, Globe, Server, Code, Terminal, MessageSquare, Play, User, Layers } from 'lucide-react';
import RagVisualizer from './RagVisualizer';

const DB_TYPES = [
  { id: 'cloud', name: 'Cloud Vector DB', desc: 'Managed, scalable remote databases.' },
  { id: 'local', name: 'Local Vector DB', desc: 'Self-hosted, private databases.' },
  { id: 'hybrid', name: 'Hybrid DB', desc: 'Combine both cloud and local storage.' },
];

const CLOUD_DBS = [
  { id: 'pinecone', name: 'Pinecone' },
  { id: 'weaviate', name: 'Weaviate' },
  { id: 'milvus', name: 'Milvus' }
];

const LOCAL_DBS = [
  { id: 'chroma', name: 'ChromaDB' },
  { id: 'faiss', name: 'FAISS' }
];

const RAG_TYPES = [
  { id: 'basic', name: 'Basic RAG', desc: 'Standard vector similarity search.' },
  { id: 'conversational', name: 'Conversational RAG', desc: 'Maintains long-term chat history.' },
  { id: 'multimodal', name: 'Multimodal RAG', desc: 'Handles text, images, and audio.' },
  { id: 'structured', name: 'Structured/Graph RAG', desc: 'Retrieves from structured data or Knowledge Graphs.' },
  { id: 'agentic', name: 'Agentic RAG', desc: 'Uses tools and reasoning logic.' },
  { id: 'realtime', name: 'Real-Time RAG', desc: 'Streams and indexes live data feeds.' },
  { id: 'personalized', name: 'Personalized RAG', desc: 'Adapts to user-specific memory and preferences.' },
  { id: 'crosslingual', name: 'Cross-Lingual RAG', desc: 'Translate and retrieve across languages.' },
  { id: 'voice', name: 'Voice-Ready RAG', desc: 'Speech-to-text input and spoken output.' },
  { id: 'citation', name: 'Citation-Enabled RAG', desc: 'Provides precise sources for answers.' },
];

const LLM_MODELS = [
  { id: 'qwen-local', name: 'Local Qwen 2.5 14B', desc: 'Offline, private computing.' },
  { id: 'gpt4o', name: 'OpenAI GPT-4o', desc: 'Cloud, high capability.' },
  { id: 'claude35', name: 'Anthropic Claude 3.5 Sonnet', desc: 'Cloud, fast and smart.' }
];

const EMBEDDING_MODELS = [
  { id: 'bge-local', name: 'Local BGE-m3', desc: 'Offline, dense embeddings.' },
  { id: 'openai-ada', name: 'OpenAI text-embedding-ada-002', desc: 'Cloud standard.' },
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

export default function CreateRagModal({ isOpen, onClose, onComplete, initialConfig }) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    // Step 1: Data
    urls: [''],
    files: [],

    // Step 2: DB Selection
    dbType: 'cloud',
    cloudDb: 'pinecone',
    localDb: 'chroma',

    // Step 3: Architecture
    ragType: 'agentic',

    // Step 4: Dynamic Config
    dynamicConfig: {},

    // Step 5: Models
    llmModel: 'qwen-local',
    embeddingModel: 'bge-local',

    // Step 6: Advanced Tuning
    chunkSize: 500,
    topK: 5,
    useReranker: false,

    // Step 7: Features & Theme
    features: [],
    theme: THEMES[0].id,

    // Step 9: Deployment Type
    deploymentType: 'api'
  });
  const [deployData, setDeployData] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);

  React.useEffect(() => {
    if (isOpen) {
      if (initialConfig?.ragType) {
        setConfig(prev => ({ ...prev, ragType: initialConfig.ragType }));
      }
      setStep(1);
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const totalSteps = 10;

  const handleNext = async () => {
    if (step === 9) {
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

  const toggleDynamicConfig = (key, value) => {
    setConfig(prev => {
      const current = prev.dynamicConfig[key] || [];
      const newValues = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, dynamicConfig: { ...prev.dynamicConfig, [key]: newValues } };
    });
  };

  const handleDeploy = async () => {
    setStep(10); // Move to deployment status step
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
          dbType: config.dbType,
          cloudDb: config.cloudDb,
          localDb: config.localDb,
          dynamicConfig: config.dynamicConfig,
          llmModel: config.llmModel,
          embeddingModel: config.embeddingModel,
          chunkSize: config.chunkSize,
          topK: config.topK,
          useReranker: config.useReranker,
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
                <Database className="w-5 h-5 text-cyan-400" /> Vector Database & Storage
              </h3>
              <p className="text-sm text-zinc-400 mb-6">Select where your embeddings will be stored and queried.</p>

              {/* Deployment Location (Cloud vs Local vs Hybrid) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {DB_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => updateConfig('dbType', type.id)}
                    className={`p-4 rounded-xl border text-left transition group ${config.dbType === type.id
                      ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/50'
                      : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-semibold text-sm ${config.dbType === type.id ? 'text-cyan-400' : 'text-zinc-200'}`}>
                        {type.name}
                      </span>
                      {config.dbType === type.id && <Check className="w-4 h-4 text-cyan-400" />}
                    </div>
                    <p className="text-xs text-zinc-500">{type.desc}</p>
                  </button>
                ))}
              </div>

              {/* Specific DB Selection based on dbType */}
              <div className="space-y-4">
                {(config.dbType === 'cloud' || config.dbType === 'hybrid') && (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-300 mb-3">Cloud Provider</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {CLOUD_DBS.map(db => (
                        <button
                          key={db.id}
                          onClick={() => updateConfig('cloudDb', db.id)}
                          className={`p-3 rounded-lg border text-center transition ${config.cloudDb === db.id ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                        >
                          <span className="text-sm">{db.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(config.dbType === 'local' || config.dbType === 'hybrid') && (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-300 mb-3 mt-4">Local Provider</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {LOCAL_DBS.map(db => (
                        <button
                          key={db.id}
                          onClick={() => updateConfig('localDb', db.id)}
                          className={`p-3 rounded-lg border text-center transition ${config.localDb === db.id ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                        >
                          <span className="text-sm">{db.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <LayoutTemplate className="w-5 h-5 text-cyan-400" /> Architecture Selection
              </h3>
              <p className="text-sm text-zinc-400 mb-6">Choose the foundational Haystack topology for your Assistant.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                {RAG_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => updateConfig('ragType', type.id)}
                    className={`p-4 rounded-xl border text-left transition group ${config.ragType === type.id
                      ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/50'
                      : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`font-semibold text-sm ${config.ragType === type.id ? 'text-cyan-400' : 'text-zinc-200 group-hover:text-white'}`}>
                        {type.name}
                      </span>
                      {config.ragType === type.id && <Check className="w-4 h-4 text-cyan-400" />}
                    </div>
                    <p className="text-xs text-zinc-500">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Settings2 className="w-5 h-5 text-cyan-400" /> Dynamic Configuration
              </h3>
              <p className="text-sm text-zinc-400 mb-6">Customize specific settings for your {RAG_TYPES.find(r => r.id === config.ragType)?.name || 'Pipeline'}.</p>

              <div className="space-y-4">
                {config.ragType === 'conversational' && (
                  <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                    <h4 className="text-sm font-semibold text-white mb-2">Memory Settings</h4>
                    <label className="text-xs text-zinc-400 block mb-1">Max History Entries to Keep</label>
                    <input
                      type="number"
                      value={config.dynamicConfig?.historyLength || 10}
                      onChange={(e) => setConfig(prev => ({ ...prev, dynamicConfig: { ...prev.dynamicConfig, historyLength: parseInt(e.target.value) } }))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm"
                    />
                  </div>
                )}
                {config.ragType === 'agentic' && (
                  <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                    <h4 className="text-sm font-semibold text-white mb-2">Agent Tools</h4>
                    <p className="text-xs text-zinc-400 mb-3">Which capabilities should the agent have access to?</p>
                    <div className="flex flex-wrap gap-2">
                      {['Web Search', 'Calculator', 'Weather API', 'Ticket System'].map(tool => (
                        <button
                          key={tool}
                          onClick={() => toggleDynamicConfig('tools', tool)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${(config.dynamicConfig?.tools || []).includes(tool)
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                        >
                          {tool}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {config.ragType === 'citation' && (
                  <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                    <h4 className="text-sm font-semibold text-white mb-2">Citation Style</h4>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, dynamicConfig: { ...prev.dynamicConfig, citationStyle: 'inline' } }))}
                        className={`px-4 py-2 text-sm rounded-lg border transition ${config.dynamicConfig?.citationStyle === 'inline' ? 'bg-zinc-800 border-cyan-500/50 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                      >Inline [1]</button>
                      <button
                        onClick={() => setConfig(prev => ({ ...prev, dynamicConfig: { ...prev.dynamicConfig, citationStyle: 'end' } }))}
                        className={`px-4 py-2 text-sm rounded-lg border transition ${config.dynamicConfig?.citationStyle === 'end' ? 'bg-zinc-800 border-cyan-500/50 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400'}`}
                      >End of Response summary</button>
                    </div>
                  </div>
                )}
                {/* Fallback for others currently just standard configs */}
                {!['conversational', 'agentic', 'citation'].includes(config.ragType) && (
                  <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 text-center py-8">
                    <p className="text-sm text-zinc-500 font-medium">No specialized configuration needed for ({config.ragType}). Default settings will be applied.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Bot className="w-5 h-5 text-cyan-400" /> Models
              </h3>
              <p className="text-sm text-zinc-400 mb-6">Select the generative LLM and the Embedding Model.</p>

              <div>
                <h4 className="text-sm mt-2 mb-3 font-semibold text-zinc-200">LLM Generator (Language Model)</h4>
                <div className="grid grid-cols-1 gap-2">
                  {LLM_MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => updateConfig('llmModel', m.id)}
                      className={`p-3 rounded-lg border text-left transition ${config.llmModel === m.id ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/50' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-700'
                        }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium ${config.llmModel === m.id ? 'text-cyan-400' : 'text-zinc-200'}`}>{m.name}</span>
                        {config.llmModel === m.id && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <p className="text-xs">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm mt-6 mb-3 font-semibold text-zinc-200">Embedding Model</h4>
                <div className="grid grid-cols-1 gap-2">
                  {EMBEDDING_MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => updateConfig('embeddingModel', m.id)}
                      className={`p-3 rounded-lg border text-left transition ${config.embeddingModel === m.id ? 'bg-purple-500/10 border-purple-500/50 ring-1 ring-purple-500/50' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-700'
                        }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium ${config.embeddingModel === m.id ? 'text-purple-400' : 'text-zinc-200'}`}>{m.name}</span>
                        {config.embeddingModel === m.id && <Check className="w-4 h-4 text-purple-400" />}
                      </div>
                      <p className="text-xs">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Settings2 className="w-5 h-5 text-cyan-400" /> Advanced Tuning
              </h3>
              <p className="text-sm text-zinc-400 mb-6">Fine-tune the ingestion and retrieval parameters.</p>

              <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl space-y-5">
                <div>
                  <label className="flex justify-between text-sm font-medium text-white mb-2">
                    Chunk Size <span className="text-cyan-400">{config.chunkSize} tokens</span>
                  </label>
                  <input
                    type="range"
                    min="100" max="2000" step="100"
                    value={config.chunkSize}
                    onChange={(e) => updateConfig('chunkSize', parseInt(e.target.value))}
                    className="w-full accent-cyan-500 bg-zinc-800 h-2 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-zinc-500 mt-2">Determines how large each document segment is before embedding.</p>
                </div>

                <div className="border-t border-zinc-800 pt-5">
                  <label className="flex justify-between text-sm font-medium text-white mb-2">
                    Retrieval Top-K <span className="text-cyan-400">{config.topK} docs</span>
                  </label>
                  <input
                    type="range"
                    min="1" max="20" step="1"
                    value={config.topK}
                    onChange={(e) => updateConfig('topK', parseInt(e.target.value))}
                    className="w-full accent-cyan-500 bg-zinc-800 h-2 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-zinc-500 mt-2">Number of initial documents retrieved from the vector DB.</p>
                </div>

                <div className="border-t border-zinc-800 pt-5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Enable Neural Reranking</div>
                    <div className="text-xs text-zinc-500 mt-1">Improves relevance by cross-encoding queries with retrieved docs.</div>
                  </div>
                  <button
                    onClick={() => updateConfig('useReranker', !config.useReranker)}
                    className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${config.useReranker ? 'bg-cyan-500' : 'bg-zinc-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.useReranker ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Palette className="w-5 h-5 text-cyan-400" /> Features & Theming
              </h3>
              <p className="text-sm text-zinc-400 mb-6">Add extra capabilities and customize the look.</p>

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

          {step === 8 && (
            <div className="animate-fade-in relative z-10 h-full flex flex-col -mt-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Layers className="w-5 h-5 text-cyan-400" /> Architecture Graph
              </h3>
              <p className="text-sm text-zinc-400 mb-4 shrink-0">Visual summary of your configured multi-agent system.</p>
              <div className="flex-1 min-h-[300px] border border-zinc-800 rounded-2xl overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 shadow-inner bg-zinc-950/50 relative">
                <RagVisualizer config={config} />
              </div>
            </div>
          )}

          {step === 9 && (
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

          {step === 10 && (
            <div className="space-y-8 animate-fade-in flex flex-col items-center justify-center h-full">
              {isDeploying ? (
                <>
                  <div className="relative flex items-center justify-center w-full max-w-[300px] aspect-square mx-auto my-auto">
                    <div className="absolute inset-0 border-4 border-t-cyan-500 border-r-cyan-500 border-b-transparent border-l-transparent rounded-full animate-spin w-20 h-20 m-auto" />
                    <Bot className="w-8 h-8 text-zinc-500 animate-pulse m-auto" />
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
                deployData && !isDeploying && (
                  <div className="flex flex-col items-center justify-center text-center animate-slide-up space-y-6 w-full max-w-md">
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/50 mb-2 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                      <Check className="w-10 h-10 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">Deployed Successfully</h3>
                      <p className="text-zinc-400">Your {RAG_TYPES.find(r => r.id === config.ragType)?.name} is live and ready for production.</p>
                      <div className="bg-zinc-900/50 p-3 mt-4 rounded-xl border border-zinc-800 text-xs font-mono text-zinc-400 text-left">
                        API Endpoint: <span className="text-emerald-400">{deployData.deployment_info?.query_endpoint}</span>
                      </div>
                    </div>
                    <div className="flex gap-4 w-full pt-4">
                      <button onClick={() => window.open(`/chat/${deployData.deployment_info?.pipeline_id}`, '_blank')} className="flex-1 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition">
                        Open Standalone Chatbot
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        {(step < 10) && (
          <div className="p-6 border-t border-white/5 bg-zinc-950 flex items-center justify-between z-20 shrink-0">
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
              {step === 9 ? 'Initialize Deployment' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {(step === 10 && !isDeploying) && (
          <div className="p-4 border-t border-white/5 bg-zinc-950 flex items-center justify-end z-20 shrink-0">
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
