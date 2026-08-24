import React, { useMemo, useState } from 'react';
import {
  Activity, Brain, Database, Eye, Info, Languages, LayoutGrid, MessageCircle,
  Mic, PieChart, Search, Shield, Users, Workflow, Zap,
} from 'lucide-react';

const RAG_PROFILES = {
  'Universal RAG': {
    id: 'basic', complexity: 1, grounding: 72, depth: 48, freshness: 25, multimodal: 20, agency: 10,
    accent: '#4f46e5', icon: Search, note: 'Dense-first retrieval with lexical fallback.',
  },
  'Hybrid Search RAG': {
    id: 'hybrid', complexity: 3, grounding: 88, depth: 82, freshness: 40, multimodal: 20, agency: 15,
    accent: '#2563eb', icon: Database, note: 'BM25 + dense retrieval with reciprocal-rank fusion.',
  },
  'Verified Citation RAG': {
    id: 'citation', complexity: 3, grounding: 96, depth: 78, freshness: 35, multimodal: 20, agency: 10,
    accent: '#0f766e', icon: Shield, note: 'Retrieved source IDs with citation-constrained generation.',
  },
  'Realtime RAG': {
    id: 'realtime', complexity: 4, grounding: 86, depth: 72, freshness: 100, multimodal: 30, agency: 20,
    accent: '#0284c7', icon: Zap, note: 'Freshness-aware retrieval plus monitored source updates.',
  },
  'Personalized RAG': {
    id: 'personalized', complexity: 3, grounding: 84, depth: 72, freshness: 40, multimodal: 20, agency: 25,
    accent: '#7c3aed', icon: Users, note: 'Profile-aware query expansion while preserving source truth.',
  },
  'Multimodal RAG': {
    id: 'multimodal', complexity: 5, grounding: 88, depth: 82, freshness: 55, multimodal: 100, agency: 20,
    accent: '#9333ea', icon: Eye, note: 'Text, OCR, vision descriptions and audio-transcript evidence.',
  },
  'Conversational RAG': {
    id: 'conversational', complexity: 3, grounding: 86, depth: 74, freshness: 35, multimodal: 25, agency: 35,
    accent: '#0891b2', icon: MessageCircle, note: 'Grounded conversation memory for follow-up questions.',
  },
  'Agentic RAG': {
    id: 'agentic', complexity: 5, grounding: 92, depth: 90, freshness: 60, multimodal: 35, agency: 100,
    accent: '#c2410c', icon: Brain, note: 'Retrieval-first planning, safe tools and answer verification.',
  },
  'Graph / Structured RAG': {
    id: 'structured', complexity: 5, grounding: 90, depth: 100, freshness: 40, multimodal: 20, agency: 45,
    accent: '#0369a1', icon: Workflow, note: 'Entity extraction, graph traversal and document retrieval.',
  },
  'Cross-lingual RAG': {
    id: 'crosslingual', complexity: 4, grounding: 84, depth: 76, freshness: 35, multimodal: 25, agency: 20,
    accent: '#be123c', icon: Languages, note: 'Detect, translate, retrieve and translate the answer back.',
  },
  'Voice RAG': {
    id: 'voice', complexity: 4, grounding: 82, depth: 68, freshness: 35, multimodal: 70, agency: 25,
    accent: '#0e7490', icon: Mic, note: 'Speech-to-text, grounded retrieval and text-to-speech.',
  },
};

const AXES = [
  ['Grounding', 'grounding'],
  ['Knowledge depth', 'depth'],
  ['Freshness', 'freshness'],
  ['Multimodal', 'multimodal'],
  ['Agency', 'agency'],
];

function pointFor(index, value, radius = 112, center = 140) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / AXES.length;
  const r = radius * (value / 100);
  return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
}

function RadarProfile({ profile }) {
  const polygon = AXES.map(([, key], index) => pointFor(index, profile[key])).map(p => p.join(',')).join(' ');
  const rings = [25, 50, 75, 100].map(level => (
    <polygon
      key={level}
      points={AXES.map((_, index) => pointFor(index, level)).map(p => p.join(',')).join(' ')}
      fill="none"
      stroke="currentColor"
      className="text-zinc-200"
      strokeWidth="1"
    />
  ));

  return (
    <svg viewBox="0 0 280 280" className="mx-auto h-full min-h-[260px] w-full max-w-[360px]" role="img" aria-label="Architecture capability profile">
      {rings}
      {AXES.map(([label], index) => {
        const [x, y] = pointFor(index, 116);
        return <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-zinc-500 text-[9px] font-semibold">{label}</text>;
      })}
      <polygon points={polygon} fill={`${profile.accent}22`} stroke={profile.accent} strokeWidth="3" />
      {AXES.map(([, key], index) => {
        const [x, y] = pointFor(index, profile[key]);
        return <circle key={key} cx={x} cy={y} r="4" fill={profile.accent} />;
      })}
    </svg>
  );
}

function ArchitectureMatrix({ selectedName, onSelect }) {
  const entries = Object.entries(RAG_PROFILES);
  const width = 660;
  const height = 330;
  const left = 56;
  const right = 24;
  const top = 24;
  const bottom = 48;
  const x = complexity => left + ((complexity - 1) / 4) * (width - left - right);
  const y = grounding => top + ((100 - grounding) / 40) * (height - top - bottom);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full min-h-[300px] w-full" role="img" aria-label="RAG architecture complexity and grounding matrix">
      {[1, 2, 3, 4, 5].map(level => (
        <g key={level}>
          <line x1={x(level)} x2={x(level)} y1={top} y2={height - bottom} stroke="#e4e4e7" strokeWidth="1" />
          <text x={x(level)} y={height - 20} textAnchor="middle" className="fill-zinc-500 text-[10px]">{level}</text>
        </g>
      ))}
      {[60, 70, 80, 90, 100].map(level => (
        <g key={level}>
          <line x1={left} x2={width - right} y1={y(level)} y2={y(level)} stroke="#e4e4e7" strokeWidth="1" />
          <text x={left - 12} y={y(level) + 3} textAnchor="end" className="fill-zinc-500 text-[10px]">{level}</text>
        </g>
      ))}
      <text x={(left + width - right) / 2} y={height - 4} textAnchor="middle" className="fill-zinc-600 text-[10px] font-semibold">Implementation complexity</text>
      <text x="12" y={(top + height - bottom) / 2} transform={`rotate(-90 12 ${(top + height - bottom) / 2})`} textAnchor="middle" className="fill-zinc-600 text-[10px] font-semibold">Grounding emphasis</text>
      {entries.map(([name, profile]) => {
        const selected = selectedName === name;
        return (
          <g key={name} className="cursor-pointer" onClick={() => onSelect(name)}>
            <circle cx={x(profile.complexity)} cy={y(profile.grounding)} r={selected ? 10 : 7} fill={profile.accent} opacity={selected ? 1 : 0.72} />
            {selected && <circle cx={x(profile.complexity)} cy={y(profile.grounding)} r="15" fill="none" stroke={profile.accent} strokeWidth="2" opacity="0.35" />}
          </g>
        );
      })}
    </svg>
  );
}

function CapabilityBars({ profile }) {
  return (
    <div className="space-y-3">
      {AXES.map(([label, key]) => (
        <div key={key}>
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-zinc-600">
            <span>{label}</span><span>{profile[key]}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full" style={{ width: `${profile[key]}%`, backgroundColor: profile.accent }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RagAnalyticsDashboard() {
  const names = useMemo(() => Object.keys(RAG_PROFILES), []);
  const [selectedName, setSelectedName] = useState(names[0]);
  const [activeView, setActiveView] = useState('matrix');
  const profile = RAG_PROFILES[selectedName];
  const SelectedIcon = profile.icon;

  return (
    <section id="omni-analytics-suite" className="w-full overflow-hidden rounded-[32px] border border-zinc-200 bg-white p-5 shadow-sm md:p-7">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">
            <Activity className="h-3.5 w-3.5" /> Lightweight architecture intelligence
          </div>
          <h3 className="text-2xl font-black tracking-tight text-zinc-950">RAG architecture profiles</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">Compare the 11 real backend architectures without loading a heavyweight chart engine. Values describe design emphasis, not benchmarked accuracy or latency.</p>
        </div>
        <div className="flex rounded-2xl border border-zinc-200 bg-zinc-50 p-1">
          <button type="button" onClick={() => setActiveView('matrix')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${activeView === 'matrix' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}>
            <LayoutGrid className="h-3.5 w-3.5" /> Matrix
          </button>
          <button type="button" onClick={() => setActiveView('profile')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${activeView === 'profile' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}>
            <PieChart className="h-3.5 w-3.5" /> Profile
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)_270px]">
        <aside className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-3">
          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Supported architectures</div>
          <div className="space-y-1">
            {names.map(name => {
              const item = RAG_PROFILES[name];
              const Icon = item.icon;
              const selected = name === selectedName;
              return (
                <button key={name} type="button" onClick={() => setSelectedName(name)} className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition ${selected ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500 hover:bg-white/70'}`}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${item.accent}16`, color: item.accent }}><Icon className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0"><span className="block truncate text-xs font-bold">{name}</span><span className="block text-[10px] text-zinc-400">{item.id}</span></span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-h-[390px] rounded-3xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{activeView === 'matrix' ? 'Complexity vs grounding' : 'Capability profile'}</div>
              <div className="mt-1 text-sm font-bold text-zinc-900">{selectedName}</div>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ backgroundColor: `${profile.accent}16`, color: profile.accent }}><SelectedIcon className="h-5 w-5" /></span>
          </div>
          {activeView === 'matrix'
            ? <ArchitectureMatrix selectedName={selectedName} onSelect={setSelectedName} />
            : <RadarProfile profile={profile} />}
        </div>

        <aside className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white shadow-sm" style={{ color: profile.accent }}><SelectedIcon className="h-5 w-5" /></span>
            <div><div className="text-sm font-black text-zinc-950">{selectedName}</div><div className="mt-1 text-xs leading-5 text-zinc-500">{profile.note}</div></div>
          </div>
          <CapabilityBars profile={profile} />
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-3 text-[11px] leading-5 text-zinc-500">
            <div className="mb-1 flex items-center gap-2 font-bold text-zinc-700"><Info className="h-3.5 w-3.5" /> Interpretation</div>
            These values are transparent architecture-design profiles used for comparison. Runtime quality is certified separately by the live 11/11 build-and-query matrix.
          </div>
        </aside>
      </div>
    </section>
  );
}
