import React, { useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, Brain, Check, Database, Eye, FileText, Globe2, Loader2,
  MessageCircle, Paperclip, RefreshCw, Search, Send, ShieldCheck, Sparkles, Volume2,
  Workflow, X, Zap,
} from 'lucide-react';
import { API_BASE_URL } from './config';

const RAGS = [
  { id: 'basic', label: 'Universal RAG', icon: Search },
  { id: 'hybrid', label: 'Hybrid Search RAG', icon: Database },
  { id: 'citation', label: 'Verified Citation RAG', icon: ShieldCheck },
  { id: 'realtime', label: 'Realtime RAG', icon: Zap },
  { id: 'personalized', label: 'Personalized RAG', icon: Sparkles },
  { id: 'multimodal', label: 'Multimodal RAG', icon: Eye },
  { id: 'conversational', label: 'Conversational RAG', icon: MessageCircle },
  { id: 'agentic', label: 'Agentic RAG', icon: Brain },
  { id: 'structured', label: 'Graph / Structured RAG', icon: Workflow },
  { id: 'crosslingual', label: 'Cross-lingual RAG', icon: Globe2 },
  { id: 'voice', label: 'Voice RAG', icon: Volume2 },
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
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

function safeName(text) {
  const cleaned = String(text || '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return cleaned || 'omnirag-assistant';
}

function architectureMeta(id) {
  return RAGS.find(item => item.id === id) || RAGS[0];
}

async function readResponse(response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const data = await response.json();
    return data.answer || data.message || '';
  }
  return response.text();
}

export default function GlobalRagAutopilot() {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState('');
  const [plan, setPlan] = useState(null);
  const [urls, setUrls] = useState(['']);
  const [files, setFiles] = useState([]);
  const [folder, setFolder] = useState('');
  const [status, setStatus] = useState('idle');
  const [stage, setStage] = useState('');
  const [result, setResult] = useState(null);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const buildTimerRef = useRef(null);
  const lastBuildSignatureRef = useRef('');

  const validUrls = useMemo(() => urls.map(value => value.trim()).filter(value => /^https?:\/\//i.test(value)), [urls]);
  const folders = useMemo(() => folder.split(/[\n,]+/).map(value => value.trim()).filter(Boolean), [folder]);
  const hasKnowledge = validUrls.length > 0 || files.length > 0 || folders.length > 0;
  const pipelineId = result?.pipeline_id || result?.deployment_info?.pipeline_id;
  const meta = architectureMeta(plan?.shownType || 'basic');
  const MetaIcon = meta.icon;

  const scheduleBuild = (nextPlan = plan, nextUrls = validUrls, nextFiles = files, nextFolders = folders) => {
    if (!nextPlan || (!nextUrls.length && !nextFiles.length && !nextFolders.length)) return;
    if (buildTimerRef.current) window.clearTimeout(buildTimerRef.current);
    buildTimerRef.current = window.setTimeout(() => executeBuild(nextPlan, nextUrls, nextFiles, nextFolders), 900);
  };

  const executeBuild = async (nextPlan, nextUrls, nextFiles, nextFolders) => {
    const profile = PROFILES[nextPlan.shownType] || { preset: 'balanced', features: [], reranker: true };
    const signature = JSON.stringify({ request: nextPlan.request, type: nextPlan.deployType, urls: nextUrls, files: nextFiles.map(file => `${file.name}:${file.size}`), folders: nextFolders });
    if (signature === lastBuildSignatureRef.current || status === 'building') return;
    lastBuildSignatureRef.current = signature;
    setStatus('building');
    setResult(null);
    setValidation(null);
    setError('');
    setOpen(true);

    const ragName = safeName(nextPlan.request.split(/\s+/).slice(0, 7).join('-'));
    const config = {
      ragName,
      extracted_texts: [],
      ragType: nextPlan.deployType,
      dbType: 'local',
      cloudDb: '',
      localDb: 'chroma',
      dynamicConfig: {
        citationStyle: 'inline',
        historyLength: 10,
        refreshInterval: 900,
        modalities: ['text', 'images', 'audio'],
        sourceLanguage: 'auto',
        targetLanguage: 'English',
        voiceLanguage: 'en-US',
        profileFields: ['role', 'audience'],
        currentProfile: {},
        entityTypes: ['PERSON', 'ORG', 'GPE', 'CONCEPT'],
        relationshipDepth: 2,
        tools: nextPlan.shownType === 'agentic' ? ['Calculator', 'Calendar', 'Web Search'] : [],
        maxReasoningSteps: 5,
        autopilot: {
          enabled: Boolean(nextUrls.length || nextFolders.length),
          intervalSeconds: 900,
          vision: true,
          allowArchitectureEvolution: true,
          watchedFolders: nextFolders,
          sources: nextUrls.map(url => ({ url, mode: 'dynamic', maxPages: 50, vision: true })),
        },
      },
      llmModel: 'qwen-local',
      embeddingModel: 'bge-local',
      chunkSize: nextPlan.shownType === 'structured' || nextPlan.shownType === 'multimodal' ? 500 : 700,
      topK: 6,
      useReranker: profile.reranker,
      theme: 'cyan',
      features: profile.features,
      deploymentType: 'api',
      apiKeys: {},
      privacyMode: true,
      explainability: profile.features.includes('explainability'),
      scrapeMode: 'dynamic',
      tuningPreset: profile.preset,
      hallucinationGuard: profile.features.includes('hallucinationGuard'),
      toxicityFilter: false,
      structuredOutput: false,
      streamingResponse: profile.features.includes('streamingResponse'),
    };

    try {
      if (nextUrls.length) {
        setStage('Learning approved website knowledge');
        const ingest = await fetch(`${API_BASE_URL}/api/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ragName, urls: nextUrls, mode: 'dynamic' }),
        });
        if (!ingest.ok) throw new Error(`Website ingestion failed (${ingest.status})`);
      }

      for (const file of nextFiles) {
        setStage(`Understanding ${file.name}`);
        const body = new FormData();
        body.append('file', file);
        body.append('ragName', ragName);
        const upload = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body });
        if (!upload.ok) throw new Error(`Could not process ${file.name}`);
      }

      setStage(`Building ${meta.label}`);
      const deploy = await fetch(`${API_BASE_URL}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!deploy.ok) throw new Error(`RAG build failed (${deploy.status}): ${await deploy.text()}`);
      const data = await deploy.json();
      setResult(data);

      const id = data.pipeline_id || data.deployment_info?.pipeline_id;
      if (id) {
        setStage('Opening a grounded preview');
        const test = await fetch(`${API_BASE_URL}/api/test-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pipeline_id: id, query: nextPlan.request }),
        });
        if (test.ok) {
          const output = await test.json();
          setValidation({ passed: true, answer: String(output.answer || '').slice(0, 900) });
        } else {
          setValidation({ passed: false, answer: `Pipeline is live, but preview returned HTTP ${test.status}.` });
        }
      }
      setStatus('ready');
    } catch (buildError) {
      setStatus('error');
      setError(buildError?.message || 'Could not build the RAG.');
      lastBuildSignatureRef.current = '';
    } finally {
      setStage('');
    }
  };

  const submit = async () => {
    const request = input.trim();
    if (!request || status === 'analyzing' || status === 'building') return;
    setStatus('analyzing');
    setError('');
    setResult(null);
    setValidation(null);
    setOpen(true);

    const extracted = Array.from(new Set(request.match(URL_PATTERN) || []));
    const mergedUrls = Array.from(new Set([...validUrls, ...extracted]));
    if (extracted.length) setUrls([...mergedUrls, '']);

    let type = null;
    try {
      const prompt = `Choose exactly one RAG architecture id for this customer request. Return only one id: basic, hybrid, citation, realtime, personalized, multimodal, conversational, agentic, structured, crosslingual, voice.\nCustomer request: ${request}`;
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt }),
      });
      if (response.ok) {
        const answer = await readResponse(response);
        const match = answer.match(TYPE_PATTERN);
        if (match) type = match[1].toLowerCase();
      }
    } catch {
      // The backend auto classifier remains the final fallback.
    }

    const nextPlan = type
      ? { request, deployType: type, shownType: type, mode: 'AI selected' }
      : { request, deployType: `auto::${request}`, shownType: 'basic', mode: 'Backend auto' };
    setPlan(nextPlan);
    setInput('');
    setStatus('ready-to-build');
    lastBuildSignatureRef.current = '';

    const currentFolders = folders;
    if (mergedUrls.length || files.length || currentFolders.length) {
      scheduleBuild(nextPlan, mergedUrls, files, currentFolders);
    }
  };

  const handleFiles = nextFiles => {
    const cleanFiles = Array.from(nextFiles || []);
    setFiles(cleanFiles);
    setOpen(true);
    lastBuildSignatureRef.current = '';
    if (plan && cleanFiles.length) scheduleBuild(plan, validUrls, cleanFiles, folders);
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-[90] mx-auto w-[min(980px,calc(100%-24px))] sm:bottom-6">
      <div
        onDragEnter={event => { event.preventDefault(); setDragging(true); setOpen(true); }}
        onDragOver={event => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); handleFiles(event.dataTransfer.files); }}
        className={`overflow-hidden rounded-[28px] border backdrop-blur-2xl transition-all duration-300 ${dragging ? 'border-white/50 bg-white/[0.12] shadow-[0_0_70px_rgba(255,255,255,.12)]' : 'border-white/[0.12] bg-[#061018]/92 shadow-[0_26px_90px_rgba(0,0,0,.55)]'}`}
      >
        {open && (
          <div className="border-b border-white/[0.07] px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/[0.07] text-white">
                  {status === 'analyzing' || status === 'building' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Global RAG Autopilot</div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {plan ? `${meta.label} · ${plan.mode}` : 'Say what you need. OmniRAG chooses the RAG.'}
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-zinc-500">
                    {status === 'building' ? stage : plan && !hasKnowledge ? 'Add a website, file or folder below. Build starts automatically—no RAG card to click.' : pipelineId ? 'Pipeline built and previewed automatically.' : 'Natural language → architecture → knowledge → build → preview.'}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-zinc-500 transition hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            {plan && (
              <div className="mt-4 grid gap-3 md:grid-cols-[.85fr_1.15fr]">
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-300"><MetaIcon className="h-4 w-4" /></span>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Automatically selected</div>
                      <div className="mt-1 text-sm font-semibold text-white">{meta.label}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                    <span className="rounded-full border border-white/[0.08] px-2.5 py-1">Self-learning on</span>
                    <span className="rounded-full border border-white/[0.08] px-2.5 py-1">Vision on</span>
                    <span className="rounded-full border border-white/[0.08] px-2.5 py-1">Local private</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex gap-2">
                      <Globe2 className="mt-3 h-4 w-4 shrink-0 text-zinc-600" />
                      <input
                        value={urls[0] || ''}
                        onChange={event => {
                          const value = event.target.value;
                          const next = [value, ...urls.slice(1)];
                          setUrls(next);
                          lastBuildSignatureRef.current = '';
                          const clean = next.map(item => item.trim()).filter(item => /^https?:\/\//i.test(item));
                          if (plan && clean.length) scheduleBuild(plan, clean, files, folders);
                        }}
                        placeholder="https://customer-site.com"
                        className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-xs text-white outline-none placeholder:text-zinc-700 focus:border-white/25"
                      />
                    </div>
                    <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-white/[0.08]"><Paperclip className="h-4 w-4" />Add files</button>
                    <input ref={fileRef} type="file" multiple className="hidden" onChange={event => handleFiles(event.target.files)} />
                  </div>
                  <textarea
                    value={folder}
                    onChange={event => {
                      const value = event.target.value;
                      setFolder(value);
                      lastBuildSignatureRef.current = '';
                      const nextFolders = value.split(/[\n,]+/).map(item => item.trim()).filter(Boolean);
                      if (plan && nextFolders.length) scheduleBuild(plan, validUrls, files, nextFolders);
                    }}
                    rows={1}
                    placeholder="Optional watched folder: C:\\CompanyKnowledge\\ApprovedDocs"
                    className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-xs text-white outline-none placeholder:text-zinc-700 focus:border-white/25"
                  />
                  {files.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{files.slice(0, 4).map(file => <span key={`${file.name}-${file.size}`} className="rounded-full border border-white/[0.08] px-2 py-1 text-[10px] text-zinc-400"><FileText className="mr-1 inline h-3 w-3" />{file.name}</span>)}</div>}
                </div>
              </div>
            )}

            {error && <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-3 py-2 text-xs text-rose-200">{error}</div>}

            {pipelineId && (
              <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100"><Check className="h-4 w-4 text-emerald-300" />Pipeline live · {meta.label}</div>
                  <a href={`/chat/${pipelineId}`} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-black">Open full chat <ArrowRight className="h-3 w-3" /></a>
                </div>
                {validation?.answer && <div className="mt-2 max-h-28 overflow-y-auto text-[11px] leading-5 text-zinc-400">{validation.answer}</div>}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 p-2 sm:p-2.5">
          <button type="button" onClick={() => setOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white text-black shadow-[0_0_30px_rgba(255,255,255,.08)]">
            {status === 'building' || status === 'analyzing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </button>
          <input
            value={input}
            onFocus={() => setOpen(true)}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') submit(); }}
            placeholder="Tell OmniRAG what to build — no RAG selection needed"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm font-medium text-white outline-none placeholder:text-zinc-600"
          />
          <div className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-700 sm:flex">
            <Activity className="h-3.5 w-3.5" /> Auto
          </div>
          <button type="button" onClick={submit} disabled={!input.trim() || status === 'analyzing' || status === 'building'} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-black transition hover:scale-[1.03] disabled:opacity-30">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
