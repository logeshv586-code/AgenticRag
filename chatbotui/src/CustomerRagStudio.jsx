import React, { useMemo, useState } from 'react';
import { ArrowRight, Bot, Check, ChevronLeft, Cloud, Database, FileText, Globe2, HardDrive, Loader2, MessageSquareText, Rocket, ShieldCheck, Sparkles, Upload, WandSparkles, Zap } from 'lucide-react';
import { API_BASE_URL } from './config';

const USE_CASES = [
  { id: 'support', title: 'Customer Support', desc: 'Answer product, policy and troubleshooting questions.', ragType: 'conversational', icon: MessageSquareText, preset: 'high_accuracy', features: ['citations', 'hallucinationGuard', 'streamingResponse'] },
  { id: 'knowledge', title: 'Company Knowledge', desc: 'Search SOPs, manuals, policies and internal documents.', ragType: 'citation', icon: FileText, preset: 'high_accuracy', features: ['citations', 'explainability', 'hallucinationGuard'] },
  { id: 'research', title: 'Research Agent', desc: 'Reason across your knowledge and optionally use approved tools.', ragType: 'agentic', icon: Sparkles, preset: 'high_accuracy', features: ['citations', 'explainability', 'hallucinationGuard'] },
  { id: 'live', title: 'Live Information', desc: 'Keep answers aligned with frequently changing sources.', ragType: 'realtime', icon: Zap, preset: 'balanced', features: ['citations', 'streamingResponse'] },
  { id: 'global', title: 'Multilingual Assistant', desc: 'Serve teams and customers across languages.', ragType: 'crosslingual', icon: Globe2, preset: 'balanced', features: ['multilingual', 'citations', 'hallucinationGuard'] },
  { id: 'custom', title: 'Custom RAG', desc: 'Start with a safe baseline and tune it later.', ragType: 'basic', icon: WandSparkles, preset: 'balanced', features: ['citations', 'hallucinationGuard'] },
];

const DEPLOYMENTS = [
  { id: 'local', title: 'Private on this machine', desc: 'Best for sensitive data and first-time setup.', icon: HardDrive },
  { id: 'cloud', title: 'Cloud ready', desc: 'Use a managed vector database for scale.', icon: Cloud },
];

function StepPill({ number, label, active, done }) {
  return <div className={`flex items-center gap-2 text-sm ${active ? 'text-zinc-950' : done ? 'text-emerald-700' : 'text-zinc-400'}`}>
    <span className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold ${active ? 'border-zinc-950 bg-zinc-950 text-white' : done ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-white'}`}>{done ? <Check className="h-4 w-4"/> : number}</span>
    <span className="hidden md:inline font-medium">{label}</span>
  </div>;
}

export default function CustomerRagStudio() {
  const [step, setStep] = useState(1);
  const [useCase, setUseCase] = useState(USE_CASES[0]);
  const [ragName, setRagName] = useState('My Knowledge Assistant');
  const [urls, setUrls] = useState(['']);
  const [files, setFiles] = useState([]);
  const [deployment, setDeployment] = useState('local');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const validUrls = useMemo(() => urls.map(x => x.trim()).filter(Boolean), [urls]);
  const hasData = validUrls.length > 0 || files.length > 0;

  const config = useMemo(() => ({
    ragName: ragName.trim() || 'My Knowledge Assistant',
    extracted_texts: [],
    ragType: useCase.ragType,
    dbType: deployment === 'local' ? 'local' : 'cloud',
    cloudDb: deployment === 'cloud' ? 'qdrant' : '',
    localDb: 'chroma',
    dynamicConfig: useCase.ragType === 'agentic' ? { tools: ['Calculator', 'Calendar'] } : {},
    llmModel: 'qwen-local',
    embeddingModel: 'bge-local',
    chunkSize: 700,
    topK: 6,
    useReranker: true,
    theme: 'cyan',
    features: useCase.features,
    deploymentType: 'api',
    apiKeys: {},
    privacyMode: deployment === 'local',
    explainability: true,
    scrapeMode: 'static',
    tuningPreset: useCase.preset,
    hallucinationGuard: useCase.features.includes('hallucinationGuard'),
    toxicityFilter: false,
    structuredOutput: false,
    streamingResponse: useCase.features.includes('streamingResponse')
  }), [ragName, useCase, deployment]);

  const ingestAndDeploy = async () => {
    if (!hasData) { setError('Add at least one website or file so your RAG has knowledge to use.'); return; }
    setError('');
    setStatus('ingesting');
    try {
      if (validUrls.length) {
        const r = await fetch(`${API_BASE_URL}/api/ingest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ragName: config.ragName, urls: validUrls, mode: 'static' }) });
        if (!r.ok) throw new Error(`Website ingestion failed (${r.status})`);
      }
      for (const file of files) {
        const body = new FormData();
        body.append('file', file);
        body.append('ragName', config.ragName);
        const r = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body });
        if (!r.ok) throw new Error(`File upload failed for ${file.name}`);
      }
      setStatus('deploying');
      const deploy = await fetch(`${API_BASE_URL}/api/deploy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
      if (!deploy.ok) {
        const detail = await deploy.text();
        throw new Error(`RAG creation failed (${deploy.status}): ${detail}`);
      }
      const data = await deploy.json();
      setResult(data);
      setStatus('ready');
      setStep(4);
    } catch (e) {
      setStatus('error');
      setError(e.message || 'Could not create the RAG.');
    }
  };

  const pipelineId = result?.pipeline_id || result?.deployment_info?.pipeline_id;

  return <main className="min-h-screen bg-[#f7f8fb] text-zinc-950">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(99,102,241,.12),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(14,165,233,.10),transparent_25%)]" />
    <div className="relative mx-auto max-w-7xl px-5 py-6 md:px-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-zinc-950 text-white shadow-lg"><Bot className="h-5 w-5"/></div><div><p className="font-semibold tracking-tight">OmniRAG Studio</p><p className="text-xs text-zinc-500">Build a grounded AI assistant without RAG expertise</p></div></div>
        <a href="/advanced" className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50">Advanced builder</a>
      </header>

      <section className="grid gap-7 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,.07)] md:p-8">
          <div className="mb-8 flex items-center justify-between gap-2 border-b border-zinc-100 pb-6">
            <StepPill number={1} label="Goal" active={step===1} done={step>1}/><div className="h-px flex-1 bg-zinc-100"/><StepPill number={2} label="Knowledge" active={step===2} done={step>2}/><div className="h-px flex-1 bg-zinc-100"/><StepPill number={3} label="Review" active={step===3} done={step>3}/><div className="h-px flex-1 bg-zinc-100"/><StepPill number={4} label="Ready" active={step===4} done={false}/>
          </div>

          {step === 1 && <div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">1 · Tell us the outcome</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">What should your AI assistant do?</h1>
            <p className="mt-3 max-w-2xl text-zinc-500">Choose the closest goal. We select the RAG architecture, retrieval settings and safety defaults for you.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">{USE_CASES.map(item => { const Icon=item.icon; const selected=item.id===useCase.id; return <button key={item.id} onClick={()=>setUseCase(item)} className={`rounded-2xl border p-4 text-left transition ${selected?'border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-100':'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'}`}><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected?'bg-indigo-600 text-white':'bg-zinc-100 text-zinc-700'}`}><Icon className="h-5 w-5"/></span><span><b className="block text-sm">{item.title}</b><span className="mt-1 block text-sm leading-5 text-zinc-500">{item.desc}</span></span></div></button>})}</div>
            <div className="mt-6"><label className="mb-2 block text-sm font-medium">Assistant name</label><input value={ragName} onChange={e=>setRagName(e.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"/></div>
          </div>}

          {step === 2 && <div>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">2 · Add trusted knowledge</span><h2 className="mt-4 text-3xl font-semibold tracking-tight">What should it learn from?</h2><p className="mt-3 text-zinc-500">Add company pages, documentation or files. Answers will be grounded in this knowledge.</p>
            <div className="mt-7 rounded-2xl border border-zinc-200 p-5"><div className="mb-3 flex items-center gap-2 font-medium"><Globe2 className="h-5 w-5"/> Websites</div>{urls.map((url,i)=><div key={i} className="mb-2 flex gap-2"><input value={url} onChange={e=>setUrls(prev=>prev.map((x,n)=>n===i?e.target.value:x))} placeholder="https://docs.yourcompany.com" className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-sky-300"/>{i===urls.length-1&&<button onClick={()=>setUrls(prev=>[...prev,''])} className="rounded-xl border border-zinc-200 px-4 text-sm">Add</button>}</div>)}</div>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-7 text-center hover:border-indigo-300"><Upload className="h-5 w-5"/><span><b className="block text-sm">Upload documents</b><span className="text-xs text-zinc-500">PDF, DOCX, TXT, CSV, images and supported audio</span></span><input type="file" multiple className="hidden" onChange={e=>setFiles(Array.from(e.target.files||[]))}/></label>
            {files.length>0&&<div className="mt-3 text-sm text-emerald-700">{files.length} file{files.length>1?'s':''} selected: {files.slice(0,3).map(f=>f.name).join(', ')}</div>}
          </div>}

          {step === 3 && <div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">3 · Review before build</span><h2 className="mt-4 text-3xl font-semibold tracking-tight">Your production-safe starting point</h2><p className="mt-3 text-zinc-500">You can change expert settings later. For now, we use conservative defaults that prioritize grounded answers.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">{DEPLOYMENTS.map(item=>{const Icon=item.icon;return <button key={item.id} onClick={()=>setDeployment(item.id)} className={`rounded-2xl border p-4 text-left ${deployment===item.id?'border-emerald-300 bg-emerald-50/60 ring-2 ring-emerald-100':'border-zinc-200'}`}><Icon className="mb-3 h-5 w-5"/><b className="block text-sm">{item.title}</b><span className="mt-1 block text-sm text-zinc-500">{item.desc}</span></button>})}</div>
            <div className="mt-5 rounded-2xl bg-zinc-950 p-5 text-white"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-5 w-5 text-emerald-400"/> Build configuration</div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-zinc-400">Architecture</span><br/>{useCase.ragType}</p><p><span className="text-zinc-400">Accuracy preset</span><br/>{useCase.preset.replace('_',' ')}</p><p><span className="text-zinc-400">Retrieval</span><br/>Reranked · Top 6</p><p><span className="text-zinc-400">Evidence</span><br/>Citations + hallucination guard</p></div></div>
          </div>}

          {step === 4 && <div className="py-6 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Check className="h-8 w-8"/></div><h2 className="mt-5 text-3xl font-semibold">Your RAG is ready</h2><p className="mx-auto mt-2 max-w-lg text-zinc-500">The pipeline was created from your selected goal and knowledge sources. Test it before sharing it with customers.</p>{pipelineId&&<div className="mx-auto mt-6 max-w-lg rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left text-sm"><span className="text-zinc-500">Pipeline ID</span><br/><code className="break-all font-semibold">{pipelineId}</code></div>}<div className="mt-6 flex flex-wrap justify-center gap-3">{pipelineId&&<a href={`/chat/${pipelineId}`} className="rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white">Open test chat</a>}<button onClick={()=>{setStep(1);setResult(null);setStatus('idle')}} className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold">Create another</button></div></div>}

          {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {step < 4 && <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-6"><button disabled={step===1 || status==='ingesting'||status==='deploying'} onClick={()=>setStep(s=>Math.max(1,s-1))} className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 disabled:opacity-30"><ChevronLeft className="h-4 w-4"/> Back</button>{step<3?<button onClick={()=>setStep(s=>s+1)} disabled={step===2&&!hasData} className="flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-40">Continue <ArrowRight className="h-4 w-4"/></button>:<button onClick={ingestAndDeploy} disabled={status==='ingesting'||status==='deploying'} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60">{status==='ingesting'||status==='deploying'?<><Loader2 className="h-4 w-4 animate-spin"/>{status==='ingesting'?'Reading knowledge…':'Building RAG…'}</>:<><Rocket className="h-4 w-4"/> Build my RAG</>}</button>}</div>}
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-sm"><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-indigo-600"/> AI configuration preview</div><h3 className="mt-4 text-xl font-semibold">{useCase.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">We translate the business goal into an actual RAG architecture instead of asking customers to understand vector databases first.</p><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between border-b border-zinc-100 pb-3"><span className="text-zinc-500">RAG type</span><b>{useCase.ragType}</b></div><div className="flex justify-between border-b border-zinc-100 pb-3"><span className="text-zinc-500">Model</span><b>Local Qwen</b></div><div className="flex justify-between border-b border-zinc-100 pb-3"><span className="text-zinc-500">Vector store</span><b>{deployment==='local'?'ChromaDB':'Qdrant'}</b></div><div className="flex justify-between"><span className="text-zinc-500">Safety</span><b className="text-emerald-700">Grounded</b></div></div></div>
          <div className="rounded-[28px] bg-zinc-950 p-6 text-white"><div className="flex items-center gap-2 text-sm font-semibold"><Database className="h-4 w-4 text-sky-400"/> Real workflow</div><div className="mt-5 space-y-4 text-sm">{['Understand the customer goal','Ingest and parse trusted sources','Choose retrieval architecture','Index + rerank evidence','Generate grounded answers','Test before customer rollout'].map((x,i)=><div key={x} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs">{i+1}</span><span className="text-zinc-300">{x}</span></div>)}</div></div>
        </aside>
      </section>
    </div>
  </main>;
}
