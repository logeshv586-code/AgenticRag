import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Send, Bot, ArrowLeft } from 'lucide-react';

export default function StandaloneChat() {
    const { pipelineId } = useParams();
    const [messages, setMessages] = useState([{ id: 1, role: 'bot', content: 'Hello! Your custom RAG is deployed and ready. Try asking me a question!' }]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;
        const userMsg = { id: Date.now(), role: 'user', content: inputValue.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:8000/api/test-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMsg.content, pipeline_id: pipelineId }),
            });
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            setMessages(prev => [...prev, { id: Date.now(), role: 'bot', content: data.answer }]);
        } catch (err) {
            setMessages(prev => [...prev, { id: Date.now(), role: 'bot', content: 'Error connecting to RAG pipeline. Ensure backend is running.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#0b0b0e] text-white">
            <div className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800 bg-zinc-950">
                <Link to="/" className="p-2 -ml-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <Bot className="w-8 h-8 text-[#22d3ee]" />
                <div>
                    <h1 className="text-xl font-bold text-white">Standalone RAG Assistant</h1>
                    <p className="text-xs text-[#22d3ee] font-mono">Live Session &mdash; Pipeline: {pipelineId}</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                            <div className={`max-w-[85%] p-4 rounded-2xl text-[15px] leading-relaxed shadow-lg ${msg.role === 'user' ? 'bg-gradient-to-r from-[#22d3ee] to-blue-500 text-black rounded-tr-sm font-medium' : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl rounded-tl-sm text-zinc-400 text-sm animate-pulse flex items-center gap-3">
                                <div className="w-4 h-4 border-2 border-t-[#22d3ee] border-r-[#22d3ee] border-b-transparent border-l-transparent rounded-full animate-spin" />
                                Generating architecture response...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="p-6 bg-zinc-950 border-t border-zinc-800 shrink-0">
                <div className="max-w-4xl mx-auto flex items-center gap-3 bg-[#1c1c1e] p-2 pr-2 pl-6 rounded-full border border-zinc-800/50 focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-[#22d3ee]/20 transition duration-300 shadow-xl shadow-black/50">
                    <input
                        type="text"
                        className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-500 text-[15px]"
                        placeholder="Ask your deployed assistant anything..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isLoading}
                        className={`p-3.5 rounded-full transition-all duration-300 ${inputValue.trim() && !isLoading ? 'bg-[#22d3ee] text-black hover:scale-105 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-zinc-800 text-zinc-600'}`}
                    >
                        <Send className="w-5 h-5" fill={inputValue.trim() && !isLoading ? "currentColor" : "none"} />
                    </button>
                </div>
                <div className="text-center mt-4 text-[11px] text-zinc-500 max-w-4xl mx-auto">
                    Agentic RAG queries are processed by the Haystack Pipeline associated with this deployment instance.
                </div>
            </div>
        </div>
    );
}
