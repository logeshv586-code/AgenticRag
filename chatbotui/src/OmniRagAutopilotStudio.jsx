import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, Bot, Brain, Check, Cloud, Cpu, Database, Eye, FileText,
  Globe2, HardDrive, Loader2, Menu, MessageCircle, Palette, Paperclip, RefreshCw,
  Search, Send, ShieldCheck, Sparkles, Volume2, Workflow, X, Zap,
} from 'lucide-react';
import { API_BASE_URL } from './config';

const RAGS = [
  { id: 'auto', label: 'Auto · AI chooses', icon: Sparkles, summary: 'Describe the outcome. AI selects the best supported architecture.' },
  { id: 'basic', label: 'Universal RAG', icon: Search, summary: 'Dense-first retrieval with lexical fallback.' },
  { id: 'hybrid', label: 'Hybrid Search RAG', icon: Database, summary: 'BM25 + dense retrieval with reciprocal-rank fusion.' },
  { id: 'citation', label: 'Verified Citation RAG', icon: ShieldCheck, summary: 'Source-labelled evidence and citation-constrained answers.' },
  { id: 'realtime', label: 'Realtime RAG', icon: Zap, summary: 'Freshness-aware retrieval for continuously changing sources.' },
  { id: 'personalized', label: 'Personalized RAG', icon: Bot, summary: 'Profile-aware query expansion without overriding source truth.' },
  { id: 'multimodal', label: 'Multimodal RAG', icon: Eye, summary: 'Text + image vision/OCR + audio transcript retrieval.' },
  { id: 'conversational', label: 'Conversational RAG', icon: MessageCircle, summary: 'Grounded conversation memory across follow-up questions.' },
  { id: 'agentic', label: 'Agentic RAG', icon: Brain, summary: 'Retrieval-first planning, safe tools and answer verification.' },
  { id: 'structured', label: 'Graph / Structured RAG', icon: Workflow, summary: 'Entity extraction, graph traversal and document retrieval.' },
  { id: 'crosslingual', label: 'Cross-lingual RAG', icon: Globe2, summary: 'Detect → translate → retrieve → answer → translate back.' },
  { id: 'voice', label: 'Voice RAG', icon: Volume2, summary: 'Speech-to-text → grounded retrieval → spoken response.' },
];

const PROFILES = {
  basic: { preset: 'balanced', features: ['citations', 'hallucinationGuard'], reranker: true },
  hybrid: { preset: 'high_accuracy', features: ['citations', 'hallucinationGuard', 'explainability'], reranker: true },
  citation: { preset: 'high_accuracy', features: ['citations', 'hallucinationGuard', 'explainability'], reranker: true },
  realtime: { preset: 'balanced', features: ['citations', 'streamingResponse'], reranker: false },
  personalized: { preset: 'balanced', features: ['citations', 'hallucinationGuard'], reranker: true },
  multimodal: { preset: 'high_accuracy', features: ['citations', 'hallucinationGuard'], reranker: true },
  conversational: { preset: 'high_accuracy', features: ['citations', 'hallucinationGuard', 'streamingResponse'], reranker: true },
  agentic: { preset: 'high_accuracy', features: ['citations', 'hallucinationGuard', 'explainability'], reranker: true },
  structured: { preset: 'high_accuracy', features: ['citations', 'hallucinationGuard', 'explainability'], reranker: true },
  crosslingual: { preset: 'balanced', features: ['multilingual', 'citations', 'hallucinationGuard'], reranker: true },
  voice: { preset: 'balanced', features: ['voice', 'citations', 'hallucinationGuard'], reranker: false },
};

const EXAMPLES = [
  'Create a support RAG from our website and manuals. Keep it automatically updated and cite the source.',
  'Build a research agent that uses our documents, calculations and current website information.',
  'Create a multilingual assistant for English, Tamil and Hindi and remember follow-up questions.',
];

const TYPE_PATTERN = /\b(basic|hybrid|citation|realtime|personalized|multimodal|conversational|agentic|structured|crosslingual|voice)\b/i;

const THEMES = {
  cyan: { name: 'Neural Cyan', accent: '#22d3ee', glow: 'rgba(34,211,238,.28)' },
  violet: { name: 'Quantum Violet', accent: '#8b5cf6', glow: 'rgba(139,92,246,.28)' },
  emerald: { name: 'Signal Emerald', accent: '#10b981', glow: 'rgba(16,185,129,.24)' },
  rose: { name: 'Pulse Rose', accent: '#fb7185', glow: 'rgba(251,113,133,.24)' },
};

function safeName(text) {
  const cleaned = String(text || '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return cleaned || 'customer-rag';
}

function autoName(text) {
  return safeName(String(text || '').split(/\s+/).slice(0, 6).join('-'));
}

function metaFor(id) {
  return RAGS.find(item => item.id === id) || RAGS[0];
}

async function responseText(response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const data = await response.json();
    return data.answer || data.message || '';
  }
  return response.text();
}

function ToggleCard({ checked, onChange, label, description, icon: Icon = RefreshCw }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`group w-full rounded-2xl border p-4 text-left transition-all duration-300 ${checked ? 'border-cyan-400/30 bg-cyan-400/[0.07] shadow-[0_0_30px_rgba(34,211,238,.06)]' : 'border-white/[0.08] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.04]'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${checked ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' : 'border-white/10 bg-white/5 text-zinc-500'}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{label}</div>
            <div className="mt-1 text-xs leading-5 text-zinc-500">{description}</div>
          </div>
        </div>
        <span className={`mt-1 h-6 w-11 shrink-0 rounded-full border p-0.5 transition ${checked ? 'border-cyan-300/30 bg-cyan-400' : 'border-white/10 bg-zinc-800'}`}>
          <span className={`block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
        </span>
      </div>
    </button>
  );
}

function Metric({ label, value, highlight = false }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">{label}</div>
      <div className={`mt-2 truncate text-sm font-semibold ${highlight ? 'text-cyan-300' : 'text-zinc-200'}`}>{value}</div>
    </div>
  );
}

function NavLink({ href, children }) {
  return <a href={href} className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500 transition hover:text-white">{children}</a>;
}

export default function OmniRagAutopilotStudio() {
  const [selectedType, setSelectedType] = useState('auto');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Tell me the business outcome you want. I will choose the RAG, explain why, build it from trusted knowledge, validate it, and keep approved sources learning over time.' },
  ]);
  const [plan, setPlan] = useState(null);
  const [ragName, setRagName] = useState('customer-rag');
  const [urls, setUrls] = useState(['']);
  const [files, setFiles] = useState([]);
  const [watchedFolders, setWatchedFolders] = useState('');
  const [profileRole, setProfileRole] = useState('');
  const [profileAudience, setProfileAudience] = useState('');
  const [storage, setStorage] = useState('local');
  const [qdrantUrl, setQdrantUrl] = useState('');
  const [qdrantKey, setQdrantKey] = useState('');
  const [autopilotEnabled, setAutopilotEnabled] = useState(true);
  const [visionEnabled, setVisionEnabled] = useState(true);
  const [architectureEvolution, setArchitectureEvolution] = useState(true);
  const [crawlMode, setCrawlMode] = useState('dynamic');
  const [intervalSeconds, setIntervalSeconds] = useState(900);
  const [analyzing, setAnalyzing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState(null);
  const [validation, setValidation] = useState(null);
  const [monitor, setMonitor] = useState(null);
  const [error, setError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [themeKey, setThemeKey] = useState('cyan');
  const fileRef = useRef(null);

  const validUrls = useMemo(() => urls.map(value => value.trim()).filter(Boolean), [urls]);
  const folders = useMemo(() => watchedFolders.split(/[\n,]+/).map(value => value.trim()).filter(Boolean), [watchedFolders]);
  const hasKnowledge = validUrls.length > 0 || files.length > 0 || folders.length > 0;
  const hasLiveSources = validUrls.length > 0 || folders.length > 0;
  const pipelineId = result?.pipeline_id || result?.deployment_info?.pipeline_id;
  const theme = THEMES[themeKey];

  useEffect(() => {
    document.documentElement.style.setProperty('--current-accent', theme.accent);
    document.documentElement.style.setProperty('--accent-glow', theme.glow);
    document.documentElement.style.setProperty('--orb-color', theme.accent);
    document.body.style.backgroundColor = '#020508';
  }, [theme]);

  useEffect(() => {
    if (!pipelineId) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/visualize/${pipelineId}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data.metadata?.autopilot) setMonitor(data.metadata.autopilot);
      } catch {
        // Keep the built RAG available even when the observability endpoint is temporarily unreachable.
      }
    };
    poll();
    const timer = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pipelineId]);

  const analyze = async (raw = input) => {
    const request = String(raw || '').trim();
    if (!request || analyzing) return;
    setAnalyzing(true);
    setError('');
    setResult(null);
    setValidation(null);
    setMonitor(null);
    setMessages(previous => [...previous, { role: 'user', text: request }]);
    setInput('');

    let type = selectedType;
    let mode = selectedType === 'auto' ? 'model' : 'customer-selected';
    try {
      if (selectedType === 'auto') {
        const prompt = `Choose exactly one RAG architecture id for this customer request. Return only one id: basic, hybrid, citation, realtime, personalized, multimodal, conversational, agentic, structured, crosslingual, voice.\nCustomer request: ${request}`;
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: prompt }),
        });
        if (response.ok) {
          const answer = await responseText(response);
          const match = answer.match(TYPE_PATTERN);
          if (match) type = match[1].toLowerCase();
        }
      }

      const explicit = type !== 'auto' && PROFILES[type];
      const deployType = explicit ? type : `auto::${request}`;
      const shownType = explicit ? type : 'auto';
      if (!explicit) mode = 'backend-auto-fallback';
      setPlan({ request, deployType, shownType, mode });
      if (ragName === 'customer-rag') setRagName(autoName(request));
      const architecture = metaFor(shownType);
      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          text: explicit
            ? `I selected ${architecture.label}. ${architecture.summary} Add trusted knowledge below; I will build it, run a grounded validation query, and keep monitored sources fresh.`
            : 'The guide model did not return a valid architecture id, so the backend will classify your original request against the supported RAG catalog before build.',
        },
      ]);
    } catch {
      setPlan({ request, deployType: `auto::${request}`, shownType: 'auto', mode: 'backend-auto-fallback' });
      setMessages(previous => [
        ...previous,
        { role: 'assistant', text: 'The guide model is unavailable. The backend deterministic classifier will still choose only from supported RAG architectures.' },
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  const buildConfig = () => {
    const explicit = plan && PROFILES[plan.deployType] ? plan.deployType : null;
    const profile = explicit ? PROFILES[explicit] : { preset: 'balanced', features: [], reranker: true };
    const currentProfile = {};
    if (profileRole.trim()) currentProfile.role = profileRole.trim();
    if (profileAudience.trim()) currentProfile.audience = profileAudience.trim();

    return {
      ragName: safeName(ragName),
      extracted_texts: [],
      ragType: plan.deployType,
      dbType: storage === 'local' ? 'local' : 'cloud',
      cloudDb: storage === 'cloud' ? 'qdrant' : '',
      localDb: 'chroma',
      dynamicConfig: {
        citationStyle: 'inline',
        historyLength: 10,
        refreshInterval: intervalSeconds,
        modalities: ['text', 'images', 'audio'],
        sourceLanguage: 'auto',
        targetLanguage: 'English',
        voiceLanguage: 'en-US',
        profileFields: ['role', 'audience'],
        currentProfile,
        entityTypes: ['PERSON', 'ORG', 'GPE', 'CONCEPT'],
        relationshipDepth: 2,
        tools: explicit === 'agentic' ? ['Calculator', 'Calendar', 'Web Search'] : [],
        maxReasoningSteps: 5,
        qdrantUrl: storage === 'cloud' ? qdrantUrl.trim() : '',
        autopilot: {
          enabled: Boolean(autopilotEnabled && hasLiveSources),
          intervalSeconds,
          vision: visionEnabled,
          allowArchitectureEvolution: architectureEvolution,
          watchedFolders: folders,
          sources: validUrls.map(url => ({
            url,
            mode: crawlMode,
            maxPages: crawlMode === 'dynamic' ? 50 : 1,
            vision: visionEnabled,
          })),
        },
      },
      llmModel: 'qwen-local',
      embeddingModel: 'bge-local',
      chunkSize: explicit === 'structured' || explicit === 'multimodal' ? 500 : 700,
      topK: 6,
      useReranker: profile.reranker,
      theme: themeKey,
      features: profile.features,
      deploymentType: 'api',
      apiKeys: storage === 'cloud' && qdrantKey ? { qdrant: qdrantKey } : {},
      privacyMode: storage === 'local',
      explainability: profile.features.includes('explainability'),
      scrapeMode: crawlMode,
      tuningPreset: profile.preset,
      hallucinationGuard: profile.features.includes('hallucinationGuard'),
      toxicityFilter: false,
      structuredOutput: false,
      streamingResponse: profile.features.includes('streamingResponse'),
    };
  };

  const build = async () => {
    if (!plan) {
      setError('Describe what you want first so the architecture can be selected.');
      return;
    }
    if (!hasKnowledge) {
      setError('Add a website, upload a file, or provide a watched customer-server folder.');
      return;
    }
    if (storage === 'cloud' && !qdrantUrl.trim()) {
      setError('Cloud Qdrant needs a cluster URL.');
      return;
    }

    setBuilding(true);
    setError('');
    setResult(null);
    setValidation(null);
    const config = buildConfig();

    try {
      if (validUrls.length) {
        setStage(crawlMode === 'dynamic' ? 'Crawling approved website knowledge' : 'Reading approved website');
        const response = await fetch(`${API_BASE_URL}/api/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ragName: config.ragName, urls: validUrls, mode: crawlMode }),
        });
        if (!response.ok) throw new Error(`Website ingestion failed (${response.status})`);
      }

      for (const file of files) {
        setStage(`Extracting ${file.name}`);
        const body = new FormData();
        body.append('file', file);
        body.append('ragName', config.ragName);
        const response = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body });
        if (!response.ok) throw new Error(`Could not process ${file.name}`);
      }

      setStage('Building retrieval + generation pipeline');
      const deploy = await fetch(`${API_BASE_URL}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!deploy.ok) throw new Error(`RAG build failed (${deploy.status}): ${await deploy.text()}`);

      const data = await deploy.json();
      setResult(data);
      setMonitor(data.deployment_info?.autopilot || null);
      const id = data.pipeline_id || data.deployment_info?.pipeline_id;

      if (id) {
        setStage('Running grounded validation query');
        const check = await fetch(`${API_BASE_URL}/api/test-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pipeline_id: id,
            query: 'Summarize what this knowledge base contains. Use only retrieved evidence and cite source IDs when available.',
          }),
        });
        if (check.ok) {
          const output = await check.json();
          const answer = String(output.answer || '').trim();
          const passed = Boolean(answer) && !answer.startsWith('⚠️') && !answer.toLowerCase().includes('pipeline not found');
          setValidation({ passed, answer: answer.slice(0, 700) });
        } else {
          setValidation({ passed: false, answer: `Validation returned HTTP ${check.status}` });
        }
      }

      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          text: `Build complete. ${data.deployment_info?.type || 'The selected RAG'} is live${data.deployment_info?.autopilot?.enabled ? ' with self-learning Autopilot monitoring enabled' : ''}.`,
        },
      ]);
    } catch (buildError) {
      const message = buildError?.message || 'Build failed.';
      setError(message);
      setMessages(previous => [...previous, { role: 'assistant', text: `Build stopped: ${message}` }]);
    } finally {
      setBuilding(false);
      setStage('');
    }
  };

  const planMeta = metaFor(plan?.shownType || selectedType);
  const PlanIcon = planMeta.icon;
  const monitorState = monitor?.state || (autopilotEnabled && hasLiveSources ? 'ready-to-monitor' : 'static');
  const sourceCount = monitor?.source_count ?? (validUrls.length + folders.length);
  const personalizationVisible = plan?.shownType === 'personalized' || selectedType === 'personalized';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020508] text-zinc-100 selection:bg-cyan-400/30">
      <div className="aurora-container pointer-events-none fixed inset-0">
        <div className="aurora-orb orb-1" />
        <div className="aurora-orb orb-2" />
      </div>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(34,211,238,.08),transparent_32%),linear-gradient(to_bottom,rgba(2,5,8,.18),rgba(2,5,8,.94))]" />

      <nav className="relative z-40 mx-auto flex max-w-7xl items-center justify-between px-5 pb-3 pt-6 sm:px-7 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300 shadow-[0_0_35px_rgba(34,211,238,.12)]">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="font-['Syne'] text-lg font-bold tracking-tight text-white">OmniRAG Engine</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Autopilot Studio</div>
          </div>
        </div>

        <div className="hidden items-center gap-7 md:flex">
          <NavLink href="#architect">Architect</NavLink>
          <NavLink href="#knowledge">Knowledge</NavLink>
          <NavLink href="#autopilot">Self-Learning</NavLink>
          <a href="/advanced" className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300 transition hover:border-cyan-300/30 hover:text-white">Full Engine</a>
        </div>

        <button type="button" onClick={() => setMobileMenu(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 md:hidden">
          <Menu className="h-5 w-5" />
        </button>
      </nav>

      <div className={`fixed inset-0 z-50 transition ${mobileMenu ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button type="button" aria-label="Close menu" onClick={() => setMobileMenu(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className={`absolute right-0 top-0 h-full w-72 border-l border-white/10 bg-[#061018]/95 p-6 backdrop-blur-2xl transition-transform ${mobileMenu ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between">
            <div className="font-['Syne'] font-bold">OmniRAG Engine</div>
            <button type="button" onClick={() => setMobileMenu(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-zinc-400"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-10 flex flex-col gap-6">
            <a href="#architect" onClick={() => setMobileMenu(false)} className="text-sm font-semibold text-zinc-300">AI Architect</a>
            <a href="#knowledge" onClick={() => setMobileMenu(false)} className="text-sm font-semibold text-zinc-300">Knowledge</a>
            <a href="#autopilot" onClick={() => setMobileMenu(false)} className="text-sm font-semibold text-zinc-300">Self-Learning</a>
            <a href="/starter" className="text-sm font-semibold text-zinc-300">Starter</a>
            <a href="/advanced" className="text-sm font-semibold text-cyan-300">Full Engine</a>
          </div>
        </div>
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-9 sm:px-7 lg:px-8">
        <header className="mb-10 grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-4xl animate-fade-in-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
              Self-developing RAG · Production controls
            </div>
            <h1 className="font-['Syne'] text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              Build the RAG. <span className="shimmer-text">Keep it learning.</span>
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-500 sm:text-base">
              The same OmniRAG Engine visual system, now with chat-first architecture selection, trusted knowledge ingestion, live validation, visual intelligence and safe automatic re-indexing when customer knowledge changes.
            </p>
          </div>

          <div className="glass-panel flex items-center gap-2 rounded-full p-2">
            <Palette className="ml-2 h-4 w-4 text-zinc-500" />
            {Object.entries(THEMES).map(([key, item]) => (
              <button
                key={key}
                type="button"
                title={item.name}
                aria-label={item.name}
                onClick={() => setThemeKey(key)}
                className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${themeKey === key ? 'border-white' : 'border-transparent'}`}
                style={{ background: item.accent, boxShadow: themeKey === key ? `0 0 18px ${item.glow}` : 'none' }}
              />
            ))}
          </div>
        </header>

        <section id="architect" className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,.55fr)]">
          <div className="glass-panel overflow-hidden rounded-[32px] border border-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,.35)]">
            <div className="border-b border-white/[0.06] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">AI RAG Architect</div>
                  <h2 className="mt-2 font-['Syne'] text-2xl font-bold text-white sm:text-3xl">Tell OmniRAG what the customer needs.</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">No RAG terminology required. Auto mode can select only architectures the backend can actually build.</p>
                </div>
                <select
                  value={selectedType}
                  onChange={event => setSelectedType(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-200 outline-none transition focus:border-cyan-300/40"
                >
                  {RAGS.map(item => <option key={item.id} value={item.id} className="bg-zinc-950">{item.label}</option>)}
                </select>
              </div>
            </div>

            <div className="scrollbar-premium max-h-[360px] min-h-[240px] space-y-4 overflow-y-auto p-5 sm:p-6">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-2xl border px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-50' : 'border-white/[0.07] bg-white/[0.035] text-zinc-300'}`}>
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/[0.06] p-4 sm:p-5">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-premium">
                {EXAMPLES.map(example => (
                  <button key={example} type="button" onClick={() => analyze(example)} className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] text-zinc-500 transition hover:border-cyan-300/30 hover:text-zinc-300">
                    {example.slice(0, 48)}…
                  </button>
                ))}
              </div>
              <div className="flex gap-2 rounded-[22px] border border-white/[0.08] bg-black/25 p-2 transition focus-within:border-cyan-300/30 focus-within:shadow-[0_0_30px_rgba(34,211,238,.06)]">
                <textarea
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      analyze();
                    }
                  }}
                  rows={2}
                  placeholder="Example: Build a support assistant from our website and PDFs, cite answers and keep itself updated."
                  className="min-h-[58px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => analyze()}
                  disabled={analyzing || !input.trim()}
                  className="grid w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-500 text-black shadow-[0_0_30px_rgba(34,211,238,.18)] transition hover:scale-[1.02] disabled:opacity-30"
                >
                  {analyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="glass-card rounded-[28px] p-5">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
                  <PlanIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Selected architecture</div>
                  <div className="mt-1 text-lg font-semibold text-white">{planMeta.label}</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">{planMeta.summary}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric label="Selection" value={plan?.mode || 'Waiting for request'} />
                <Metric label="Build state" value={building ? 'Building' : result ? 'Live' : 'Ready'} highlight={Boolean(result)} />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-cyan-300/15 bg-gradient-to-b from-cyan-300/[0.08] to-white/[0.02] p-5 shadow-[0_0_60px_rgba(34,211,238,.05)]">
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl" />
              <div className="relative flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">RAG Autopilot</div>
                  <div className="mt-1 font-['Syne'] text-xl font-bold text-white">{monitorState}</div>
                </div>
                <Activity className={`h-5 w-5 ${monitorState === 'fresh' ? 'text-emerald-400' : 'text-cyan-300'}`} />
              </div>
              <div className="relative mt-4 grid grid-cols-2 gap-2">
                <Metric label="Generation" value={monitor?.generation ?? 0} />
                <Metric label="Sources" value={sourceCount} />
                <Metric label="Last update" value={monitor?.last_update || 'After first change'} />
                <Metric label="Vision" value={visionEnabled ? 'Enabled' : 'Off'} highlight={visionEnabled} />
              </div>
              {monitor?.last_error && <div className="relative mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-3 text-xs leading-5 text-rose-200">{monitor.last_error}</div>}
            </div>
          </aside>
        </section>

        <section id="knowledge" className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="glass-panel rounded-[30px] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Knowledge</div>
                <h2 className="mt-1 font-['Syne'] text-2xl font-bold text-white">What should this RAG learn?</h2>
                <p className="mt-2 text-xs leading-5 text-zinc-500">Websites, documents and approved server folders become the grounded source of truth.</p>
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-cyan-300/30 hover:text-white">
                <Paperclip className="mr-2 inline h-4 w-4" />Upload
              </button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={event => setFiles(Array.from(event.target.files || []))} />
            </div>

            <div className="mt-5 space-y-2">
              {urls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-zinc-600"><Globe2 className="h-4 w-4" /></span>
                  <input
                    value={url}
                    onChange={event => setUrls(previous => previous.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                    placeholder="https://customer-site.com"
                    className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-cyan-300/30"
                  />
                  {index === urls.length - 1 && (
                    <button type="button" onClick={() => setUrls(previous => [...previous, ''])} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-400 transition hover:border-cyan-300/30 hover:text-cyan-300">+</button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold text-zinc-500">Watched folder on the customer server <span className="font-normal text-zinc-700">(optional)</span></label>
              <textarea
                value={watchedFolders}
                onChange={event => setWatchedFolders(event.target.value)}
                rows={2}
                placeholder="C:\\CompanyKnowledge\\ApprovedDocs or /srv/company/knowledge"
                className="mt-2 w-full resize-none rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-cyan-300/30"
              />
            </div>

            {files.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {files.map(file => (
                  <span key={`${file.name}-${file.size}`} className="rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-[11px] text-zinc-400">
                    <FileText className="mr-1.5 inline h-3.5 w-3.5 text-cyan-300" />{file.name}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold text-zinc-500">RAG name</label>
                <input value={ragName} onChange={event => setRagName(safeName(event.target.value))} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-cyan-300/30" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-500">Website mode</label>
                <select value={crawlMode} onChange={event => setCrawlMode(event.target.value)} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-cyan-300/30">
                  <option value="dynamic" className="bg-zinc-950">Full site · up to 50 pages</option>
                  <option value="static" className="bg-zinc-950">Single page</option>
                </select>
              </div>
            </div>

            {personalizationVisible && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-violet-400/15 bg-violet-400/[0.05] p-4 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-500">User role context</label>
                  <input value={profileRole} onChange={event => setProfileRole(event.target.value)} placeholder="Sales manager" className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-sm text-zinc-200 outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-500">Audience context</label>
                  <input value={profileAudience} onChange={event => setProfileAudience(event.target.value)} placeholder="Enterprise customers" className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-sm text-zinc-200 outline-none" />
                </div>
              </div>
            )}
          </div>

          <div id="autopilot" className="glass-panel rounded-[30px] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Self-developing controls</div>
                <h2 className="mt-1 font-['Syne'] text-2xl font-bold text-white">Keep knowledge and retrieval improving.</h2>
                <p className="mt-2 text-xs leading-5 text-zinc-500">Monitor approved sources, rebuild only when content changes, and let architecture evolve only inside supported safe boundaries.</p>
              </div>
              <RefreshCw className={`mt-1 h-5 w-5 shrink-0 text-cyan-300 ${building ? 'animate-spin' : ''}`} />
            </div>

            <div className="mt-5 space-y-3">
              <ToggleCard
                checked={autopilotEnabled}
                onChange={setAutopilotEnabled}
                label="Continuous source monitoring"
                description="Fingerprint websites and folders, detect additions/changes/removals, and re-index only when knowledge actually changes."
                icon={RefreshCw}
              />
              <ToggleCard
                checked={visionEnabled}
                onChange={setVisionEnabled}
                label="Visual change intelligence"
                description="Capture rendered pages and use local vision/OCR so charts, screenshots and visual content can enter the RAG."
                icon={Eye}
              />
              <ToggleCard
                checked={architectureEvolution}
                onChange={setArchitectureEvolution}
                label="Allow safe architecture evolution"
                description="Autopilot may move a basic RAG to realtime or multimodal when monitored evidence proves the architecture needs it."
                icon={Sparkles}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-zinc-300">Refresh cadence</div>
                  <div className="mt-1 text-[11px] text-zinc-600">How often Autopilot checks approved live sources.</div>
                </div>
                <select value={intervalSeconds} onChange={event => setIntervalSeconds(Number(event.target.value))} className="rounded-xl border border-white/[0.08] bg-zinc-950 px-3 py-2 text-xs text-zinc-300 outline-none">
                  <option value={300}>5 min</option>
                  <option value={900}>15 min</option>
                  <option value={1800}>30 min</option>
                  <option value={3600}>1 hour</option>
                  <option value={21600}>6 hours</option>
                  <option value={86400}>24 hours</option>
                </select>
              </div>
              {!hasLiveSources && autopilotEnabled && <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-[11px] leading-5 text-amber-200/80">Continuous learning starts after you add at least one website or watched folder. File uploads remain valid static knowledge.</div>}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
          <div className="glass-card rounded-[28px] p-5 sm:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Storage</div>
            <h3 className="mt-1 font-['Syne'] text-xl font-bold text-white">Where should knowledge live?</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button type="button" onClick={() => setStorage('local')} className={`rounded-2xl border p-4 text-left transition ${storage === 'local' ? 'border-cyan-300/30 bg-cyan-300/[0.07]' : 'border-white/[0.08] bg-white/[0.025]'}`}>
                <HardDrive className={`h-5 w-5 ${storage === 'local' ? 'text-cyan-300' : 'text-zinc-500'}`} />
                <div className="mt-3 text-sm font-semibold text-white">Private local</div>
                <div className="mt-1 text-[11px] leading-5 text-zinc-600">Chroma on the customer environment.</div>
              </button>
              <button type="button" onClick={() => setStorage('cloud')} className={`rounded-2xl border p-4 text-left transition ${storage === 'cloud' ? 'border-violet-300/30 bg-violet-300/[0.07]' : 'border-white/[0.08] bg-white/[0.025]'}`}>
                <Cloud className={`h-5 w-5 ${storage === 'cloud' ? 'text-violet-300' : 'text-zinc-500'}`} />
                <div className="mt-3 text-sm font-semibold text-white">Qdrant cloud</div>
                <div className="mt-1 text-[11px] leading-5 text-zinc-600">Managed vector storage for scale.</div>
              </button>
            </div>
            {storage === 'cloud' && (
              <div className="mt-4 space-y-2">
                <input value={qdrantUrl} onChange={event => setQdrantUrl(event.target.value)} placeholder="https://cluster.qdrant.io" className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-700" />
                <input type="password" value={qdrantKey} onChange={event => setQdrantKey(event.target.value)} placeholder="Qdrant API key" className="w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-700" />
                <div className="text-[10px] leading-4 text-zinc-700">The key is sent only with the deployment request and is not intended for persisted customer metadata.</div>
              </div>
            )}
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#071019]/85 p-5 shadow-[0_30px_100px_rgba(0,0,0,.28)] backdrop-blur-xl sm:p-6">
            <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-cyan-300/[0.05] blur-3xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Build + validate</div>
                <h3 className="mt-1 font-['Syne'] text-2xl font-bold text-white">Create the production pipeline.</h3>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-500">Ingest trusted data, deploy the selected architecture, run a grounded test query, then start Autopilot monitoring for approved live sources.</p>
              </div>
              <button
                type="button"
                onClick={build}
                disabled={building || !plan || !hasKnowledge}
                className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-300 to-blue-500 px-6 py-3 text-xs font-extrabold uppercase tracking-[0.14em] text-black shadow-[0_0_35px_rgba(34,211,238,.2)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-30"
              >
                {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {building ? 'Building' : 'Build RAG'}
              </button>
            </div>

            <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Architecture" value={planMeta.label} />
              <Metric label="Knowledge" value={`${validUrls.length} web · ${files.length} files · ${folders.length} folders`} />
              <Metric label="Autopilot" value={autopilotEnabled && hasLiveSources ? `Every ${Math.round(intervalSeconds / 60)} min` : 'Static'} highlight={autopilotEnabled && hasLiveSources} />
            </div>

            {(building || stage) && (
              <div className="relative mt-5 overflow-hidden rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
                <div className="absolute inset-y-0 left-0 w-1/3 animate-pulse bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent" />
                <div className="relative flex items-center gap-3 text-sm text-cyan-100"><Loader2 className="h-4 w-4 animate-spin text-cyan-300" />{stage || 'Preparing pipeline'}</div>
              </div>
            )}

            {error && <div className="relative mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-4 text-sm leading-6 text-rose-200">{error}</div>}

            {result && (
              <div className="relative mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="h-4 w-4" /></span>
                    <div>
                      <div className="text-sm font-semibold text-emerald-100">Pipeline live</div>
                      <div className="mt-0.5 max-w-xl break-all text-[11px] text-emerald-200/60">{pipelineId || 'Deployment returned without a pipeline id'}</div>
                    </div>
                  </div>
                  {pipelineId && <a href={`/chat/${pipelineId}`} className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-200">Open test chat <ArrowRight className="h-3.5 w-3.5" /></a>}
                </div>
              </div>
            )}

            {validation && (
              <div className={`relative mt-4 rounded-2xl border p-4 ${validation.passed ? 'border-cyan-300/15 bg-cyan-300/[0.05]' : 'border-amber-300/15 bg-amber-300/[0.05]'}`}>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                  {validation.passed ? <ShieldCheck className="h-4 w-4 text-cyan-300" /> : <Activity className="h-4 w-4 text-amber-300" />}
                  Grounded validation · {validation.passed ? 'Passed' : 'Needs attention'}
                </div>
                <div className="mt-3 max-h-32 overflow-y-auto text-xs leading-6 text-zinc-500 scrollbar-premium">{validation.answer}</div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Changed-only ingestion', 'Content hashes prevent wasteful rebuilds when monitored knowledge did not actually change.'],
            ['Blue / green generations', 'New knowledge generations can be built and promoted while preserving the last-known-good pipeline.'],
            ['Restart recovery', 'Autopilot state can be rehydrated after service restarts instead of forgetting monitored sources.'],
            ['Safe evolution', 'Architecture changes stay inside the supported RAG catalog instead of inventing unavailable runtime behavior.'],
          ].map(([title, description], index) => (
            <div key={title} className="glass-card rounded-[24px] p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/70">0{index + 1}</div>
              <div className="mt-3 text-sm font-semibold text-zinc-200">{title}</div>
              <div className="mt-2 text-[11px] leading-5 text-zinc-600">{description}</div>
            </div>
          ))}
        </section>

        <footer className="mt-12 flex flex-col gap-4 border-t border-white/[0.06] py-8 text-[11px] text-zinc-700 sm:flex-row sm:items-center sm:justify-between">
          <div>© 2026 OmniRAG Engine · Self-developing retrieval infrastructure</div>
          <div className="flex flex-wrap gap-5">
            <a href="/starter" className="transition hover:text-zinc-400">Starter</a>
            <a href="/advanced" className="transition hover:text-zinc-400">Full Engine</a>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Runtime controls connected</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
