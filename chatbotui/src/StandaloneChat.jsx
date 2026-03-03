import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Send, Bot, ArrowLeft, Mic, MicOff, Copy, Check, Volume2, Loader2 } from 'lucide-react';

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
    const messagesEndRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => { scrollToBottom(); }, [messages]);

    // Fetch pipeline metadata on mount
    useEffect(() => {
        if (!pipelineId) return;
        fetch(`http://localhost:8000/api/visualize/${pipelineId}`)
            .then(r => r.json())
            .then(data => {
                if (data.metadata) setPipelineMeta(data.metadata);
            })
            .catch(() => { /* silently fail */ });
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

            const response = await fetch('http://localhost:8000/api/test-chat', {
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
                textQuery: data.text_query,       // Voice transcription
                audioResponse: data.audio_response // TTS base64
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
        // Bold
        let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code class="bg-zinc-800 px-1.5 py-0.5 rounded text-cyan-300 text-xs">$1</code>');
        // Citations [1], [2]
        html = html.replace(/\[(\d+)\]/g, '<sup class="text-cyan-400 font-bold cursor-pointer hover:text-cyan-300">[$1]</sup>');
        // Newlines
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
                    <h1 className="text-base md:text-lg font-bold text-white truncate">{ragTypeLabel} Assistant</h1>
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
                <div className="hidden md:flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-mono">LIVE</span>
                </div>
            </div>

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
                                <span>Thinking...</span>
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
                        Secure neural session &bull; End-to-end encrypted
                    </div>
                </div>
            </div>
        </div>
    );
}
