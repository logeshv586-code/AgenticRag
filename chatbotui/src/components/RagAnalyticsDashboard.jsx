import React, { useState, useEffect, useMemo } from 'react';
import Plotly from 'plotly.js/dist/plotly';
import _createPlotlyComponent from 'react-plotly.js/factory';
import { LayoutGrid, PieChart, Activity, Zap, Shield, Database, Cpu, Brain, Layers, Search, Workflow, Users, Mic, Book, Languages, ShoppingCart, Briefcase, Info, Wand2, MessageCircle } from 'lucide-react';

const createPlotlyComponent = _createPlotlyComponent.default || _createPlotlyComponent;
const Plot = createPlotlyComponent(Plotly);

const RAG_METRICS = {
    // RAG Architectures
    'Universal Neural RAG': { latency: 45, accuracy: 0.85, speed: 90, depth: 60, richness: 50, reasoning: 40, color: '#06b6d4', icon: Search },
    'Global Data Integration': { latency: 120, accuracy: 0.88, speed: 70, depth: 75, richness: 40, reasoning: 50, color: '#a78bfa', icon: Wand2 },
    'Enterprise Cognitive RAG': { latency: 250, accuracy: 0.92, speed: 40, depth: 90, richness: 60, reasoning: 80, color: '#22c55e', icon: MessageCircle },
    'Global Context RAG': { latency: 350, accuracy: 0.80, speed: 60, depth: 50, richness: 95, reasoning: 60, color: '#f97316', icon: Layers },
    'Structured Intelligence': { latency: 180, accuracy: 0.95, speed: 50, depth: 85, richness: 30, reasoning: 70, color: '#fb7185', icon: Database },
    'Synaptic Graph RAG': { latency: 400, accuracy: 0.94, speed: 30, depth: 98, richness: 40, reasoning: 95, color: '#38bdf8', icon: Workflow },
    'Autonomous Network': { latency: 500, accuracy: 0.96, speed: 20, depth: 95, richness: 50, reasoning: 98, color: '#fde047', icon: Brain },
    'Live Neural Stream': { latency: 30, accuracy: 0.82, speed: 98, depth: 40, richness: 30, reasoning: 30, color: '#60a5fa', icon: Cpu },
    'Adaptive Persona': { latency: 130, accuracy: 0.88, speed: 70, depth: 60, richness: 75, reasoning: 50, color: '#34d399', icon: Users },
    'Universal Matrix': { latency: 200, accuracy: 0.90, speed: 60, depth: 70, richness: 85, reasoning: 50, color: '#f43f5e', icon: Languages },
    'Vocal Synthesis': { latency: 80, accuracy: 0.85, speed: 80, depth: 40, richness: 95, reasoning: 40, color: '#00b4d8', icon: Mic },
    'Verified Intelligence': { latency: 280, accuracy: 0.98, speed: 40, depth: 95, richness: 60, reasoning: 70, color: '#eab308', icon: Book },
    'Policy Guard Architecture': { latency: 150, accuracy: 0.90, speed: 50, depth: 80, richness: 70, reasoning: 60, color: '#64748b', icon: Shield },
    // Assistant Types
    'FAQ Bot': { latency: 40, accuracy: 0.80, speed: 95, depth: 30, richness: 20, reasoning: 20, color: '#22c55e', icon: MessageCircle },
    'Customer Support': { latency: 110, accuracy: 0.85, speed: 70, depth: 60, richness: 50, reasoning: 60, color: '#34d399', icon: Users },
    'Sales Assistant': { latency: 130, accuracy: 0.82, speed: 65, depth: 50, richness: 70, reasoning: 65, color: '#fb7185', icon: ShoppingCart },
    'HR Assistant': { latency: 90, accuracy: 0.88, speed: 75, depth: 65, richness: 40, reasoning: 50, color: '#22c55e', icon: Briefcase },
    'Internal Search': { latency: 50, accuracy: 0.85, speed: 90, depth: 70, richness: 30, reasoning: 40, color: '#22d3ee', icon: Search },
    'Document Q&A': { latency: 160, accuracy: 0.95, speed: 50, depth: 90, richness: 60, reasoning: 50, color: '#eab308', icon: Book },
    'Data Analyst': { latency: 300, accuracy: 0.94, speed: 40, depth: 85, richness: 40, reasoning: 90, color: '#60a5fa', icon: Cpu },
    'Compliance Advisor': { latency: 350, accuracy: 0.98, speed: 35, depth: 95, richness: 30, reasoning: 85, color: '#64748b', icon: Shield },
};

export default function RagAnalyticsDashboard() {
    const [mounted, setMounted] = useState(false);
    const [selectedArch, setSelectedArch] = useState('Universal Neural RAG');
    const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' or 'profile'

    useEffect(() => {
        setMounted(true);
    }, []);

    const architectures = useMemo(() => Object.keys(RAG_METRICS), []);

    const scatterData = useMemo(() => {
        return [{
            type: 'scatter',
            mode: 'markers',
            x: architectures.map(a => RAG_METRICS[a].latency),
            y: architectures.map(a => RAG_METRICS[a].accuracy),
            text: architectures.map(a => `${a}<br>Speed: ${RAG_METRICS[a].speed}%`),
            hoverinfo: 'text',
            marker: {
                size: architectures.map(a => RAG_METRICS[a].speed / 4 + 10),
                color: architectures.map(a => RAG_METRICS[a].color),
                opacity: 0.7,
                line: { color: '#ffffff20', width: 1 },
                symbol: architectures.map(a => a === selectedArch ? 'diamond' : 'circle'),
            },
            name: 'Architecture Performance'
        }];
    }, [architectures, selectedArch]);

    const radarData = useMemo(() => {
        const metrics = RAG_METRICS[selectedArch];
        return [{
            type: 'scatterpolar',
            r: [metrics.speed, metrics.accuracy * 100, metrics.depth, metrics.richness, metrics.reasoning, metrics.speed],
            theta: ['Speed', 'Accuracy', 'Knowledge Depth', 'Richness', 'Reasoning', 'Speed'],
            fill: 'toself',
            fillcolor: metrics.color + '40',
            line: { color: metrics.color, width: 3 },
            marker: { color: metrics.color, size: 8 },
            name: selectedArch
        }];
    }, [selectedArch]);

    const barData = useMemo(() => {
        const sorted = [...architectures].sort((a, b) => RAG_METRICS[b].accuracy - RAG_METRICS[a].accuracy).slice(0, 8);
        return [{
            type: 'bar',
            x: sorted,
            y: sorted.map(a => RAG_METRICS[a].accuracy * 100),
            marker: {
                color: sorted.map(a => RAG_METRICS[a].color),
                opacity: 0.8,
                line: { color: '#ffffff10', width: 1 }
            },
            text: sorted.map(a => `${(RAG_METRICS[a].accuracy * 100).toFixed(1)}%`),
            textposition: 'outside',
            cliponaxis: false
        }];
    }, [architectures]);

    const commonLayout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Syne, sans-serif', color: '#a1a1aa' },
        margin: { l: 40, r: 20, t: 30, b: 40 },
        showlegend: false,
        autosize: true,
    };

    const matrixLayout = {
        ...commonLayout,
        xaxis: { title: 'Latency (ms)', gridcolor: '#ffffff08', zeroline: false },
        yaxis: { title: 'Accuracy (%)', gridcolor: '#ffffff08', zeroline: false, tickformat: ',.0%' },
        hovermode: 'closest',
    };

    const radarLayout = {
        ...commonLayout,
        polar: {
            bgcolor: 'rgba(0,0,0,0)',
            radialaxis: { visible: true, range: [0, 100], gridcolor: '#ffffff10', linecolor: '#ffffff10', tickfont: { size: 8 } },
            angularaxis: { gridcolor: '#ffffff10', linecolor: '#ffffff10' }
        },
        margin: { l: 60, r: 60, t: 30, b: 30 },
    };

    const barLayout = {
        ...commonLayout,
        xaxis: { tickangle: -45, tickfont: { size: 10 } },
        yaxis: { visible: false, range: [0, 115] },
    };

    if (!mounted) {
        return (
            <div className="w-full bg-[#0b0b0e] border border-white/5 rounded-[40px] p-8 glass-card shadow-2xl relative overflow-hidden min-h-[600px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                    <span className="text-zinc-500 font-bold text-xs uppercase tracking-widest animate-pulse">Initializing Neural Analytics...</span>
                </div>
            </div>
        );
    }

    return (
        <div id="omni-analytics-suite" className="w-full bg-[#0b0b0e] border border-white/5 rounded-[40px] p-8 glass-card shadow-2xl relative overflow-hidden group min-h-[600px]">
            {/* Background Ambience */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #333 1px, transparent 0)', backgroundSize: '32px 32px' }} />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row gap-8 h-full">
                {/* Sidebar Controls */}
                <div className="w-full md:w-72 flex flex-col gap-6">
                    <div>
                        <h3 className="text-2xl font-black text-white tracking-tighter mb-2 flex items-center gap-2">
                            <Activity className="w-6 h-6 text-cyan-400" />
                            OmniAnalytics
                        </h3>
                        <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Enterprise RAG Intelligence</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] px-2">Visualization Type</span>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setActiveTab('matrix')}
                                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'matrix' ? 'bg-white text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>
                                <LayoutGrid className="w-3 h-3" /> Matrix
                            </button>
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'profile' ? 'bg-white text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>
                                <PieChart className="w-3 h-3" /> Profile
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] px-2">Select Architecture</span>
                        <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-2 scrollbar-none">
                            {architectures.map(arch => (
                                <button
                                    key={arch}
                                    onClick={() => setSelectedArch(arch)}
                                    className={`w-full text-left py-2.5 px-3 rounded-xl transition-all border shrink-0 ${arch === selectedArch ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RAG_METRICS[arch].color }} />
                                        <span className={`text-[11px] font-bold ${arch === selectedArch ? 'text-white' : 'text-zinc-500'}`}>{arch}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                            <Info className="w-3 h-3 text-cyan-400" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Quick Insight</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                            Comparing 21 neural architectures across 5 performance vectors. High accuracy correlates with reasoning depth.
                        </p>
                    </div>
                </div>

                {/* Main Dashboard Panel */}
                <div className="flex-1 flex flex-col gap-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                        {/* View One: Performance Matrix or Top Accuracy */}
                        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 flex flex-col min-h-[400px]">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs font-black text-white tracking-widest uppercase">{activeTab === 'matrix' ? 'Latency vs Accuracy Matrix' : 'Accuracy Leaderboard'}</span>
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse animation-delay-500" />
                                </div>
                            </div>
                            <div className="flex-1">
                                <Plot
                                    data={activeTab === 'matrix' ? scatterData : barData}
                                    layout={activeTab === 'matrix' ? matrixLayout : barLayout}
                                    config={{ displayModeBar: false, responsive: true }}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler={true}
                                />
                            </div>
                        </div>

                        {/* View Two: Profile Radar */}
                        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 flex flex-col min-h-[400px]">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs font-black text-white tracking-widest uppercase">Neural Profile: {selectedArch}</span>
                                <div className="p-1.5 bg-white/5 rounded-lg">
                                    {React.createElement(RAG_METRICS[selectedArch].icon, { className: 'w-4 h-4', style: { color: RAG_METRICS[selectedArch].color } })}
                                </div>
                            </div>
                            <div className="flex-1">
                                <Plot
                                    data={radarData}
                                    layout={radarLayout}
                                    config={{ displayModeBar: false, responsive: true }}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler={true}
                                />
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-2">
                                <div className="p-2 bg-white/5 rounded-xl text-center">
                                    <div className="text-[9px] text-zinc-500 font-bold uppercase mb-1">Latency</div>
                                    <div className="text-xs font-black text-white">{RAG_METRICS[selectedArch].latency}ms</div>
                                </div>
                                <div className="p-2 bg-white/5 rounded-xl text-center">
                                    <div className="text-[9px] text-zinc-500 font-bold uppercase mb-1">Accuracy</div>
                                    <div className="text-xs font-black text-white">{(RAG_METRICS[selectedArch].accuracy * 100).toFixed(0)}%</div>
                                </div>
                                <div className="p-2 bg-white/5 rounded-xl text-center">
                                    <div className="text-[9px] text-zinc-500 font-bold uppercase mb-1">Reasoning</div>
                                    <div className="text-xs font-black text-white">{RAG_METRICS[selectedArch].reasoning / 10}/10</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .animation-delay-200 { animation-delay: 200ms; }
        .animation-delay-300 { animation-delay: 300ms; }
        .animation-delay-500 { animation-delay: 500ms; }
      `}} />
        </div>
    );
}
