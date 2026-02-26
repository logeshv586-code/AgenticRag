import React, { useState, useRef, useEffect } from 'react';
import { Send, ThumbsUp, ThumbsDown, User, Bot, Loader2 } from 'lucide-react';

export default function RagChatTester({ themeColor, themeName }) {
    const [messages, setMessages] = useState([{ role: 'bot', content: 'Hello! Your custom RAG is deployed and ready. Try asking me a question!' }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('http://localhost:8000/api/test-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMessage })
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(prev => [...prev, { role: 'bot', content: data.answer }]);
            } else {
                setMessages(prev => [...prev, { role: 'bot', content: 'Sorry, I encountered an error connecting to the RAG backend.', error: true }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'bot', content: 'Network error. Make sure the backend is running.', error: true }]);
        } finally {
            setIsLoading(false);
        }
    };

    const submitFeedback = async (rating) => {
        try {
            await fetch('http://localhost:8000/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: 'test_session', rating, comment: '' })
            });
            // Simple UI feedback could be added here (e.g., toast notification)
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950/50 rounded-2xl border border-white/5 overflow-hidden">

            {/* Header */}
            <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor, boxShadow: `0 0 10px ${themeColor}` }} />
                    <span className="text-sm font-semibold text-white">Live Test Arena</span>
                </div>
                <span className="text-xs text-zinc-500">Theme: {themeName || 'Default'}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>

                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-zinc-800' : 'bg-zinc-900 border border-white/10'}`}>
                            {msg.role === 'user' ? <User className="w-4 h-4 text-zinc-400" /> : <Bot className="w-4 h-4" style={{ color: themeColor }} />}
                        </div>

                        {/* Bubble */}
                        <div className="flex flex-col gap-1">
                            <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-zinc-800 text-white rounded-tr-none' : 'bg-zinc-900/80 border border-zinc-800 text-zinc-300 rounded-tl-none'} ${msg.error ? 'border-red-500/50 text-red-200' : ''}`}>
                                {msg.content}
                            </div>

                            {/* Interactions (Feedback) - Only on latest bot message */}
                            {msg.role === 'bot' && !msg.error && i === messages.length - 1 && i > 0 && (
                                <div className="flex items-center gap-2 mt-1">
                                    <button onClick={() => submitFeedback(5)} className="p-1 hover:bg-white/10 rounded transition text-zinc-500 hover:text-green-400">
                                        <ThumbsUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => submitFeedback(1)} className="p-1 hover:bg-white/10 rounded transition text-zinc-500 hover:text-red-400">
                                        <ThumbsDown className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3 max-w-[85%]">
                        <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4" style={{ color: themeColor }} />
                        </div>
                        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 rounded-tl-none flex items-center">
                            <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 bg-zinc-900 border-t border-zinc-800 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask your new RAG something..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-700 transition"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="bg-white text-black p-2.5 rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>

        </div>
    );
}
