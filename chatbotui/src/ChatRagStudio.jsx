import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, Bot, Brain, Check, Cloud, Database, Eye, FileText,
  Globe2, HardDrive, Loader2, MessageCircle, Paperclip, RefreshCw, Search,
  Send, ShieldCheck, Sparkles, Volume2, Workflow, Zap
} from 'lucide-react';
import { API_BASE_URL } from './config';

const RAGS = [
  { id: 'auto', label: 'Auto · AI chooses', icon: Sparkles, summary: 'Describe the outcome. AI selects the best supported architecture.' },
  { id: 'basic', label: 'Universal RAG', icon: Search, summary: 'Dense-first retrieval with lexical fallback.' },
  { id: 'hybrid', label: 'Hybrid Search RAG', icon: Database, summary: 'Real BM25 + dense retrieval with reciprocal-rank fusion.' },
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

const TYPE_PATTERN = /\b(basic|hybrid|citation|realtime|personalized|multimodal|conversational|agentic|structured|crosslingual|voice)\b/i;
const EXAMPLES = [
  'Create a support RAG from our website and manuals. Keep it automatically updated and cite the source.',
  'Build a research agent that uses our documents, calculations and current website information.',
  'Create a multilingual assistant for English, Tamil and Hindi and remember follow-up questions.',
];

function safeName(text) {
  const cleaned = text.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return cleaned || 'customer-rag';
}

function autoName(text) {
  return safeName(text.split(/\s+/).slice(0, 6).join('-'));
}

function metaFor(id) {
  return RAGS.find(x => x.id === id) || RAGS[0];
}

async function responseText(response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const data = await response.json();
    return data.answer || data.message || '';
  }
  return response.text();
}

function Toggle({ checked, onChange, label, description, icon: Icon = RefreshCw }) {
  return <button type="button" onClick={() => onChange(!checked)} className={`w-full rounded-2xl border p-3 text-left transition ${checked ? 'border-indigo-200 bg-indigo-50/70' : 'border-zinc-200 bg-white'}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex gap-3">
        <span className={`mt-0.5 grid h-8 w-8 place-items-center rounded-xl ${checked ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}><Icon className="h-4 w-4" /></span>
        <div><div className="text-sm font-semibold">{label}</div><div className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</div></div>
      </div>
      <span className={`mt-1 h-5 w-9 rounded-full p-0.5 ${checked ? 'bg-indigo-600' : 'bg-zinc-300'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-4' : ''}`} /></span>
    </div>
  </button>;
}

export default function ChatRagStudio() {
  const [selectedType, setSelectedType] = useState('auto');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Tell me the business outcome you want. I will choose the RAG, explain why, then build and validate it from your trusted data.' }]);
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
  const fileRef = useRef(null);

  const validUrls = useMemo(() => urls.map(x => x.trim()).filter(Boolean), [urls]);
  const folders = useMemo(() => watchedFolders.split(/[\n,]+/).map(x => x.trim()).filter(Boolean), [watchedFolders]);
  const hasKnowledge = validUrls.length > 0 || files.length > 0 || folders.length > 0;
  const hasLiveSources = validUrls.length > 0 || folders.length > 0;
  const pipelineId = result?.pipeline_id || result?.deployment_info?.pipeline_id;

  useEffect(() => {
    if (!pipelineId) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/visualize/${pipelineId}`);
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled && data.metadata?.autopilot) setMonitor(data.metadata.autopilot);
      } catch {
        // The RAG itself can continue even when status polling is temporarily unavailable.
      }
    };
    poll();
    const timer = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [pipelineId]);

  const analyze = async (raw = input) => {
    const request = raw.trim();
    if (!request || analyzing) return;
    setAnalyzing(true); setError(''); setResult(null); setValidation(null); setMonitor(null);
    setMessages(prev => [...prev, { role: 'user', text: request }]);
    setInput('');
    let type = selectedType;
    let mode = selectedType === 'auto' ? 'model' : 'customer-selected';
    try {
      if (selectedType === 'auto') {
        const prompt = `Choose exactly one RAG architecture id for this customer request. Return only one id: basic, hybrid, citation, realtime, personalized, multimodal, conversational, agentic, structured, crosslingual, voice.\nCustomer request: ${request}`;
        const r = await fetch(`${API_BASE_URL}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: prompt }) });
        if (r.ok) {
          const answer = await responseText(r);
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
      const m = metaFor(shownType);
      setMessages(prev => [...prev, { role: 'assistant', text: explicit ? `I selected ${m.label}. ${m.summary} Add your knowledge and I will build a grounded pipeline, run a real test query, and keep monitored sources fresh.` : 'The guide model did not return a valid architecture id, so the backend will classify your original request against the supported catalog before build.' }]);
    } catch {
      setPlan({ request, deployType: `auto::${request}`, shownType: 'auto', mode: 'backend-auto-fallback' });
      setMessages(prev => [...prev, { role: 'assistant', text: 'The guide model is unavailable. The backend deterministic classifier will still choose only from real supported RAG architectures.' }]);
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
        citationStyle: 'inline', historyLength: 10, refreshInterval: intervalSeconds,
        modalities: ['text', 'images', 'audio'], sourceLanguage: 'auto', targetLanguage: 'English',
        voiceLanguage: 'en-US', profileFields: ['role', 'audience'], currentProfile,
        entityTypes: ['PERSON', 'ORG', 'GPE', 'CONCEPT'], relationshipDepth: 2,
        tools: explicit === 'agentic' ? ['Calculator', 'Calendar', 'Web Search'] : [],
        maxReasoningSteps: 5,
        qdrantUrl: storage === 'cloud' ? qdrantUrl.trim() : '',
        autopilot: {
          enabled: Boolean(autopilotEnabled && hasLiveSources),
          intervalSeconds,
          vision: visionEnabled,
          allowArchitectureEvolution: architectureEvolution,
          watchedFolders: folders,
          sources: validUrls.map(url => ({ url, mode: crawlMode, maxPages: crawlMode === 'dynamic' ? 50 : 1, vision: visionEnabled })),
        },
      },
      llmModel: 'qwen-local', embeddingModel: 'bge-local',
      chunkSize: explicit === 'structured' || explicit === 'multimodal' ? 500 : 700,
      topK: 6, useReranker: profile.reranker, theme: 'indigo', features: profile.features,
      deploymentType: 'api', apiKeys: storage === 'cloud' && qdrantKey ? { qdrant: qdrantKey } : {},
      privacyMode: storage === 'local', explainability: profile.features.includes('explainability'),
      scrapeMode: crawlMode, tuningPreset: profile.preset,
      hallucinationGuard: profile.features.includes('hallucinationGuard'), toxicityFilter: false,
      structuredOutput: false, streamingResponse: profile.features.includes('streamingResponse'),
    };
  };

  const build = async () => {
    if (!plan) { setError('Describe what you want first.'); return; }
    if (!hasKnowledge) { setError('Add a website, upload a file, or provide a watched server folder.'); return; }
    if (storage === 'cloud' && !qdrantUrl.trim()) { setError('Cloud Qdrant needs a cluster URL.'); return; }
    setBuilding(true); setError(''); setResult(null); setValidation(null);
    const config = buildConfig();
    try {
      if (validUrls.length) {
        setStage(crawlMode === 'dynamic' ? 'Crawling website knowledge' : 'Reading website');
        const r = await fetch(`${API_BASE_URL}/api/ingest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ragName: config.ragName, urls: validUrls, mode: crawlMode }) });
        if (!r.ok) throw new Error(`Website ingestion failed (${r.status})`);
      }
      for (const file of files) {
        setStage(`Extracting ${file.name}`);
        const body = new FormData(); body.append('file', file); body.append('ragName', config.ragName);
        const r = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body });
        if (!r.ok) throw new Error(`Could not process ${file.name}`);
      }
      setStage('Building retrieval + generation pipeline');
      const deploy = await fetch(`${API_BASE_URL}/api/deploy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
      if (!deploy.ok) throw new Error(`RAG build failed (${deploy.status}): ${await deploy.text()}`);
      const data = await deploy.json(); setResult(data); setMonitor(data.deployment_info?.autopilot || null);
      const pid = data.pipeline_id || data.deployment_info?.pipeline_id;
      if (pid) {
        setStage('Running grounded validation query');
        const check = await fetch(`${API_BASE_URL}/api/test-chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pipeline_id: pid, query: 'Summarize what this knowledge base contains. Use only retrieved evidence and cite source IDs when available.' }) });
        if (check.ok) {
          const out = await check.json(); const answer = String(out.answer || '').trim();
          const passed = Boolean(answer) && !answer.startsWith('⚠️') && !answer.toLowerCase().includes('pipeline not found');
          setValidation({ passed, answer: answer.slice(0, 700) });
        } else setValidation({ passed: false, answer: `Validation returned HTTP ${check.status}` });
      }
      setMessages(prev => [...prev, { role: 'assistant', text: `Build complete. ${data.deployment_info?.type || 'The selected RAG'} is live${data.deployment_info?.autopilot?.enabled ? ' with RAG Autopilot monitoring enabled' : ''}.` }]);
    } catch (e) {
      setError(e.message || 'Build failed.');
      setMessages(prev => [...prev, { role: 'assistant', text: `Build stopped: ${e.message || 'unknown error'}` }]);
    } finally { setBuilding(false); setStage(''); }
  };

  const planMeta = metaFor(plan?.shownType || selectedType);
  const PlanIcon = planMeta.icon;
  const monitorState = monitor?.state || (autopilotEnabled && hasLiveSources ? 'ready-to-monitor' : 'static');

  return <main className="min-h-screen bg-[#f7f8fb] text-zinc-950">
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-zinc-950 text-white"><Bot className="h-5 w-5" /></div><div><p className="font-semibold tracking-tight">OmniRAG Autopilot</p><p className="text-xs text-zinc-500">Describe → learn → build → validate → keep evolving</p></div></div>
        <div className="flex gap-2"><a href="/starter" className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium">Starter</a><a href="/advanced" className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium">Advanced</a></div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(330px,.65fr)]">
        <div className="overflow-hidden rounded-[30px] border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,.07)]">
          <div className="border-b border-zinc-100 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">AI RAG Architect</span><h1 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Tell the product what the customer needs.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">No RAG terminology required. Auto mode selects only architectures the backend can build.</p></div><select value={selectedType} onChange={e => setSelectedType(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-indigo-400">{RAGS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div></div>
          <div className="max-h-[360px] space-y-3 overflow-y-auto p-5 sm:p-6">{messages.map((m, i) => <div key={`${m.role}-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${m.role === 'user' ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-700'}`}>{m.text}</div></div>)}</div>
          <div className="border-t border-zinc-100 p-4 sm:p-5"><div className="mb-3 flex flex-wrap gap-2">{EXAMPLES.map(x => <button key={x} type="button" onClick={() => analyze(x)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:border-indigo-300">{x.slice(0, 44)}…</button>)}</div><div className="flex gap-2"><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); analyze(); } }} rows={2} placeholder="Example: Build a support assistant from our website and PDFs, cite answers and keep itself updated." className="min-h-[56px] flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white" /><button type="button" onClick={() => analyze()} disabled={analyzing || !input.trim()} className="grid w-14 place-items-center rounded-2xl bg-indigo-600 text-white disabled:opacity-40">{analyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</button></div></div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[26px] border border-zinc-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-50 text-indigo-700"><PlanIcon className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-zinc-400">Architecture</p><p className="mt-1 font-semibold">{planMeta.label}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{planMeta.summary}</p></div></div>{plan && <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">Selection: {plan.mode}</div>}</div>
          <div className="rounded-[26px] border border-indigo-100 bg-gradient-to-b from-indigo-50 to-white p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-indigo-600">RAG Autopilot</p><p className="mt-1 text-lg font-semibold">{monitorState}</p></div><Activity className={`h-5 w-5 ${monitorState === 'fresh' ? 'text-emerald-600' : 'text-indigo-600'}`} /></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-white p-3"><div className="text-zinc-400">Generation</div><div className="mt-1 font-semibold">{monitor?.generation ?? 0}</div></div><div className="rounded-xl bg-white p-3"><div className="text-zinc-400">Sources</div><div className="mt-1 font-semibold">{monitor?.source_count ?? (validUrls.length + folders.length)}</div></div><div className="rounded-xl bg-white p-3"><div className="text-zinc-400">Last update</div><div className="mt-1 truncate font-semibold">{monitor?.last_update || 'After first change'}</div></div><div className="rounded-xl bg-white p-3"><div className="text-zinc-400">Vision</div><div className="mt-1 font-semibold">{visionEnabled ? 'Enabled' : 'Off'}</div></div></div>{monitor?.last_error && <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{monitor.last_error}</div>}</div>
        </aside>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-zinc-400">Knowledge</p><h2 className="mt-1 text-xl font-semibold">What should this RAG learn?</h2></div><button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium"><Paperclip className="mr-2 inline h-4 w-4" />Upload</button><input ref={fileRef} type="file" multiple className="hidden" onChange={e => setFiles(Array.from(e.target.files || []))} /></div>
          <div className="mt-4 space-y-2">{urls.map((url, i) => <div key={i} className="flex gap-2"><Globe2 className="mt-3 h-4 w-4 text-zinc-400" /><input value={url} onChange={e => setUrls(prev => prev.map((x, j) => j === i ? e.target.value : x))} placeholder="https://customer-site.com" className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />{i === urls.length - 1 && <button type="button" onClick={() => setUrls(prev => [...prev, ''])} className="rounded-xl border border-zinc-200 px-3 text-sm">+</button>}</div>)}</div>
          <div className="mt-3"><label className="text-xs font-medium text-zinc-500">Watched folder on the customer server (optional)</label><textarea value={watchedFolders} onChange={e => setWatchedFolders(e.target.value)} rows={2} placeholder="C:\\CompanyKnowledge\\ApprovedDocs or /srv/company/knowledge" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400" /></div>
          {files.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{files.map(f => <span key={`${f.name}-${f.size}`} className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs"><FileText className="mr-1 inline h-3.5 w-3.5" />{f.name}</span>)}</div>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-medium text-zinc-500">RAG name</label><input value={ragName} onChange={e => setRagName(safeName(e.target.value))} className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm" /></div><div><label className="text-xs font-medium text-zinc-500">Website mode</label><select value={crawlMode} onChange={e => setCrawlMode(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"><option value="static">Single page</option><option value="dynamic">Full site · up to 50 pages</option></select></div></div>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[.16em] text-zinc-400">Self-developing controls</p><h2 className="mt-1 text-xl font-semibold">Keep knowledge and retrieval improving.</h2><div className="mt-4 space-y-3"><Toggle checked={autopilotEnabled} onChange={setAutopilotEnabled} label="Continuous source monitoring" description="Fingerprint websites/folders and re-index only when knowledge actually changes." /><Toggle checked={visionEnabled} onChange={setVisionEnabled} icon={Eye} label="Visual change intelligence" description="Capture rendered pages and use local vision/OCR so charts, screenshots and visual content can enter the RAG." /><Toggle checked={architectureEvolution} onChange={setArchitectureEvolution} icon={Sparkles} label="Allow safe architecture evolution" description="Autopilot may move a basic RAG to realtime or multimodal when the monitored evidence proves that architecture is needed." /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-medium text-zinc-500">Check frequency</label><select value={intervalSeconds} onChange={e => setIntervalSeconds(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"><option value={300}>Every 5 minutes</option><option value={900}>Every 15 minutes</option><option value={3600}>Hourly</option><option value={21600}>Every 6 hours</option><option value={86400}>Daily</option></select></div><div><label className="text-xs font-medium text-zinc-500">Customer profile role</label><input value={profileRole} onChange={e => setProfileRole(e.target.value)} placeholder="Support agent, Finance lead…" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm" /></div></div><div className="mt-3"><label className="text-xs font-medium text-zinc-500">Audience / personalization context</label><input value={profileAudience} onChange={e => setProfileAudience(e.target.value)} placeholder="New customers, auditors, engineers…" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm" /></div></div>
      </section>

      <section className="mt-5 rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-zinc-400">Deployment</p><h2 className="mt-1 text-xl font-semibold">Where should customer knowledge live?</h2></div><div className="flex gap-2"><button type="button" onClick={() => setStorage('local')} className={`rounded-xl border px-4 py-2 text-sm font-medium ${storage === 'local' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-zinc-200'}`}><HardDrive className="mr-2 inline h-4 w-4" />Private local</button><button type="button" onClick={() => setStorage('cloud')} className={`rounded-xl border px-4 py-2 text-sm font-medium ${storage === 'cloud' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-zinc-200'}`}><Cloud className="mr-2 inline h-4 w-4" />Qdrant cloud</button></div></div>{storage === 'cloud' && <div className="mt-4 grid gap-3 md:grid-cols-2"><input value={qdrantUrl} onChange={e => setQdrantUrl(e.target.value)} placeholder="https://cluster...qdrant.io" className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm" /><input type="password" value={qdrantKey} onChange={e => setQdrantKey(e.target.value)} placeholder="Qdrant API key" className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm" /><p className="md:col-span-2 text-xs text-zinc-500">The key is used for this build but is not persisted into deployment metadata.</p></div>}
        {error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" disabled={building || !plan || !hasKnowledge} onClick={build} className="inline-flex items-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{building ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{stage || 'Building'}</> : <>Build, validate & start Autopilot <ArrowRight className="ml-2 h-4 w-4" /></>}</button>{pipelineId && <><a href={`/chat/${pipelineId}`} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">Open customer chat</a><a href={`${API_BASE_URL}/api/export/${pipelineId}`} className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold">Export RAG</a></>}{validation && <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${validation.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{validation.passed ? <><Check className="mr-1 inline h-3.5 w-3.5" />Runtime query passed</> : 'Runtime query needs attention'}</span>}</div>{validation?.answer && <div className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">{validation.answer}</div>}
      </section>

      <section className="mt-8"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-zinc-400">Backend capability map</p><h2 className="mt-1 text-2xl font-semibold">All 11 architectures are real build targets.</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{RAGS.filter(r => r.id !== 'auto').map(r => { const Icon = r.icon; return <div key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="flex items-start gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-100"><Icon className="h-4 w-4" /></div><div><div className="text-sm font-semibold">{r.label}</div><div className="mt-1 text-xs leading-5 text-zinc-500">{r.summary}</div></div></div></div>; })}</div></section>
    </div>
  </main>;
}
