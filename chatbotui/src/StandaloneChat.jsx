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
        <div className="flex flex-col h-screen bg-[#0b0b0e] text-white overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md z-10">
                <Link to="/" className="p-2 -ml-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition">
                    <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                </Link>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center">
                    <Bot className="w-6 h-6 md:w-8 md:h-8 text-[#22d3ee]" />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg md:text-xl font-bold text-white truncate">Neural RAG Assistant</h1>
                    <p className="text-[10px] md:text-xs text-[#22d3ee] font-mono truncate">Pipeline: {pipelineId}</p>
                </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`max-w-[90%] md:max-w-[80%] p-3 md:p-4 rounded-2xl text-[14px] md:text-[15px] leading-relaxed shadow-lg ${msg.role === 'user'
                                ? 'bg-gradient-to-br from-[#22d3ee] to-blue-600 text-black rounded-tr-sm font-semibold'
                                : 'bg-zinc-900/50 border border-zinc-800 text-zinc-200 rounded-tl-sm backdrop-blur-sm'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start animate-in fade-in duration-300">
                            <div className="bg-zinc-900/50 border border-zinc-800 p-3 md:p-4 rounded-2xl rounded-tl-sm text-zinc-400 text-sm flex items-center gap-3">
                                <div className="w-4 h-4 border-2 border-t-[#22d3ee] border-r-[#22d3ee] border-b-transparent border-l-transparent rounded-full animate-spin" />
                                <span>Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800 shrink-0">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-2 md:gap-3 bg-zinc-900 p-1.5 md:p-2 pr-1.5 md:pr-2 pl-4 md:pl-6 rounded-full border border-zinc-800 focus-within:border-[#22d3ee]/50 focus-within:ring-1 focus-within:ring-[#22d3ee]/20 transition-all duration-300 shadow-2xl">
                        <input
                            type="text"
                            className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-500 text-sm md:text-[15px] py-2"
                            placeholder="Type your message..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isLoading}
                            className={`p-2.5 md:p-3 rounded-full transition-all duration-300 ${inputValue.trim() && !isLoading ? 'bg-[#22d3ee] text-black hover:scale-105 shadow-lg shadow-[#22d3ee]/20' : 'bg-zinc-800 text-zinc-600'}`}
                        >
                            <Send className="w-4 h-4 md:w-5 md:h-5" fill={inputValue.trim() && !isLoading ? "black" : "none"} />
                        </button>
                    </div>
                    <div className="text-center mt-3 text-[10px] text-zinc-600">
                        Secure neural session &bull; End-to-end encrypted
                    </div>
                </div>
            </div>
        </div>
    );
}
