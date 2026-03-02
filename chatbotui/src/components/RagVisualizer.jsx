import React from 'react';
import { Database, Search, Bot, Layers, CheckCircle, Globe, Zap, Shield, Eye, Upload, FileText, Activity } from 'lucide-react';

const NODE_COLORS = {
    ingestion: { color: '#f97316' },
    embedder: { color: '#3b82f6' },
    database: { color: '#6366f1' },
    retriever: { color: '#06b6d4' },
    reranker: { color: '#f59e0b' },
    processor: { color: '#10b981' },
    llm: { color: '#a855f7' },
    features: { color: '#14b8a6' },
    deployment: { color: '#f43f5e' },
};

const THEME_COLORS = {
    cyan: '#22d3ee',
    pink: '#ff2e93',
    emerald: '#10b981',
    violet: '#8b5cf6',
    gold: '#fbbf24',
    red: '#ef4444',
    teal: '#14b8a6',
    orange: '#f97316'
};

const NODE_ICONS = {
    ingestion: Upload, embedder: FileText, database: Database,
    retriever: Search, reranker: Zap, processor: Layers,
    llm: Bot, features: Shield, deployment: Globe,
};

const RAG_NAMES = {
    basic: 'Universal Neural RAG',
    conversational: 'Enterprise Cognitive RAG',
    agentic: 'Autonomous Intelligence Node',
    structured: 'Synaptic Graph',
    multimodal: 'Global Context RAG',
    crosslingual: 'Universal Matrix',
    citation: 'Verified Intelligence',
    realtime: 'Live Neural Stream',
    personalized: 'Adaptive Persona',
    voice: 'Vocal Synthesis Node',
};

const LLM_NAMES = {
    'qwen-local': 'Qwen 2.5 14B', 'mistral-local': 'Mistral 7B',
    'gpt4o': 'GPT-4o', 'claude35': 'Claude 3.5', 'gemini': 'Gemini Pro',
};

export default function RagVisualizer({ config }) {
    const {
        ragType = 'basic', dbType = 'local', cloudDb = '', localDb = 'chroma',
        llmModel = 'qwen-local', embeddingModel = 'bge-local',
        topK = 5, useReranker = false, features = [],
        deploymentType = 'api', scrapeMode = 'static', chunkSize = 500,
        explainability = false, privacyMode = false,
        dynamicConfig = {}, tuningPreset = null, theme = 'cyan'
    } = config || {};

    const dbName = dbType === 'cloud' ? (cloudDb || 'pinecone') : (localDb || 'chroma');
    const allFeatures = [...features];
    if (explainability) allFeatures.push('explainability');
    if (privacyMode) allFeatures.push('privacy');

    const effChunkSize = tuningPreset ? (tuningPreset === 'fast' ? 1200 : tuningPreset === 'high_accuracy' ? 400 : 800) : chunkSize;
    const effTopK = tuningPreset ? (tuningPreset === 'fast' ? 3 : tuningPreset === 'high_accuracy' ? 10 : 5) : topK;
    const effReranker = tuningPreset ? (tuningPreset === 'high_accuracy' || tuningPreset === 'deep_analysis') : useReranker;

    let nodes = [
        { label: `${scrapeMode === 'dynamic' ? 'Dynamic' : 'Static'} Scraping`, type: 'ingestion', details: `Chunks: ${effChunkSize}t` },
    ];

    if (ragType === 'voice') {
        nodes = [{ label: 'Audio In (Mic)', type: 'processor', details: dynamicConfig.voiceLanguage || 'en-US' }];
        nodes.push({ label: 'Speech-to-Text', type: 'processor' });
    }

    nodes.push({ label: embeddingModel === 'bge-local' ? 'BGE-m3 Local' : embeddingModel, type: 'embedder' });
    nodes.push({ label: `${dbName.charAt(0).toUpperCase() + dbName.slice(1)} Cloud`, type: 'database', details: dbType.toUpperCase() });

    if (ragType === 'structured') {
        nodes.push({ label: 'Entity Extraction', type: 'processor' });
        nodes.push({ label: 'Knowledge Graph', type: 'database', details: 'Neo4j / NetworkX' });
    }

    nodes.push({ label: `Top-${effTopK} Retrieval`, type: 'retriever' });

    if (ragType === 'structured') {
        nodes.push({ label: `Graph Traversal (${dynamicConfig.relationshipDepth || 2}-hop)`, type: 'retriever' });
    }

    if (effReranker) {
        nodes.push({ label: 'Neural Reranker', type: 'reranker', details: 'MS-Marco Cross-Encoder' });
    }

    if (ragType === 'conversational') {
        nodes.push({ label: `Context Memory (${dynamicConfig.historyLength || 10})`, type: 'database', details: 'Session Vector' });
    }

    if (ragType === 'agentic') {
        nodes.push({ label: 'Agentic Planner', type: 'processor', details: 'Task Decomposition' });
        nodes.push({ label: `Executor Tools (${(dynamicConfig.tools || []).length})`, type: 'processor' });
    }

    if (ragType === 'crosslingual') {
        nodes.push({ label: 'Lang Detect', type: 'processor' });
        nodes.push({ label: `Translate -> EN`, type: 'processor' });
    }

    nodes.push({ label: `LLM Generator`, type: 'llm', details: LLM_NAMES[llmModel] || llmModel });

    if (ragType === 'crosslingual') {
        nodes.push({ label: `Translate -> Base`, type: 'processor' });
    }

    if (ragType === 'voice') {
        nodes.push({ label: 'Edge TTS', type: 'processor' });
    }

    nodes.push({ label: 'Output Intercept', type: 'features', details: allFeatures.length ? `${allFeatures.length} policies active` : 'No checks' });

    nodes.push({ label: `${deploymentType.toUpperCase()} Endpoint`, type: 'deployment', details: 'Ready for use' });

    const activeColor = THEME_COLORS[theme] || THEME_COLORS.cyan;

    return (
        <div className="relative w-full h-[320px] bg-[#0b0b0e] border border-white/5 rounded-3xl p-6 overflow-hidden glass-card mt-2 shadow-2xl">
            {/* Dynamic Animated Grid Background */}
            <div className="absolute inset-0 opacity-10 pointer-events-none transition-colors duration-1000" style={{ backgroundImage: `radial-gradient(circle at center, ${activeColor} 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />

            {/* Glowing Theme Orb */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[100px] opacity-[0.15] pointer-events-none transition-colors duration-1000" style={{ backgroundColor: activeColor }} />

            <div className="flex items-center justify-between mb-8 relative z-10">
                <h3 className="text-xl font-black text-white flex items-center gap-3 tracking-tighter" style={{ textShadow: `0 0 20px ${activeColor}80` }}>
                    <Activity className="w-5 h-5 animate-pulse" style={{ color: activeColor }} />
                    Neural Architecture Canvas
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{RAG_NAMES[ragType] || 'Pipeline Node'}</span>
                    <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: activeColor }} />
                </div>
            </div>

            <div className="relative z-10 w-full h-40">
                {/* Visual Connector Line */}
                <div className="absolute top-[45%] left-0 w-max min-w-full h-0.5 bg-white/5 -translate-y-1/2 pointer-events-none">
                    <div className="h-full w-1/4 animate-[shimmer_3s_infinite_linear]" style={{ background: `linear-gradient(90deg, transparent, ${activeColor}, transparent)` }} />
                </div>

                <div className="flex gap-4 h-full overflow-x-auto overflow-y-hidden pb-4 items-center pl-2 pr-10 scrollbar-premium" style={{ scrollSnapType: 'x proximity' }}>
                    {nodes.map((node, i) => {
                        const Icon = NODE_ICONS[node.type] || Layers;
                        const nColor = NODE_COLORS[node.type]?.color || activeColor;
                        return (
                            <div key={i} className="relative shrink-0 w-[180px] bg-black/60 backdrop-blur-md border border-white/10 p-5 rounded-2xl group transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl hover:border-white/30" style={{ scrollSnapAlign: 'center', boxShadow: `0 10px 30px transparent` }}>
                                {/* Hover Glow */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />

                                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-inner group-hover:bg-white/10" style={{ boxShadow: `0 0 20px ${nColor}20` }}>
                                    <Icon className="w-6 h-6" style={{ color: nColor }} />
                                </div>
                                <div className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">{node.type}</div>
                                <div className="text-sm font-bold text-white truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 transition-colors">{node.label}</div>
                                <div className="text-xs font-mono text-zinc-500 mt-2 truncate overflow-hidden text-ellipsis bg-black/40 px-2 py-1 rounded inline-block w-full">{node.details || 'SYSTEM'}</div>

                                {/* Connection Dot */}
                                {i < nodes.length - 1 && (
                                    <div className="absolute top-[45%] -right-2 h-3 w-3 rounded-full border-2 border-[#0b0b0e] z-10 transition-colors" style={{ backgroundColor: activeColor }} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
