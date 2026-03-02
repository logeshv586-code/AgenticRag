import React from 'react';
import { Database, Search, Bot, Layers, CheckCircle, Globe, Zap, Shield, Eye, Upload, FileText } from 'lucide-react';

const NODE_COLORS = {
    ingestion: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'shadow-orange-500/10' },
    embedder: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/10' },
    database: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/30', text: 'text-indigo-400', glow: 'shadow-indigo-500/10' },
    retriever: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'shadow-cyan-500/10' },
    reranker: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-amber-500/10' },
    processor: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'shadow-cyan-500/10' },
    llm: { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/10' },
    features: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
    deployment: { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400', glow: 'shadow-rose-500/10' },
};

const NODE_ICONS = {
    ingestion: Upload, embedder: FileText, database: Database,
    retriever: Search, reranker: Zap, processor: Layers,
    llm: Bot, features: CheckCircle, deployment: Globe,
};

const RAG_NAMES = {
    basic: 'Standard', conversational: 'Conversational', agentic: 'Agentic',
    structured: 'Graph', multimodal: 'Multimodal', crosslingual: 'Cross-Lingual',
    citation: 'Citation', realtime: 'Real-Time', personalized: 'Personalized', voice: 'Voice',
};

const LLM_NAMES = {
    'qwen-local': 'Qwen 2.5 14B', 'mistral-local': 'Mistral 7B',
    'gpt4o': 'GPT-4o', 'claude35': 'Claude 3.5', 'gemini': 'Gemini Pro',
};

function ConnectorLine() {
    return (
        <div className="flex flex-col items-center justify-center">
            <div className="w-px h-5 bg-gradient-to-b from-zinc-600 to-zinc-700" />
            <div className="w-2 h-2 rounded-full bg-zinc-600 border border-zinc-800 -mt-px" />
        </div>
    );
}

function PipelineNode({ label, type, details }) {
    const colors = NODE_COLORS[type] || NODE_COLORS.processor;
    const Icon = NODE_ICONS[type] || Layers;
    return (
        <div className={`bg-zinc-900/80 border ${colors.border} p-3.5 rounded-xl flex items-center gap-3 w-full shadow-lg ${colors.glow} relative overflow-hidden transition-all duration-300 hover:scale-[1.02]`}>
            <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] to-transparent pointer-events-none" />
            <div className={`${colors.bg} p-2.5 rounded-lg shrink-0`}>
                <Icon className={`${colors.text} w-4.5 h-4.5`} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{type}</div>
                <div className="text-sm text-white font-semibold truncate">{label}</div>
                {details && <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{details}</div>}
            </div>
        </div>
    );
}

export default function RagVisualizer({ config }) {
    const {
        ragType = 'basic', dbType = 'local', cloudDb = '', localDb = 'chroma',
        llmModel = 'qwen-local', embeddingModel = 'bge-local',
        topK = 5, useReranker = false, features = [],
        deploymentType = 'api', scrapeMode = 'static', chunkSize = 500,
        explainability = false, privacyMode = false,
        dynamicConfig = {}, tuningPreset = null
    } = config || {};

    const dbName = dbType === 'cloud' ? (cloudDb || 'pinecone') : (localDb || 'chroma');
    const allFeatures = [...features];
    if (explainability) allFeatures.push('explainability');
    if (privacyMode) allFeatures.push('privacy');

    // Determine effective settings
    const effChunkSize = tuningPreset ? (tuningPreset === 'fast' ? 1200 : tuningPreset === 'high_accuracy' ? 400 : 800) : chunkSize;
    const effTopK = tuningPreset ? (tuningPreset === 'fast' ? 3 : tuningPreset === 'high_accuracy' ? 10 : 5) : topK;
    const effReranker = tuningPreset ? (tuningPreset === 'high_accuracy' || tuningPreset === 'deep_analysis') : useReranker;

    let nodes = [
        { label: `${scrapeMode === 'dynamic' ? 'Dynamic' : 'Static'} Scraping + OCR`, type: 'ingestion', details: `Chunk: ${effChunkSize} tokens` },
    ];

    // Voice special case (audio in)
    if (ragType === 'voice') {
        nodes = [{ label: 'Audio Input (Microphone)', type: 'processor', details: dynamicConfig.voiceLanguage || 'en-US' }];
        nodes.push({ label: 'Speech-to-Text (Whisper)', type: 'processor' });
    }

    // Embedder & DB
    nodes.push({ label: embeddingModel === 'bge-local' ? 'BGE-m3 (Local)' : embeddingModel, type: 'embedder' });
    nodes.push({ label: `${dbName.charAt(0).toUpperCase() + dbName.slice(1)} (${dbType})`, type: 'database' });

    // Graph RAG adds Graph Store
    if (ragType === 'structured') {
        nodes.push({ label: 'Entity Extractor (spaCy)', type: 'processor' });
        nodes.push({ label: 'Knowledge Graph Store', type: 'database', details: 'NetworkX / Neo4j' });
    }

    nodes.push({ label: `Top-${effTopK} Retriever`, type: 'retriever' });

    if (ragType === 'structured') {
        nodes.push({ label: `Graph Traversal (Depth: ${dynamicConfig.relationshipDepth || 2})`, type: 'retriever' });
    }

    if (effReranker) {
        nodes.push({ label: 'Neural Reranker', type: 'reranker', details: 'cross-encoder/ms-marco-MiniLM' });
    }

    // conversational adds Memory
    if (ragType === 'conversational') {
        nodes.push({ label: `Context Memory (Window: ${dynamicConfig.historyLength || 10})`, type: 'database', details: 'Thread-safe conversation state' });
    }

    // Agentic adds Planner & Tool Execution
    if (ragType === 'agentic') {
        nodes.push({ label: 'Agentic Planner', type: 'processor', details: 'Selects necessary tools' });
        const toolCount = (dynamicConfig.tools || []).length;
        nodes.push({ label: `Action Executor (${toolCount > 0 ? toolCount : 'Standard'} Tools)`, type: 'processor' });
    }

    // Cross-lingual adds Translation
    if (ragType === 'crosslingual') {
        nodes.push({ label: 'Language Detector', type: 'processor' });
        nodes.push({ label: `Translate to English`, type: 'processor', details: 'For optimal retrieval' });
    }

    nodes.push({ label: `${RAG_NAMES[ragType] || 'Custom'} RAG Prompt`, type: 'processor' });
    nodes.push({ label: LLM_NAMES[llmModel] || llmModel, type: 'llm' });

    // Cross-lingual translate back
    if (ragType === 'crosslingual') {
        nodes.push({ label: `Translate to ${dynamicConfig.targetLanguage || 'Target'}`, type: 'processor' });
    }

    // Voice TTS out
    if (ragType === 'voice') {
        nodes.push({ label: 'Text-to-Speech (Edge TTS)', type: 'processor' });
        nodes.push({ label: 'Audio Stream Output', type: 'processor' });
    }

    if (allFeatures.length > 0) {
        nodes.push({ label: allFeatures.join(', '), type: 'features' });
    }

    nodes.push({ label: `${deploymentType.toUpperCase()} Deployment`, type: 'deployment' });

    return (
        <div className="flex flex-col items-center justify-start space-y-1 p-5 animate-fade-in w-full min-h-max">
            <h3 className="text-lg font-bold text-white mb-3">Pipeline Architecture</h3>
            <div className="flex flex-col items-center w-full max-w-sm">
                {nodes.map((node, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && <ConnectorLine />}
                        <PipelineNode {...node} />
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
