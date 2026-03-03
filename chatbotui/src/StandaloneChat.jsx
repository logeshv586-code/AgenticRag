import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Send, Bot, ArrowLeft, Mic, MicOff, Copy, Check, Volume2, Loader2, Settings, X, ChevronDown, ChevronUp, Key } from 'lucide-react';
import { API_BASE_URL } from './config';

// ── LLM Provider Options ─────────────────────────────────
const LLM_PROVIDERS = [
    { id: 'platform', label: 'Platform Ollama', icon: '🤖', desc: 'Use the server\'s local Ollama LLM (default)' },
    { id: 'my-ollama', label: 'My Ollama', icon: '💻', desc: 'Your own Ollama server (local or remote)' },
    { id: 'openai', label: 'OpenAI GPT-4o', icon: '⚡', desc: 'Use your OpenAI API key' },
    { id: 'anthropic', label: 'Claude 3.5', icon: '🧠', desc: 'Use your Anthropic API key' },
    { id: 'gemini', label: 'Gemini Pro', icon: '✨', desc: 'Use your Google API key' },
];

const OLLAMA_MODELS = [
    { id: 'llama3.1:8b', label: 'LLaMA 3.1 8B (~5GB)' },
    { id: 'mixtral:8x7b', label: 'Mixtral 8x7B (~26GB)' },
    { id: 'qwen2.5:7b', label: 'Qwen 2.5 7B (~5GB)' },
    { id: 'llava:13b', label: 'LLaVA 13B (~8GB, vision)' },
    { id: 'gemma3:27b', label: 'Gemma 3 27B (~17GB)' },
];

// ── LLM Settings Panel ────────────────────────────────────
function LLMSettingsPanel({ llmConfig, setLlmConfig, onClose }) {
    const [provider, setProvider] = useState(llmConfig.provider || 'platform');
    const [apiKey, setApiKey] = useState(llmConfig.api_key || '');
    const [ollamaUrl, setOllamaUrl] = useState(llmConfig.base_url || 'http://localhost:11434/v1');
    const [ollamaModel, setOllamaModel] = useState(llmConfig.model || 'llama3.1:8b');
    const [showKey, setShowKey] = useState(false);

    const handleApply = () => {
        let cfg = { provider };
        if (provider === 'platform') {
            cfg = { provider: 'platform' };
        } else if (provider === 'my-ollama') {
            cfg = { provider: 'my-ollama', model: ollamaModel, base_url: ollamaUrl, api_key: 'ollama' };
        } else if (provider === 'openai') {
            cfg = { provider: 'openai', model: 'gpt-4o', api_key: apiKey };
        } else if (provider === 'anthropic') {
            cfg = { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', api_key: apiKey };
        } else if (provider === 'gemini') {
            cfg = { provider: 'gemini', model: 'gemini-pro', api_key: apiKey };
        }
        setLlmConfig(cfg);
        onClose();
    };

    return (
        <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-semibold text-white">LLM Settings</span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {/* Provider Selection */}
                <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">LLM Provider</label>
                    <div className="space-y-1.5">
                        {LLM_PROVIDERS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setProvider(p.id)}
                                className={`w-full flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all ${provider === p.id
                                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                                        : 'bg-zinc-800/50 border-zinc-700/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
                                    }`}
                            >
                                <span className="text-base leading-none mt-0.5">{p.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium">{p.label}</div>
                                    <div className="text-[10px] text-zinc-500 mt-0.5">{p.desc}</div>
                                </div>
                                {provider === p.id && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* My Ollama config */}
                {provider === 'my-ollama' && (
                    <div className="space-y-2 pt-1">
                        <div>
                            <label className="text-[10px] text-zinc-500 font-medium">Ollama Server URL</label>
                            <input
                                type="text"
                                value={ollamaUrl}
                                onChange={e => setOllamaUrl(e.target.value)}
                                className="w-full mt-1 bg-zinc-800/80 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50"
                                placeholder="http://localhost:11434/v1"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-zinc-500 font-medium">Model</label>
                            <select
                                value={ollamaModel}
                                onChange={e => setOllamaModel(e.target.value)}
                                className="w-full mt-1 bg-zinc-800/80 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50"
                            >
                                {OLLAMA_MODELS.map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <p className="text-[9px] text-zinc-600">
                            Run Ollama locally: <code className="text-zinc-400">ollama serve</code><br />
                            Pull a model: <code className="text-zinc-400">ollama pull llama3.1:8b</code>
                        </p>
                    </div>
                )}

                {/* API Key config */}
                {['openai', 'anthropic', 'gemini'].includes(provider) && (
                    <div className="pt-1">
                        <label className="text-[10px] text-zinc-500 font-medium flex items-center gap-1">
                            <Key className="w-3 h-3" /> API Key
                        </label>
                        <div className="relative mt-1">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-cyan-500/50 pr-10"
                                placeholder={
                                    provider === 'openai' ? 'sk-...'
                                        : provider === 'anthropic' ? 'sk-ant-...'
                                            : 'AI...'
                                }
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                            >
                                {showKey ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                        </div>
                        <p className="text-[9px] text-zinc-600 mt-1">
                            Your key stays in your browser and is sent directly to the backend. Not stored.
                        </p>
                    </div>
                )}

                {/* Apply Button */}
                <button
                    onClick={handleApply}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black text-xs font-bold hover:opacity-90 transition"
                >
                    Apply LLM Settings
                </button>
            </div>
        </div>
    );
}


// ── Main StandaloneChat ───────────────────────────────────
export default function StandaloneChat() {
    const { pipelineId } = useParams();
    const [messages, setMessages] = useState([
        { id: 1, role: 'bot', content: 'Hello! Your custom RAG is deployed and ready. Try asking me a question about the scraped data!' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [pipelineMeta, setPipelineMeta] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [llmConfig, setLlmConfig] = useState({ provider: 'platform' });
    const messagesEndRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const settingsRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    useEffect(() => { scrollToBottom(); }, [messages]);

    // Close settings panel on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (settingsRef.current && !settingsRef.current.contains(e.target)) {
                setShowSettings(false);
            }
        };
        if (showSettings) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSettings]);

    // Fetch pipeline metadata
    useEffect(() => {
        if (!pipelineId) return;
        fetch(`${API_BASE_URL}/api/visualize/${pipelineId}`)
            .then(r => r.json())
            .then(data => { if (data.metadata) setPipelineMeta(data.metadata); })
            .catch(() => { });
    }, [pipelineId]);

    const handleCopy = (id, text) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // ── Voice Recording ──────────────────────────────────
    const toggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    sendMessage('🎤 Voice Input', base64);
                };
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);
        } catch {
            console.error('Microphone access denied');
        }
    };

    // ── Build llm_override from config ───────────────────
    const buildLlmOverride = () => {
        if (llmConfig.provider === 'platform') return null;
        return {
            model: llmConfig.model || '',
            api_key: llmConfig.api_key || '',
            base_url: llmConfig.base_url || '',
        };
    };

    // ── LLM Provider Badge ────────────────────────────────
    const getLlmBadge = () => {
        const p = LLM_PROVIDERS.find(x => x.id === llmConfig.provider);
        if (!p || llmConfig.provider === 'platform') return null;
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[9px] text-amber-400 font-mono">
                {p.icon} {p.label}
            </span>
        );
    };

    // ── Send Message ─────────────────────────────────────
    const sendMessage = async (text, audioBase64 = null) => {
        const query = text || inputValue.trim();
        if (!query && !audioBase64) return;

        const userMsg = { id: Date.now(), role: 'user', content: query };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const payload = { query, pipeline_id: pipelineId };
            if (audioBase64) payload.audio_base64 = audioBase64;

            // Add LLM override if user selected custom provider
            const override = buildLlmOverride();
            if (override) payload.llm_override = override;

            const response = await fetch(`${API_BASE_URL}/api/test-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();

            const botMsg = {
                id: Date.now() + 1,
                role: 'bot',
                content: data.answer,
                textQuery: data.text_query,
                audioResponse: data.audio_response,
                modelUsed: data.model_used || llmConfig.model,
            };
            setMessages(prev => [...prev, botMsg]);
        } catch {
            setMessages(prev => [...prev, { id: Date.now(), role: 'bot', content: 'Error connecting to RAG pipeline. Ensure backend is running.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = () => sendMessage(inputValue.trim());

    // ── Render Markdown-lite ─────────────────────────────
    const renderContent = (text) => {
        if (!text) return null;
        let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/`([^`]+)`/g, '<code class="bg-zinc-800 px-1.5 py-0.5 rounded text-cyan-300 text-xs">$1</code>');
        html = html.replace(/\[(\d+)\]/g, '<sup class="text-cyan-400 font-bold cursor-pointer hover:text-cyan-300">[$1]</sup>');
        html = html.replace(/\n/g, '<br/>');
        return <div dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const playAudio = (base64Audio) => {
        if (!base64Audio) return;
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        audio.play();
    };

    const ragTypeLabel = pipelineMeta?.rag_type?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || 'Neural RAG';

    return (
        <div className="flex flex-col h-screen bg-[#0a0a0d] text-white overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-xl z-10">
                <Link to="/" className="p-2 -ml-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h1 className="text-base md:text-lg font-bold text-white truncate">{ragTypeLabel} Assistant</h1>
                        {getLlmBadge()}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                        <span className="truncate max-w-[140px]">ID: {pipelineId}</span>
                        {pipelineMeta && (
                            <>
                                <span className="text-zinc-700">•</span>
                                <span className="text-cyan-500/80">{pipelineMeta.llm_display || pipelineMeta.llm_model}</span>
                                <span className="text-zinc-700">•</span>
                                <span className="text-emerald-500/80">{pipelineMeta.db_type}</span>
                                {pipelineMeta.documents_count > 0 && (
                                    <>
                                        <span className="text-zinc-700">•</span>
                                        <span className="text-amber-500/80">{pipelineMeta.documents_count} docs</span>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Status + Settings Gear */}
                <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] text-emerald-400 font-mono">LIVE</span>
                    </div>

                    {/* LLM Settings Gear */}
                    <div className="relative" ref={settingsRef}>
                        <button
                            id="llm-settings-btn"
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-full transition-all duration-200 ${showSettings
                                ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30'
                                : 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                                }`}
                            title="LLM Settings — Choose your AI model"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                        {showSettings && (
                            <LLMSettingsPanel
                                llmConfig={llmConfig}
                                setLlmConfig={setLlmConfig}
                                onClose={() => setShowSettings(false)}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* LLM override notice banner */}
            {llmConfig.provider !== 'platform' && (
                <div className="px-4 py-1.5 bg-amber-500/8 border-b border-amber-500/20 flex items-center gap-2">
                    <span className="text-[10px] text-amber-400 font-mono">
                        ⚡ Using custom LLM: {LLM_PROVIDERS.find(p => p.id === llmConfig.provider)?.label}
                        {llmConfig.model ? ` — ${llmConfig.model}` : ''}
                    </span>
                    <button
                        onClick={() => setLlmConfig({ provider: 'platform' })}
                        className="ml-auto text-[9px] text-amber-500/60 hover:text-amber-400 transition"
                    >
                        Reset to default
                    </button>
                </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scroll-smooth">
                <div className="max-w-3xl mx-auto space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                            <div className={`max-w-[88%] md:max-w-[78%] relative ${msg.role === 'user'
                                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-black rounded-2xl rounded-tr-md px-4 py-3 font-medium text-sm shadow-lg shadow-cyan-500/10'
                                : 'bg-zinc-900/70 border border-zinc-800/60 text-zinc-200 rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed backdrop-blur-sm'
                                }`}>
                                {msg.role === 'bot' ? renderContent(msg.content) : msg.content}

                                {/* Voice transcription indicator */}
                                {msg.textQuery && (
                                    <div className="mt-2 pt-2 border-t border-zinc-700/50 text-[11px] text-zinc-500 italic">
                                        Transcribed: "{msg.textQuery}"
                                    </div>
                                )}

                                {/* Model used tag */}
                                {msg.role === 'bot' && msg.modelUsed && msg.id !== 1 && (
                                    <div className="mt-1.5 text-[9px] text-zinc-600 font-mono">
                                        via {msg.modelUsed}
                                    </div>
                                )}

                                {/* Bot message actions */}
                                {msg.role === 'bot' && msg.id !== 1 && (
                                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-800/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleCopy(msg.id, msg.content)}
                                            className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition"
                                            title="Copy"
                                        >
                                            {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                        {msg.audioResponse && (
                                            <button
                                                onClick={() => playAudio(msg.audioResponse)}
                                                className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition"
                                                title="Play Audio"
                                            >
                                                <Volume2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-zinc-900/70 border border-zinc-800/60 px-4 py-3 rounded-2xl rounded-tl-md text-zinc-400 text-sm flex items-center gap-3 backdrop-blur-sm">
                                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                                <span>Thinking{llmConfig.provider !== 'platform' ? ` via ${LLM_PROVIDERS.find(p => p.id === llmConfig.provider)?.label}` : ''}...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800/60 shrink-0">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-2 bg-zinc-900/80 p-1.5 pr-1.5 pl-4 rounded-2xl border border-zinc-800/60 focus-within:border-cyan-500/40 focus-within:ring-1 focus-within:ring-cyan-500/10 transition-all duration-300 shadow-2xl">
                        {/* Voice button */}
                        <button
                            onClick={toggleRecording}
                            className={`p-2 rounded-full transition-all duration-300 shrink-0 ${isRecording
                                ? 'bg-red-500/20 text-red-400 animate-pulse'
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                                }`}
                            title={isRecording ? 'Stop recording' : 'Voice input'}
                        >
                            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>

                        <input
                            type="text"
                            className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-500 text-sm py-2"
                            placeholder={isRecording ? 'Recording... Click mic to stop' : 'Type your message...'}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            disabled={isRecording}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isLoading}
                            className={`p-2.5 rounded-full transition-all duration-300 shrink-0 ${inputValue.trim() && !isLoading
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black hover:scale-105 shadow-lg shadow-cyan-500/20'
                                : 'bg-zinc-800 text-zinc-600'
                                }`}
                        >
                            <Send className="w-4 h-4" fill={inputValue.trim() && !isLoading ? "black" : "none"} />
                        </button>
                    </div>
                    <div className="text-center mt-2 text-[10px] text-zinc-600">
                        Secure neural session &bull; Ask anything about your data &bull; {llmConfig.provider === 'platform' ? 'Powered by Ollama' : `Using ${LLM_PROVIDERS.find(p => p.id === llmConfig.provider)?.label || 'Custom LLM'}`}
                    </div>
                </div>
            </div>
        </div>
    );
}
