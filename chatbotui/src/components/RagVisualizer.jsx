import React from 'react';
import { Database, Search, Bot, Layers, CheckCircle } from 'lucide-react';

export default function RagVisualizer({ config }) {
    const { ragType, vectorDb, useCase, features } = config;

    return (
        <div className="flex flex-col items-center justify-center space-y-8 p-6 animate-fade-in w-full">
            <h3 className="text-xl font-bold text-white mb-2">Architecture Preview</h3>

            <div className="flex flex-col items-center space-y-4 relative w-full max-w-md">

                {/* Document Store */}
                <div className="bg-zinc-900/80 border border-zinc-700/50 p-4 rounded-xl flex items-center gap-4 w-full shadow-lg">
                    <div className="bg-indigo-500/20 p-3 rounded-lg"><Database className="text-indigo-400 w-6 h-6" /></div>
                    <div>
                        <div className="text-sm text-zinc-400 font-medium uppercase tracking-wider">Storage</div>
                        <div className="text-white font-semibold">{vectorDb === 'pinecone' ? 'Pinecone' : vectorDb === 'chroma' ? 'ChromaDB' : 'In-Memory Store'}</div>
                    </div>
                </div>

                {/* Down Arrow */}
                <div className="flex flex-col items-center justify-center text-zinc-600">
                    <div className="w-px h-6 bg-zinc-700"></div>
                    <div className="w-2 h-2 rounded-full bg-zinc-600 border border-zinc-900 mt-[-2px]"></div>
                </div>

                {/* Pipeline Logic */}
                <div className="bg-zinc-900/80 border border-cyan-500/30 p-4 rounded-xl flex items-center gap-4 w-full shadow-[0_0_15px_rgba(6,182,212,0.15)] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent pointer-events-none" />
                    <div className="bg-cyan-500/20 p-3 rounded-lg"><Layers className="text-cyan-400 w-6 h-6" /></div>
                    <div className="flex-1">
                        <div className="text-sm text-zinc-400 font-medium uppercase tracking-wider">Orchestration</div>
                        <div className="text-white font-semibold">Haystack 2.0 Pipeline</div>
                        <div className="text-xs text-cyan-300/80 mt-1 capitalize">{ragType} Mode | {useCase} Persona</div>
                    </div>
                </div>

                {/* Optional Features Side branches */}
                {features && features.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                        {features.map((feat, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs text-emerald-400">
                                <CheckCircle className="w-3 h-3" />
                                {feat}
                            </div>
                        ))}
                    </div>
                )}

                {/* Down Arrow */}
                <div className="flex flex-col items-center justify-center text-zinc-600">
                    <div className="w-px h-6 bg-zinc-700"></div>
                    <div className="w-2 h-2 rounded-full bg-zinc-600 border border-zinc-900 mt-[-2px]"></div>
                </div>

                {/* Generator LLM */}
                <div className="bg-zinc-900/80 border border-purple-500/30 p-4 rounded-xl flex items-center gap-4 w-full shadow-lg">
                    <div className="bg-purple-500/20 p-3 rounded-lg"><Bot className="text-purple-400 w-6 h-6" /></div>
                    <div>
                        <div className="text-sm text-zinc-400 font-medium uppercase tracking-wider">Generation</div>
                        <div className="text-white font-semibold">OpenAI Generator</div>
                    </div>
                </div>

            </div>
        </div>
    );
}
