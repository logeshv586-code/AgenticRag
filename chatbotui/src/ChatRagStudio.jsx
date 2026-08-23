import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Bot, Brain, Check, ChevronDown, Cloud, Database, FileText,
  Globe2, HardDrive, Loader2, MessageCircle, Paperclip, Rocket, Search,
  Send, ShieldCheck, Sparkles, Upload, Volume2, Workflow, Zap
} from 'lucide-react';
import { API_BASE_URL } from './config';

const RAG_OPTIONS = [
  { id: 'auto', label: 'Auto · AI chooses', icon: Sparkles, summary: 'Describe the outcome. The backend model chooses the closest supported architecture.' },
  { id: 'basic', label: 'Universal RAG', icon: Search, summary: 'General semantic search for FAQs and knowledge bases.' },
  { id: 'hybrid', label: 'Hybrid Search RAG', icon: Database, summary: 'Keyword + semantic retrieval for technical or exact-match knowledge.' },
  { id: 'citation', label: 'Verified Citation RAG', icon: ShieldCheck, summary: 'Evidence-first answers for SOPs, policy and audit use cases.' },
  { id: 'realtime', label: 'Realtime RAG', icon: Zap, summary: 'Prioritizes frequently refreshed information.' },
  { id: 'personalized', label: 'Personalized RAG', icon: Bot, summary: 'Adapts retrieval to user profiles, roles and preferences.' },
  { id: 'multimodal', label: 'Multimodal RAG', icon: FileText, summary: 'Works across text, images and supported rich content.' },
  { id: 'conversational', label: 'Conversational RAG', icon: MessageCircle, summary: 'Maintains conversation context for support and guided assistants.' },
  { id: 'agentic', label: 'Agentic RAG', icon: Brain, summary: 'Plans multi-step work and can use approved tools after retrieval.' },
  { id: 'structured', label: 'Graph / Structured RAG', icon: Workflow, summary: 'Reasons over entities, relationships and structured knowledge.' },
  { id: 'crosslingual', label: 'Cross-lingual RAG', icon: Globe2, summary: 'Retrieves and answers across multiple languages.' },
  { id: 'voice', label: 'Voice RAG', icon: Volume2, summary: 'Adds speech interaction to grounded retrieval.' },
];

const PROFILE = {
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
  'Create a customer support assistant that remembers follow-up questions and cites our manuals.',
  'Build a research agent that reads our documents, reasons across them and can use a calculator.',
  'I need an SOP assistant where every answer must show the source and avoid guessing.',
  'Create a multilingual knowledge assistant for English, Tamil and Hindi customers.',
];

const TYPE_PATTERN = /\b(basic|hybrid|citation|realtime|personalized|multimodal|conversational|agentic|structured|crosslingual|voice)\b/i;

function getMeta(id) {
  return RAG_OPTIONS.find(item => item.id === id) || RAG_OPTIONS[0];
}

async function readAnswer(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    return data.answer || data.message || '';
  }
  return response.text();
}

function makeName(text) {
  const words = text.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 5);
  return words.length ? `${words.join(' ')} RAG` : 'My Customer RAG';
}

export default function ChatRagStudio() {
  const [selectedType, setSelectedType] = useState('auto');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Tell me what you want your AI assistant to do. I will choose a real RAG architecture, explain the plan, then build it from your trusted knowledge.' }
  ]);
  const [plan, setPlan] = useState(null);
  const [ragName, setRagName] = useState('My Customer RAG');
  const [urls, setUrls] = useState(['']);
  const [files, setFiles] = useState([]);
  const [deployment, setDeployment] = useState('local');
  const [analyzing, setAnalyzing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildStage, setBuildStage] = useState('');
  const [result, setResult] = useState(null);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const validUrls = useMemo(() => urls.map(x => x.trim()).filter(Boolean), [urls]);
  const hasKnowledge = validUrls.length > 0 || files.length > 0;
  const pipelineId = result?.pipeline_id || result?.deployment_info?.pipeline_id;
  const deployedType = result?.deployment_info?.type || result?.deployment_info?.validation?.rag_type || plan?.resolvedType;

  const analyzeRequest = async (rawText = input) => {
    const customerRequest = rawText.trim();
    if (!customerRequest || analyzing) return;
    setError('');
    setResult(null);
    setValidation(null);
    setMessages(prev => [...prev, { role: 'user', text: customerRequest }]);
    setInput('');
    setAnalyzing(true);

    let resolvedType = selectedType;
    let modelAnswer = '';
    let analysisMode = selectedType === 'auto' ? 'model' : 'customer-selected';

    try {
      if (selectedType === 'auto') {
        const classifierPrompt = [
          'You are selecting an OmniRAG backend architecture for a customer.',
          'Reply with ONLY ONE architecture id from this exact list:',
          'basic, hybrid, citation, realtime, personalized, multimodal, conversational, agentic, structured, crosslingual, voice.',
          `Customer request: ${customerRequest}`
        ].join('\n');
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: classifierPrompt })
        });
        if (response.ok) {
          modelAnswer = (await readAnswer(response)).trim();
          const match = modelAnswer.match(TYPE_PATTERN);
          if (match) resolvedType = match[1].toLowerCase();
        }
      }

      const modelResolved = resolvedType !== 'auto' && PROFILE[resolvedType];
      const deployType = modelResolved ? resolvedType : `auto::${customerRequest}`;
      const shownType = modelResolved ? resolvedType : 'auto';
      const meta = getMeta(shownType);
      const newPlan = {
        customerRequest,
        resolvedType: deployType,
        shownType,
        analysisMode: modelResolved ? analysisMode : 'backend-auto-fallback',
        modelAnswer,
      };
      setPlan(newPlan);
      if (ragName === 'My Customer RAG') setRagName(makeName(customerRequest));

      const explanation = modelResolved
        ? `I selected ${meta.label}. ${meta.summary} Add your trusted knowledge below, review the plan, then I can build and test it.`
        : 'The model did not return a valid architecture token, so I will send your original request to the backend auto-classifier. It will resolve the request to one of the supported pipelines before deployment.';
      setMessages(prev => [...prev, { role: 'assistant', text: explanation }]);
    } catch (e) {
      const fallbackPlan = {
        customerRequest,
        resolvedType: `auto::${customerRequest}`,
        shownType: 'auto',
        analysisMode: 'backend-auto-fallback',
        modelAnswer: '',
      };
      setPlan(fallbackPlan);
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'The guide model is not reachable, so I will use the backend classifier during deployment. Your request will still be restricted to the supported RAG catalog.'
      }]);
    } finally {
      setAnalyzing(false);
    }
  };

  const buildConfig = () => {
    if (!plan) return null;
    const explicitType = PROFILE[plan.resolvedType] ? plan.resolvedType : null;
    const profile = explicitType ? PROFILE[explicitType] : { preset: 'balanced', features: [], reranker: true };
    const dynamicConfig = {
      citationStyle: 'inline', historyLength: 8, refreshInterval: 60,
      modalities: ['text', 'images'], sourceLanguage: 'auto', targetLanguage: 'English',
      voiceLanguage: 'en-US', profileFields: ['Role'],
      entityTypes: ['Organization', 'Product', 'Person', 'Process'], relationshipDepth: 2,
      ...(explicitType === 'agentic' ? { tools: ['Calculator', 'Calendar'] } : {})
    };
    return {
      ragName: ragName.trim() || makeName(plan.customerRequest),
      extracted_texts: [],
      ragType: plan.resolvedType,
      dbType: deployment === 'local' ? 'local' : 'cloud',
      cloudDb: deployment === 'cloud' ? 'qdrant' : '',
      localDb: 'chroma',
      dynamicConfig,
      llmModel: 'qwen-local', embeddingModel: 'bge-local',
      chunkSize: explicitType === 'structured' || explicitType === 'multimodal' ? 500 : 700,
      topK: 6, useReranker: profile.reranker, theme: 'cyan',
      features: profile.features,
      deploymentType: 'api', apiKeys: {}, privacyMode: deployment === 'local',
      explainability: profile.features.includes('explainability'), scrapeMode: 'static',
      tuningPreset: profile.preset,
      hallucinationGuard: profile.features.includes('hallucinationGuard'),
      toxicityFilter: false, structuredOutput: false,
      streamingResponse: profile.features.includes('streamingResponse')
    };
  };

  const buildRag = async () => {
    if (!plan) { setError('Describe the RAG you want first.'); return; }
    if (!hasKnowledge) { setError('Add at least one website or document before building.'); return; }
    const config = buildConfig();
    setError(''); setBuilding(true); setResult(null); setValidation(null);
    try {
      if (validUrls.length) {
        setBuildStage('Reading websites');
        const ingest = await fetch(`${API_BASE_URL}/api/ingest`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ragName: config.ragName, urls: validUrls, mode: 'static' })
        });
        if (!ingest.ok) throw new Error(`Website ingestion failed (${ingest.status})`);
      }
      for (const file of files) {
        setBuildStage(`Reading ${file.name}`);
        const body = new FormData(); body.append('file', file); body.append('ragName', config.ragName);
        const upload = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body });
        if (!upload.ok) throw new Error(`Could not process ${file.name}`);
      }

      setBuildStage('Building retrieval pipeline');
      const deploy = await fetch(`${API_BASE_URL}/api/deploy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config)
      });
      if (!deploy.ok) throw new Error(`RAG deployment failed (${deploy.status}): ${await deploy.text()}`);
      const data = await deploy.json();
      setResult(data);
      const pid = data.pipeline_id || data.deployment_info?.pipeline_id;

      setBuildStage('Running validation query');
      if (pid) {
        const check = await fetch(`${API_BASE_URL}/api/test-chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pipeline_id: pid,
            query: 'Briefly explain what this knowledge base contains. Use only retrieved evidence and mention the source when available.'
          })
        });
        if (check.ok) {
          const checkData = await check.json();
          const answer = String(checkData.answer || '').trim();
          const passed = Boolean(answer) && !answer.startsWith('⚠️') && !answer.toLowerCase().includes('please create a rag');
          setValidation({ passed, answer: answer.slice(0, 500) });
        } else {
          setValidation({ passed: false, answer: `Validation endpoint returned HTTP ${check.status}` });
        }
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Build complete. The backend created ${data.deployment_info?.type || 'the selected'} RAG and I ran a real test query against the deployed pipeline.`
      }]);
    } catch (e) {
      setError(e.message || 'Could not create the RAG.');
      setMessages(prev => [...prev, { role: 'assistant', text: `Build stopped: ${e.message || 'unknown error'}` }]);
    } finally {
      setBuilding(false); setBuildStage('');
    }
  };

  const shownMeta = plan ? getMeta(plan.shownType) : getMeta(selectedType);
  const PlanIcon = shownMeta.icon || Sparkles;

  return <main className="min-h-screen bg-[#f7f8fb] text-zinc-950">
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-zinc-950 text-white"><Bot className="h-5 w-5" /></div>
          <div><p className="font-semibold tracking-tight">OmniRAG Studio</p><p className="text-xs text-zinc-500">Describe it → add knowledge → build → validate</p></div>
        </div>
        <div className="flex gap-2">
          <a href="/starter" className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium">Starter wizard</a>
          <a href="/advanced" className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium">Advanced builder</a>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,.06)]">
          <div className="border-b border-zinc-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Chat-first RAG Factory</span><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Tell the AI what you want to build.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">No RAG terminology required. Auto mode asks the backend model to classify your request. You can also force a specific architecture from the dropdown.</p></div>
              <label className="min-w-[220px] text-xs font-medium text-zinc-500">RAG selection
                <div className="relative mt-1"><select value={selectedType} onChange={e=>setSelectedType(e.target.value)} className="w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 pr-9 text-sm font-semibold outline-none focus:border-indigo-300">{RAG_OPTIONS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-zinc-400" /></div>
              </label>
            </div>
          </div>

          <div className="min-h-[390px] space-y-4 p-5 sm:p-6">
            {messages.map((message, index)=><div key={index} className={`flex ${message.role==='user'?'justify-end':'justify-start'}`}><div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role==='user'?'bg-zinc-950 text-white':'border border-zinc-200 bg-zinc-50 text-zinc-700'}`}>{message.text}</div></div>)}
            {analyzing && <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin"/> Backend model is selecting the architecture…</div>}
          </div>

          <div className="border-t border-zinc-100 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap gap-2">{EXAMPLES.slice(0,3).map((text,i)=><button key={i} onClick={()=>analyzeRequest(text)} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-50">{text.length>64?text.slice(0,64)+'…':text}</button>)}</div>
            <form onSubmit={e=>{e.preventDefault();analyzeRequest()}} className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-2 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
              <textarea value={input} onChange={e=>setInput(e.target.value)} rows={2} placeholder="Example: Build a support bot for our manuals that remembers the conversation, cites sources and never guesses." className="min-h-[54px] flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none sm:text-sm" />
              <button disabled={!input.trim()||analyzing} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-950 text-white disabled:opacity-40"><Send className="h-4 w-4"/></button>
            </form>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 font-semibold"><PlanIcon className="h-5 w-5"/> AI build plan</div>
            {!plan ? <p className="mt-3 text-sm leading-6 text-zinc-500">Your architecture plan appears here after you describe the assistant.</p> : <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl bg-zinc-950 p-4 text-white"><p className="text-xs text-zinc-400">Architecture</p><p className="mt-1 font-semibold">{plan.shownType==='auto'?'Backend auto-classification':shownMeta.label}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{shownMeta.summary}</p></div>
              <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-zinc-50 p-3"><span className="text-xs text-zinc-400">Decision</span><br/><b className="text-xs">{plan.analysisMode.replaceAll('-',' ')}</b></div><div className="rounded-xl bg-zinc-50 p-3"><span className="text-xs text-zinc-400">Evidence mode</span><br/><b className="text-xs">Grounded + guarded</b></div></div>
            </div>}
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-2 font-semibold"><Paperclip className="h-5 w-5"/> Trusted knowledge</div>
            <input value={ragName} onChange={e=>setRagName(e.target.value)} placeholder="RAG name" className="mt-4 w-full rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none focus:border-indigo-300"/>
            <div className="mt-3 space-y-2">{urls.map((url,i)=><div key={i} className="flex gap-2"><input value={url} onChange={e=>setUrls(prev=>prev.map((x,n)=>n===i?e.target.value:x))} placeholder="https://docs.company.com" className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-3 text-sm outline-none"/>{i===urls.length-1&&<button type="button" onClick={()=>setUrls(prev=>[...prev,''])} className="rounded-xl border border-zinc-200 px-3 text-xs">Add</button>}</div>)}</div>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={e=>setFiles(Array.from(e.target.files||[]))}/>
            <button type="button" onClick={()=>fileRef.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-sm font-medium"><Upload className="h-4 w-4"/> {files.length?`${files.length} file${files.length>1?'s':''} selected`:'Upload files'}</button>
          </div>

          <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
            <div className="font-semibold">Where should it run?</div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setDeployment('local')} className={`rounded-xl border p-3 text-left text-xs ${deployment==='local'?'border-emerald-300 bg-emerald-50':'border-zinc-200'}`}><HardDrive className="mb-2 h-4 w-4"/><b>Private local</b><span className="mt-1 block text-zinc-500">Chroma + local model</span></button><button onClick={()=>setDeployment('cloud')} className={`rounded-xl border p-3 text-left text-xs ${deployment==='cloud'?'border-indigo-300 bg-indigo-50':'border-zinc-200'}`}><Cloud className="mb-2 h-4 w-4"/><b>Cloud ready</b><span className="mt-1 block text-zinc-500">Qdrant configuration</span></button></div>
            <button disabled={!plan||!hasKnowledge||building} onClick={buildRag} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-40">{building?<><Loader2 className="h-4 w-4 animate-spin"/>{buildStage||'Building'}</>:<><Rocket className="h-4 w-4"/> Build & validate RAG</>}</button>
            {error&&<div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">{error}</div>}
          </div>
        </aside>
      </section>

      {result && <section className="mt-5 rounded-[26px] border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-start gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-600 text-white"><Check className="h-5 w-5"/></div><div><h2 className="font-semibold">RAG created: {deployedType || 'supported pipeline'}</h2><p className="mt-1 text-sm text-zinc-600">Pipeline {pipelineId}. Backend configuration validation: {result.deployment_info?.validation?.valid===false?'failed':'passed'}.</p></div></div>{pipelineId&&<a href={`/chat/${pipelineId}`} className="rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Open customer test chat</a>}</div>
        {validation&&<div className={`mt-4 rounded-2xl border p-4 text-sm ${validation.passed?'border-emerald-200 bg-white':'border-amber-200 bg-amber-50'}`}><b>{validation.passed?'Runtime query passed':'Runtime query needs attention'}</b><p className="mt-2 text-xs leading-5 text-zinc-600">{validation.answer}</p></div>}
      </section>}

      <section className="mt-10 border-t border-zinc-200 pt-9">
        <div className="max-w-3xl"><span className="text-xs font-semibold uppercase tracking-[.18em] text-indigo-600">What the factory does for the customer</span><h2 className="mt-3 text-3xl font-semibold tracking-tight">One conversation, a complete grounded assistant.</h2><p className="mt-3 text-zinc-500">The simple chat sits above the full platform details. Customers do not need to understand chunk sizes, retrievers or graph pipelines before getting a safe starting point.</p></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          ['1', 'Understand intent', 'Backend model classifies the business outcome or respects the dropdown override.'],
          ['2', 'Ground in knowledge', 'Web pages and uploaded files are parsed into the customer-specific knowledge store.'],
          ['3', 'Build safely', 'Only architectures in the real backend registry can be deployed; unsupported types are rejected.'],
          ['4', 'Prove it works', 'The factory sends a real query through the new pipeline before presenting it as ready.'],
        ].map(([n,t,d])=><div key={n} className="rounded-2xl border border-zinc-200 bg-white p-5"><span className="grid h-8 w-8 place-items-center rounded-full bg-zinc-950 text-xs font-bold text-white">{n}</span><h3 className="mt-4 font-semibold">{t}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{d}</p></div>)}</div>
      </section>

      <section className="mt-10 pb-12">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight">All backend-supported RAG architectures</h2><p className="mt-2 text-sm text-zinc-500">Auto mode chooses from this same list—never from a marketing-only architecture.</p></div><a href="/advanced" className="flex items-center gap-2 text-sm font-semibold text-indigo-700">Open expert controls <ArrowRight className="h-4 w-4"/></a></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{RAG_OPTIONS.filter(x=>x.id!=='auto').map(item=>{const Icon=item.icon;return <button key={item.id} onClick={()=>{setSelectedType(item.id);window.scrollTo({top:0,behavior:'smooth'})}} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-indigo-200"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-100"><Icon className="h-5 w-5"/></span><span><b className="block text-sm">{item.label}</b><span className="mt-1 block text-sm leading-5 text-zinc-500">{item.summary}</span></span></div></button>})}</div>
      </section>
    </div>
  </main>;
}
