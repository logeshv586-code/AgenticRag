import React, { useState } from 'react';
import { Bot, Link as LinkIcon, Upload, Database, LayoutTemplate, Palette, X, ChevronRight, Check, Settings2, Globe, Server, Code, Terminal, MessageSquare, Play, User, Layers, Shield, Eye, Zap, Languages, Mic, BookOpen, Key, Search, MessageCircle, Workflow, Brain, Cpu, Users, Book, Wand2, Cloud, HardDrive, Network } from 'lucide-react';
import RagVisualizer from './RagVisualizer';

const DB_TYPES = [
  { id: 'cloud', name: 'Cloud Vector DB', desc: 'Managed, scalable remote databases.', icon: Cloud },
  { id: 'local', name: 'Local Vector DB', desc: 'Self-hosted, private databases.', icon: HardDrive },
  { id: 'hybrid', name: 'Hybrid DB', desc: 'Combine both cloud and local storage.', icon: Network },
];

const CLOUD_DBS = [
  { id: 'pinecone', name: 'Pinecone', desc: 'Managed, scalable. Best for large-scale datasets.', icon: Server },
  { id: 'weaviate', name: 'Weaviate', desc: 'Flexible, open-source. Trusted for government and secure data.', icon: Database },
  { id: 'milvus', name: 'Milvus', desc: 'Cloud-native, distributed. Optimized for enterprise AI workloads.', icon: Layers },
  { id: 'qdrant', name: 'Qdrant', desc: 'High-performance vector search. Great for filtering and hybrid queries.', icon: Zap },
  { id: 'elasticsearch', name: 'Elasticsearch', desc: 'Full-text + vector search. Ideal for enterprise with existing ES infrastructure.', icon: Search }
];

const LOCAL_DBS = [
  { id: 'chroma', name: 'ChromaDB', icon: Database },
  { id: 'faiss', name: 'FAISS', icon: Server }
];

const RAG_TYPES = [
  { id: 'basic', name: 'Universal Neural RAG', desc: 'Enterprise vector similarity search for foundational data retrieval.', icon: Search },
  { id: 'conversational', name: 'Enterprise Cognitive RAG', desc: 'Maintains long-term session context for enterprise intelligence assistants.', icon: MessageCircle },
  { id: 'multimodal', name: 'Global Context RAG (Multimodal)', desc: 'Seamlessly processes distributed text, images, and audio clusters.', icon: Layers },
  { id: 'structured', name: 'Synaptic Graph Architecture', desc: 'Deep relationship mapping and neural reasoning from knowledge graphs.', icon: Workflow },
  { id: 'agentic', name: 'Autonomous Intelligence Node', desc: 'Agentic reasoning loops with tools to perform enterprise operations.', icon: Brain },
  { id: 'realtime', name: 'Live Neural Stream RAG', desc: 'Streams and indexes live data feeds for real-time enterprise insights.', icon: Cpu },
  { id: 'personalized', name: 'Adaptive Neural Persona', desc: 'Dynamically adapts to user-specific enterprise roles and preferences.', icon: Users },
  { id: 'crosslingual', name: 'Universal Matrix RAG', desc: 'Translate and retrieve global intelligence across multiple languages natively.', icon: Languages },
  { id: 'voice', name: 'Vocal Synthesis Node', desc: 'Neural speech-to-text input and natural spoken output pipeline.', icon: Mic },
  { id: 'citation', name: 'Verified Intelligence RAG', desc: 'Provides cryptographically precise sources and evidence for enterprise audits.', icon: Book },
];

const LLM_MODELS = [
  { id: 'qwen-local', name: 'Local Qwen 2.5 14B', desc: 'Offline, private. No API key needed.', provider: 'local', setup: 'Requires ~10GB VRAM. Model auto-loaded from local GGUF file.', icon: Server },
  { id: 'mistral-local', name: 'Local Mistral 7B', desc: 'Offline, fast inference.', provider: 'local', setup: 'Requires ~6GB VRAM. Download GGUF from HuggingFace.', icon: Terminal },
  { id: 'gpt4o', name: 'OpenAI GPT-4o', desc: 'Cloud, high capability.', provider: 'openai', setup: 'Requires OpenAI API key.', icon: Globe },
  { id: 'claude35', name: 'Anthropic Claude 3.5 Sonnet', desc: 'Cloud, fast and smart.', provider: 'anthropic', setup: 'Requires Anthropic API key.', icon: Globe },
  { id: 'gemini', name: 'Google Gemini Pro', desc: 'Cloud, multimodal ready.', provider: 'gemini', setup: 'Requires Google AI API key.', icon: Globe }
];

const EMBEDDING_MODELS = [
  { id: 'bge-local', name: 'Local BGE-m3', desc: 'Offline, dense embeddings. No key needed.', provider: 'local', icon: Server },
  { id: 'openai-ada', name: 'OpenAI text-embedding-ada-002', desc: 'Cloud standard.', provider: 'openai', icon: Globe },
  { id: 'mistral-embed', name: 'Mistral Embeddings', desc: 'Cloud, multilingual.', provider: 'mistral', icon: Globe },
];

const FEATURES = [
  { id: 'multilingual', name: 'Multi-lingual Support', icon: Languages },
  { id: 'citations', name: 'Source Citations', icon: BookOpen },
  { id: 'sentiment', name: 'Sentiment Analysis', icon: Eye },
  { id: 'voice', name: 'Voice Interaction Ready', icon: Mic },
  { id: 'explainability', name: 'Explainability', icon: Eye, desc: 'Show why results were chosen' },
  { id: 'privacy', name: 'Privacy Mode', icon: Shield, desc: 'Strip personal data from responses' },
  { id: 'hallucinationGuard', name: 'Hallucination Guard', icon: Shield, desc: 'Strict confidence thresholds for answers' },
  { id: 'toxicityFilter', name: 'Toxicity Filter', icon: Shield, desc: 'Filter harmful inputs/outputs' },
  { id: 'structuredOutput', name: 'Structured JSON Output', icon: Code, desc: 'Force LLM to reply in JSON format' },
  { id: 'streamingResponse', name: 'Streaming Response', icon: Zap, desc: 'Stream tokens as they are generated' },
];

const THEMES = [
  { id: 'cyan', name: 'Cyber Cyan', hue: 0, color: '#22d3ee' },
  { id: 'pink', name: 'Neon Pink', hue: 300, color: '#ff2e93' },
  { id: 'emerald', name: 'Emerald', hue: 120, color: '#10b981' },
  { id: 'violet', name: 'Deep Violet', hue: 250, color: '#8b5cf6' },
  { id: 'gold', name: 'Luxury Gold', hue: 45, color: '#fbbf24' },
  { id: 'red', name: 'Ruby Red', hue: 0, color: '#ef4444' },
  { id: 'teal', name: 'Ocean Teal', hue: 175, color: '#14b8a6' },
  { id: 'orange', name: 'Solar Orange', hue: 25, color: '#f97316' },
];

const DETAIL_LEVELS = [
  { label: 'Brief', value: 200, desc: 'Quick answers, fewer details' },
  { label: 'Standard', value: 500, desc: 'Balanced detail and speed' },
  { label: 'Thorough', value: 1000, desc: 'Detailed, comprehensive answers' },
  { label: 'Maximum', value: 2000, desc: 'Deep analysis of every detail' },
];

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese',
  'Korean', 'Arabic', 'Hindi', 'Portuguese', 'Russian', 'Italian'
];

export default function CreateRagModal({ isOpen, onClose, onComplete, initialConfig }) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    // Step 1: Naming
    ragName: '',

    // Step 2: Data
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
    deploymentType: 'api',

    // New fields
    scrapeMode: 'static',
    apiKeys: {},
    privacyMode: false,
    explainability: false,
  });
  const [tuningMode, setTuningMode] = useState('simple'); // 'simple' or 'expert'
  const [deployData, setDeployData] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [isIngesting, setIsIngesting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (initialConfig?.ragType) {
        setConfig(prev => ({ ...prev, ragType: initialConfig.ragType }));
      }
      setStep(1);
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const totalSteps = 11;

  const handleNext = async () => {
    // If moving past Step 2 (Data sources), trigger ingest first
    if (step === 2) {
      const validUrls = config.urls.filter(u => u.trim());
      if (validUrls.length === 0 && config.files.length === 0) {
        alert("Please provide at least one data source.");
        return;
      }
      if (!config.ragName) {
        alert("Please provide a name for your RAG in the previous step.");
        setStep(1);
        return;
      }

      setIsIngesting(true);
      try {
        // Scrape Process
        if (validUrls.length > 0) {
          await fetch('http://localhost:8000/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ragName: config.ragName,
              urls: validUrls,
              mode: config.scrapeMode
            })
          });
        }

        // Upload Process
        for (const file of config.files) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('ragName', config.ragName);
          await fetch('http://localhost:8000/api/upload', {
            method: 'POST',
            body: formData
          });
        }
      } catch (e) {
        console.error("Ingestion error", e);
      } finally {
        setIsIngesting(false);
        setStep(3); // Move to Database Selection
      }
      return;
    }

    if (step === 10) {
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
    setStep(11); // Move to deployment status step
    setIsDeploying(true);
    setDeployProgress(10);

    try {
      setDeployProgress(50);
      const deployRes = await fetch('http://localhost:8000/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ragName: config.ragName,
          extracted_texts: [], // Backend will read from data folder
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
          deploymentType: config.deploymentType,
          apiKeys: config.apiKeys,
          privacyMode: config.privacyMode,
          explainability: config.explainability,
          scrapeMode: config.scrapeMode
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

      <div className="relative w-full max-w-4xl bg-[#0b0b0e]/90 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[750px] animate-slide-up glass-card">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5 relative overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/5">
            <div className="h-full transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1)" style={{ width: `${(step / totalSteps) * 100}%`, background: `linear-gradient(90deg, ${selectedThemeObj.color}, #3b82f6)` }} />
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
            {step === 1 && <Bot className="w-96 h-96 -mr-20" />}
            {step === 2 && <Database className="w-96 h-96 -mr-20" />}
            {step === 3 && <LayoutTemplate className="w-96 h-96 -mr-20" />}
            {step === 7 && <Layers className="w-96 h-96 -mr-20" />}
            {step === 10 && <MessageSquare className="w-96 h-96 -mr-20" />}
          </div>

          {step === 1 && (
            <div className="space-y-8 animate-fade-in flex flex-col justify-center h-full sm:px-12">
              <div className="text-center">
                <div className="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500/50 mb-6 mx-auto shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                  <Wand2 className="w-10 h-10 text-cyan-400" />
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">Name Your Agent</h3>
                <p className="text-zinc-400 mb-8 max-w-sm mx-auto">Give your new cognitive node an identity before providing it with enterprise data.</p>
                <input
                  type="text"
                  value={config.ragName}
                  onChange={(e) => updateConfig('ragName', e.target.value)}
                  placeholder="e.g. Sales Copilot, Tech Support AI"
                  className="w-full max-w-md mx-auto block bg-black/50 border border-zinc-700/50 rounded-2xl px-6 py-4 text-center text-white text-xl placeholder-zinc-700 focus:outline-none focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/20 transition-all font-semibold"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-2 text-premium">
                  <Globe className="w-6 h-6 text-cyan-400" /> Connect Data Sources
                </h3>
                <p className="text-sm text-zinc-400 mb-6">Enter URLs you want your AI to learn from. We'll scrape everything.</p>
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

                {/* Scrape Mode Toggle */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => updateConfig('scrapeMode', 'static')}
                    className={`flex-1 p-3 rounded-xl border text-center transition-all duration-300 ${config.scrapeMode === 'static' ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'}`}
                  >
                    <div className="text-sm font-bold">Static Pages</div>
                    <div className="text-[10px] text-zinc-500 mt-1">Fast extraction via HTML parsing</div>
                  </button>
                  <button
                    onClick={() => updateConfig('scrapeMode', 'dynamic')}
                    className={`flex-1 p-3 rounded-xl border text-center transition-all duration-300 ${config.scrapeMode === 'dynamic' ? 'bg-purple-500/10 border-purple-500/40 text-purple-300' : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'}`}
                  >
                    <div className="text-sm font-bold">Dynamic Pages</div>
                    <div className="text-[10px] text-zinc-500 mt-1">JS-rendered via headless browser</div>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-2 text-premium">
                  <Upload className="w-6 h-6 text-cyan-400" /> Smart Upload & OCR
                </h3>
                <label className="border-2 border-dashed border-zinc-800 hover:border-cyan-500/30 bg-zinc-900/40 rounded-3xl p-10 flex flex-col items-center justify-center text-center transition cursor-pointer group glass-morphism">
                  <input type="file" multiple className="hidden" onChange={handleFileChange} />
                  <div className="w-16 h-16 rounded-2xl bg-white/5 group-hover:bg-cyan-500/20 flex items-center justify-center mb-4 transition border border-white/5 group-hover:border-cyan-500/30">
                    <Upload className="w-8 h-8 text-zinc-400 group-hover:text-cyan-400 transition" />
                  </div>
                  <span className="text-base font-bold text-white mb-2">Drop Files or Images</span>
                  <p className="text-xs text-zinc-500 max-w-xs">Supports PDFs, DOCX, and high-res Images (OCR). We automatically extract all text.</p>
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

          {step === 3 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-cyan-400" /> Vector Database & Storage
              </h3>
              <p className="text-sm text-zinc-400 mb-6">Select where your embeddings will be stored and queried.</p>

              {/* Deployment Location (Cloud vs Local vs Hybrid) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {DB_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => updateConfig('dbType', type.id)}
                    className={`p-5 rounded-2xl border text-left transition-all duration-300 group glass-morphism ${config.dbType === type.id
                      ? 'border-cyan-500/50 bg-cyan-500/10 active'
                      : 'border-white/5 hover:border-white/20 hover:bg-white/5'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {type.icon && <type.icon className={`w-4 h-4 ${config.dbType === type.id ? 'text-cyan-400' : 'text-zinc-400'}`} />}
                        <span className={`font-bold text-sm text-premium ${config.dbType === type.id ? 'text-cyan-400' : 'text-zinc-200'}`}>
                          {type.name}
                        </span>
                      </div>
                      {config.dbType === type.id && <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center"><Check className="w-3 h-3 text-black stroke-[3]" /></div>}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{type.desc}</p>
                  </button>
                ))}
              </div>

              {/* Specific DB Selection based on dbType */}
              <div className="space-y-4">
                {(config.dbType === 'cloud' || config.dbType === 'hybrid') && (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-300 mb-3">Cloud Provider</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {CLOUD_DBS.map(db => (
                        <button
                          key={db.id}
                          onClick={() => updateConfig('cloudDb', db.id)}
                          className={`p-4 rounded-xl border text-left transition-all duration-300 glass-morphism ${config.cloudDb === db.id ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/5 hover:border-white/10 hover:bg-white/5'
                            }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                              {db.icon && <db.icon className={`w-4 h-4 ${config.cloudDb === db.id ? 'text-cyan-400' : 'text-zinc-400'}`} />}
                              <span className="text-sm font-bold text-white">{db.name}</span>
                            </div>
                            {config.cloudDb === db.id && <Check className="w-4 h-4 text-cyan-400" />}
                          </div>
                          <p className="text-xs text-zinc-500">{db.desc}</p>
                        </button>
                      ))}
                    </div>

                    {/* API Key Input — shown for selected Cloud DB */}
                    {(() => {
                      const sel = CLOUD_DBS.find(db => db.id === config.cloudDb);
                      if (sel) {
                        return (
                          <div className="mt-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                            <label className="text-xs text-zinc-400 flex items-center gap-2 mb-2"><Key className="w-3.5 h-3.5" /> {sel.name} API Key / Credentials</label>
                            <input
                              type="password"
                              value={config.apiKeys?.[sel.id] || ''}
                              onChange={(e) => setConfig(prev => ({ ...prev, apiKeys: { ...prev.apiKeys, [sel.id]: e.target.value } }))}
                              placeholder={`Enter your ${sel.name} API key or connection string`}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500/50 focus:outline-none"
                            />
                          </div>
                        );
                      }
                      return null;
                    })()}
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
                          <span className="text-sm flex items-center justify-center gap-2">
                            {db.icon && <db.icon className="w-4 h-4 opacity-70" />}
                            {db.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <LayoutTemplate className="w-5 h-5 text-cyan-400" /> Architecture Selection
              </h3>
              <p className="text-sm text-zinc-400 mb-6">Choose the foundational Haystack topology for your Assistant.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-[450px] overflow-y-auto pr-3 scrollbar-premium">
                {RAG_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => updateConfig('ragType', type.id)}
                    className={`p-5 rounded-2xl border text-left transition-all duration-300 group glass-morphism ${config.ragType === type.id
                      ? 'border-cyan-500/50 bg-cyan-500/10 active'
                      : 'border-white/5 hover:border-white/20 hover:bg-white/5'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {type.icon && <type.icon className={`w-4 h-4 ${config.ragType === type.id ? 'text-cyan-400' : 'text-zinc-400 group-hover:text-cyan-300'}`} />}
                        <span className={`font-bold text-sm text-premium ${config.ragType === type.id ? 'text-cyan-400' : 'text-zinc-200 group-hover:text-white'}`}>
                          {type.name}
                        </span>
                      </div>
                      {config.ragType === type.id && <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center"><Check className="w-3 h-3 text-black stroke-[3]" /></div>}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
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
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 glass-morphism">
                    <h4 className="text-sm font-bold text-white mb-2 text-premium">Agent Toolset</h4>
                    <p className="text-xs text-zinc-500 mb-4">Select capabilities for your agent to interact with external systems.</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { name: 'Web Search', icon: Globe },
                        { name: 'Calculator', icon: Terminal },
                        { name: 'Ticket System', icon: Layers },
                        { name: 'Calendar', icon: LayoutTemplate },
                        { name: 'Weather API', icon: Globe },
                        { name: 'MCP Discovery', icon: Code }
                      ].map(tool => (
                        <button
                          key={tool.name}
                          onClick={() => toggleDynamicConfig('tools', tool.name)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-300 flex items-center gap-2 ${(config.dynamicConfig?.tools || []).includes(tool.name)
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 active'
                            : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white hover:border-white/10'
                            }`}
                        >
                          <tool.icon className="w-3.5 h-3.5" />
                          {tool.name}
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
                {config.ragType === 'crosslingual' && (
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 glass-morphism space-y-4">
                    <h4 className="text-sm font-bold text-white text-premium">Language Settings</h4>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-2">Source Language</label>
                      <select value={config.dynamicConfig?.sourceLanguage || 'auto'} onChange={(e) => setConfig(prev => ({ ...prev, dynamicConfig: { ...prev.dynamicConfig, sourceLanguage: e.target.value } }))} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm">
                        <option value="auto">Auto-detect</option>
                        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-2">Target Language</label>
                      <select value={config.dynamicConfig?.targetLanguage || 'English'} onChange={(e) => setConfig(prev => ({ ...prev, dynamicConfig: { ...prev.dynamicConfig, targetLanguage: e.target.value } }))} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm">
                        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {config.ragType === 'multimodal' && (
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 glass-morphism">
                    <h4 className="text-sm font-bold text-white mb-3 text-premium">Supported Modalities</h4>
                    <div className="flex flex-wrap gap-2">
                      {['text', 'images', 'audio', 'video', 'tables'].map(mod => (
                        <button key={mod} onClick={() => toggleDynamicConfig('modalities', mod)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${(config.dynamicConfig?.modalities || ['text']).includes(mod) ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/5 text-zinc-400'}`}>
                          {mod.charAt(0).toUpperCase() + mod.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {config.ragType === 'structured' && (
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 glass-morphism space-y-4">
                    <h4 className="text-sm font-bold text-white text-premium">Knowledge Graph Settings</h4>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-2">Entity Types to Extract</label>
                      <div className="flex flex-wrap gap-2">
                        {['Person', 'Organization', 'Location', 'Concept', 'Event', 'Product'].map(ent => (
                          <button key={ent} onClick={() => toggleDynamicConfig('entityTypes', ent)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${(config.dynamicConfig?.entityTypes || []).includes(ent) ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/5 text-zinc-400'}`}>
                            {ent}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-2">Relationship Depth: {config.dynamicConfig?.relationshipDepth || 2} hops</label>
                      <input type="range" min="1" max="5" value={config.dynamicConfig?.relationshipDepth || 2} onChange={(e) => setConfig(prev => ({ ...prev, dynamicConfig: { ...prev.dynamicConfig, relationshipDepth: parseInt(e.target.value) } }))} className="w-full accent-emerald-500" />
                    </div>
                  </div>
                )}
                {config.ragType === 'realtime' && (
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 glass-morphism space-y-4">
                    <h4 className="text-sm font-bold text-white text-premium">Real-Time Settings</h4>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-2">Refresh Interval: {config.dynamicConfig?.refreshInterval || 60}s</label>
                      <input type="range" min="5" max="300" step="5" value={config.dynamicConfig?.refreshInterval || 60} onChange={(e) => setConfig(prev => ({ ...prev, dynamicConfig: { ...prev.dynamicConfig, refreshInterval: parseInt(e.target.value) } }))} className="w-full accent-cyan-500" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div><div className="text-sm text-white">Enable Streaming</div><div className="text-xs text-zinc-500">Stream responses as they generate</div></div>
                      <button onClick={() => setConfig(prev => ({ ...prev, dynamicConfig: { ...prev.dynamicConfig, streaming: !prev.dynamicConfig?.streaming } }))} className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${config.dynamicConfig?.streaming ? 'bg-cyan-500' : 'bg-zinc-700'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.dynamicConfig?.streaming ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                )}
                {config.ragType === 'personalized' && (
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 glass-morphism">
                    <h4 className="text-sm font-bold text-white mb-3 text-premium">User Profile Fields</h4>
                    <p className="text-xs text-zinc-500 mb-4">Select what user data the RAG should personalize on.</p>
                    <div className="flex flex-wrap gap-2">
                      {['Industry', 'Role', 'Experience Level', 'Preferred Language', 'Topics of Interest', 'Communication Style'].map(field => (
                        <button key={field} onClick={() => toggleDynamicConfig('profileFields', field)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${(config.dynamicConfig?.profileFields || []).includes(field) ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-white/5 border-white/5 text-zinc-400'}`}>
                          {field}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {config.ragType === 'voice' && (
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 glass-morphism space-y-4">
                    <h4 className="text-sm font-bold text-white text-premium">Voice Settings</h4>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-2">Voice Language</label>
                      <select value={config.dynamicConfig?.voiceLanguage || 'en-US'} onChange={(e) => setConfig(prev => ({ ...prev, dynamicConfig: { ...prev.dynamicConfig, voiceLanguage: e.target.value } }))} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm">
                        <option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="es-ES">Spanish</option><option value="fr-FR">French</option><option value="de-DE">German</option><option value="ja-JP">Japanese</option><option value="zh-CN">Chinese</option><option value="hi-IN">Hindi</option>
                      </select>
                    </div>
                  </div>
                )}
                {config.ragType === 'basic' && (
                  <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 text-center py-8">
                    <p className="text-sm text-zinc-400 font-medium">Standard RAG uses default settings. Fine-tune in the Advanced Tuning step.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 6 && (
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
                      className={`p-4 rounded-xl border text-left transition-all duration-300 glass-morphism ${config.llmModel === m.id ? 'border-cyan-500/50 bg-cyan-500/10 active' : 'border-white/5 text-zinc-400 hover:bg-white/5 hover:text-white hover:border-white/10'
                        }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          {m.icon && <m.icon className={`w-4 h-4 ${config.llmModel === m.id ? 'text-cyan-400' : 'text-zinc-400 group-hover:text-cyan-300'}`} />}
                          <span className={`text-sm font-bold ${config.llmModel === m.id ? 'text-cyan-400' : 'text-zinc-200'}`}>{m.name}</span>
                        </div>
                        {config.llmModel === m.id && <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center"><Check className="w-3 h-3 text-black stroke-[3]" /></div>}
                      </div>
                      <p className="text-xs leading-relaxed">{m.desc}</p>
                      {config.llmModel === m.id && m.setup && <p className="text-[10px] text-zinc-500 mt-2 italic">{m.setup}</p>}
                    </button>
                  ))}
                </div>

                {/* API Key Input — shown when cloud LLM selected */}
                {(() => {
                  const sel = LLM_MODELS.find(m => m.id === config.llmModel);
                  if (sel && sel.provider !== 'local') {
                    return (
                      <div className="mt-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                        <label className="text-xs text-zinc-400 flex items-center gap-2 mb-2"><Key className="w-3.5 h-3.5" /> {sel.name} API Key</label>
                        <input
                          type="password"
                          value={config.apiKeys?.[sel.provider] || ''}
                          onChange={(e) => setConfig(prev => ({ ...prev, apiKeys: { ...prev.apiKeys, [sel.provider]: e.target.value } }))}
                          placeholder={`Enter your ${sel.provider} API key`}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-500/50 focus:outline-none"
                        />
                      </div>
                    );
                  }
                  return null;
                })()}
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
                        <div className="flex items-center gap-2">
                          {m.icon && <m.icon className={`w-4 h-4 ${config.embeddingModel === m.id ? 'text-purple-400' : 'text-zinc-400'}`} />}
                          <span className={`text-sm font-medium ${config.embeddingModel === m.id ? 'text-purple-400' : 'text-zinc-200'}`}>{m.name}</span>
                        </div>
                        {config.embeddingModel === m.id && <Check className="w-4 h-4 text-purple-400" />}
                      </div>
                      <p className="text-xs">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-cyan-400" /> Advanced Tuning
                </h3>

                {/* Mode Toggle */}
                <div className="flex bg-zinc-900/50 rounded-lg p-1 border border-zinc-800">
                  <button
                    onClick={() => setTuningMode('simple')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${tuningMode === 'simple' ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Simple Mode
                  </button>
                  <button
                    onClick={() => setTuningMode('expert')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${tuningMode === 'expert' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Expert Mode
                  </button>
                </div>
              </div>
              <p className="text-sm text-zinc-400 mb-6">Adjust how your AI processes and retrieves information.</p>

              <div className="bg-white/5 border border-white/5 p-8 rounded-[32px] space-y-8 glass-morphism min-h-[300px]">

                {tuningMode === 'simple' ? (
                  <div className="space-y-4 animate-fade-in">
                    <h4 className="text-sm font-bold text-white mb-4 text-premium">AI Reasoning Presets</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { id: 'fast', name: 'Lightning Fast', desc: 'Prioritizes speed. Uses larger chunks and fewer sources.', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10' },
                        { id: 'balanced', name: 'Balanced Default', desc: 'The optimal mix of speed and accuracy.', icon: Layers, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
                        { id: 'high_accuracy', name: 'High Accuracy', desc: 'Deep analysis. Uses smaller chunks and neural reranking.', icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                        { id: 'deep_analysis', name: 'Maximum Depth', desc: 'Total coverage. Slowest but most comprehensive.', icon: BookOpen, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                      ].map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => updateConfig('tuningPreset', preset.id)}
                          className={`p-4 rounded-xl border text-left flex items-start gap-4 transition-all ${config.tuningPreset === preset.id ? 'bg-white/10 border-white/20 ring-1 ring-white/20' : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800'}`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${preset.bg}`}>
                            <preset.icon className={`w-5 h-5 ${preset.color}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-bold text-white">{preset.name}</span>
                              {config.tuningPreset === preset.id && <Check className="w-4 h-4 text-white" />}
                            </div>
                            <p className="text-xs text-zinc-400">{preset.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8 animate-fade-in">
                    <div>
                      <label className="flex justify-between text-sm font-bold text-white mb-3 text-premium">
                        Detail Level <span className="text-cyan-400">{DETAIL_LEVELS.find(d => d.value === config.chunkSize)?.label || 'Custom'}</span>
                      </label>
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {DETAIL_LEVELS.map(d => (
                          <button key={d.value} onClick={() => { updateConfig('chunkSize', d.value); updateConfig('tuningPreset', null); }}
                            className={`p-2 rounded-xl border text-center transition-all ${config.chunkSize === d.value ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'}`}>
                            <div className="text-xs font-bold">{d.label}</div>
                            <div className="text-[9px] text-zinc-500 mt-0.5">{d.desc}</div>
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Controls how finely your documents are segmented ({config.chunkSize} tokens per chunk)</p>
                    </div>

                    <div className="border-t border-zinc-800 pt-5">
                      <label className="flex justify-between text-sm font-medium text-white mb-2">
                        Number of Sources <span className="text-cyan-400">{config.topK} documents</span>
                      </label>
                      <input
                        type="range"
                        min="1" max="20" step="1"
                        value={config.topK}
                        onChange={(e) => { updateConfig('topK', parseInt(e.target.value)); updateConfig('tuningPreset', null); }}
                        className="w-full accent-cyan-500 bg-zinc-800 h-2 rounded-lg appearance-none cursor-pointer"
                      />
                      <p className="text-xs text-zinc-500 mt-2">How many source documents to consult when answering. More = thorough but slower.</p>
                    </div>

                    <div className="border-t border-zinc-800 pt-5 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">Enable Neural Reranking</div>
                        <div className="text-xs text-zinc-500 mt-1">Improves relevance by cross-encoding queries with retrieved docs.</div>
                      </div>
                      <button
                        onClick={() => { updateConfig('useReranker', !config.useReranker); updateConfig('tuningPreset', null); }}
                        className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${config.useReranker ? 'bg-cyan-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.useReranker ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 8 && (
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
                      className={`p-5 rounded-2xl border flex items-center justify-between transition-all duration-300 glass-morphism ${isActive
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 active'
                        : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10 hover:border-white/10'
                        }`}
                    >
                      <div className="flex-1">
                        <span className="text-sm font-bold text-premium">{feat.name}</span>
                        {feat.desc && <p className="text-[10px] text-zinc-500 mt-0.5">{feat.desc}</p>}
                      </div>
                      <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${isActive ? 'bg-emerald-500 border-emerald-500' : 'border-white/10'}`}>
                        {isActive && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-6 border-t border-white/5">
                <h4 className="text-sm font-semibold text-white mb-4">Bot Theming</h4>
                <div className="flex flex-wrap gap-3">
                  {THEMES.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => updateConfig('theme', theme.id)}
                      className={`flex flex-col items-center gap-1 transition-transform ${config.theme === theme.id ? 'scale-110' : 'hover:scale-105'}`}
                    >
                      <div className={`w-10 h-10 rounded-full transition ${config.theme === theme.id ? 'ring-2 ring-offset-2 ring-offset-zinc-950 ring-white' : ''}`} style={{ backgroundColor: theme.color }} />
                      <span className="text-[9px] text-zinc-500">{theme.name}</span>
                    </button>
                  ))}
                </div>

                {/* Theme Preview Card */}
                <div className="mt-4 p-4 rounded-2xl border border-white/5 glass-morphism" style={{ borderColor: selectedThemeObj?.color + '33' }}>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Preview</div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: selectedThemeObj?.color + '20' }}>
                      <Bot className="w-4 h-4" style={{ color: selectedThemeObj?.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Your RAG Assistant</div>
                      <div className="text-[10px]" style={{ color: selectedThemeObj?.color }}>Online • {selectedThemeObj?.name} Theme</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 9 && (
            <div className="animate-fade-in relative z-10 h-full flex flex-col -mt-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Layers className="w-5 h-5 text-cyan-400" /> Architecture Graph
              </h3>
              <p className="text-sm text-zinc-400 mb-4 shrink-0">Visual summary of your configured multi-agent system.</p>
              <div className="flex-1 min-h-[400px] border border-white/5 rounded-[32px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 shadow-inner bg-black/40 relative glass-morphism">
                <RagVisualizer config={config} />
              </div>
            </div>
          )}

          {step === 10 && (
            <div className="space-y-6 animate-fade-in relative z-10">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
                <Globe className="w-5 h-5 text-cyan-400" /> Deployment Options
              </h3>
              <p className="text-sm text-zinc-400 mb-6">How do you want to interact with your RAG system?</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => updateConfig('deploymentType', 'api')}
                  className={`p-8 rounded-[32px] border text-left flex flex-col items-start transition-all duration-500 glass-card ${config.deploymentType === 'api'
                    ? 'border-cyan-500/50 bg-cyan-500/10 active'
                    : 'border-white/5 hover:border-white/20 hover:bg-white/5'
                    }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/5">
                    <Globe className={`w-7 h-7 ${config.deploymentType === 'api' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  </div>
                  <h4 className="font-bold text-lg text-white mb-2 text-premium">Universal Cloud API</h4>
                  <p className="text-sm text-zinc-500 leading-relaxed">Expose your RAG intelligence via high-performance REST endpoints. Best for web & mobile apps.</p>
                </button>

                <button
                  onClick={() => updateConfig('deploymentType', 'offline')}
                  className={`p-8 rounded-[32px] border text-left flex flex-col items-start transition-all duration-500 glass-card ${config.deploymentType === 'offline'
                    ? 'border-purple-500/50 bg-purple-500/10 active'
                    : 'border-white/5 hover:border-white/20 hover:bg-white/5'
                    }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/5">
                    <Code className={`w-7 h-7 ${config.deploymentType === 'offline' ? 'text-purple-400' : 'text-zinc-500'}`} />
                  </div>
                  <h4 className="font-bold text-lg text-white mb-2 text-premium">Offline Edge Binary</h4>
                  <p className="text-sm text-zinc-500 leading-relaxed">Serialize the Haystack pipeline for air-gapped deployment on local servers or edge devices.</p>
                </button>
                <button
                  onClick={() => updateConfig('deploymentType', 'hybrid')}
                  className={`p-8 rounded-[32px] border text-left flex flex-col items-start transition-all duration-500 glass-card sm:col-span-2 ${config.deploymentType === 'hybrid'
                    ? 'border-emerald-500/50 bg-emerald-500/10 active'
                    : 'border-white/5 hover:border-white/20 hover:bg-white/5'
                    }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/5">
                    <Zap className={`w-7 h-7 ${config.deploymentType === 'hybrid' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  </div>
                  <h4 className="font-bold text-lg text-white mb-2 text-premium">Hybrid Deployment</h4>
                  <p className="text-sm text-zinc-500 leading-relaxed">Deploy both Cloud API endpoints AND an offline package. Maximum flexibility for any environment.</p>
                </button>
              </div>
            </div>
          )}

          {step === 11 && (
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
                    <div className="flex gap-4 w-full pt-8">
                      <button onClick={() => window.open(`/chat/${deployData.deployment_info?.pipeline_id}`, '_blank')} className="flex-1 px-8 py-5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 rounded-[20px] font-bold text-white shadow-xl shadow-cyan-500/20 hover:scale-[1.02] transition-all duration-300 hover:glow-cyan active:scale-95">
                        Launch Standalone Experience
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        {(step < 11) && (
          <div className="p-6 border-t border-white/5 bg-zinc-950 flex items-center justify-between z-20 shrink-0 relative">
            {isIngesting && (
              <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm z-10 flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-cyan-400 font-medium text-sm">Processing & Storing Knowledge...</span>
              </div>
            )}
            <button
              onClick={() => step > 1 && setStep(step - 1)}
              className={`text-sm font-medium ${step === 1 ? 'opacity-0 pointer-events-none' : 'text-zinc-400 hover:text-white transition'}`}
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={isIngesting || (step === 1 && !config.ragName)}
              className={`px-6 py-2.5 bg-white hover:bg-zinc-200 text-black font-semibold rounded-full flex items-center gap-2 transition active:scale-95 disabled:opacity-50`}
            >
              {step === 10 ? 'Initialize Deployment' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {(step === 11 && !isDeploying) && (
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
