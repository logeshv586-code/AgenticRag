import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MoreHorizontal, ThumbsUp, ThumbsDown, Copy, Send, LayoutGrid, Bot, MessageCircle, X, Minus, ShoppingCart, Briefcase, GraduationCap, Building2, Leaf, Plane, Cpu, Users, Search, Layers, Database, Globe, Wand2, Mic, Volume2, Book, Shield, Brain, Workflow, Languages, Info } from 'lucide-react';
import Robot3D from './components/Robot3D';
import MiniRobot from './components/MiniRobot';
import WaitingRobot from './components/WaitingRobot';
import GlassIcons from './components/GlassIcons';
import FloatingLines from './components/FloatingLines';

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: 'bot',
    content: 'Hello! I am the Prime Source Global assistant. How can I help you today?',
  }
];

 

function App() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
 
  const ragTypes = [
    { key: 'basic_rag', title: 'Basic RAG', icon: Search, short: 'Embed, retrieve Top‑K, answer with citations.', works: ['Split text to chunks', 'Embed into vectors', 'Search Top‑K', 'Generate with context'], canDo: ['FAQs', 'General Q&A'], query: 'Explain basic RAG workflow' },
    { key: 'hybrid_rag', title: 'Hybrid RAG', icon: Wand2, short: 'Combine keyword and vector search for recall and precision.', works: ['BM25 + vector search', 'Weighted scoring', 'Deduplicate and rank'], canDo: ['Docs with exact terms', 'Codebases'], query: 'How does hybrid RAG improve retrieval?' },
    { key: 'conversational_rag', title: 'Conversational RAG', icon: MessageCircle, short: 'Keep dialogue state and memory across turns.', works: ['Track session state', 'Retrieve per turn', 'Memory summarization'], canDo: ['Assistants', 'Support chat'], query: 'What is conversational RAG?' },
    { key: 'multimodal_rag', title: 'Multimodal RAG', icon: Layers, short: 'Retrieve text, images, audio, or video together.', works: ['Embed multiple modalities', 'Cross-modal retrieval'], canDo: ['Product search', 'Media Q&A'], query: 'When use multimodal RAG?' },
    { key: 'structured_rag', title: 'Structured RAG', icon: Database, short: 'Query tables, SQL, and structured stores.', works: ['Schema-aware retrieval', 'SQL + text context'], canDo: ['Reports', 'Dashboards'], query: 'How does structured RAG work?' },
    { key: 'kg_rag', title: 'Knowledge Graph RAG', icon: Workflow, short: 'Use relationships in graphs for precise answers.', works: ['Graph traversal', 'Path‑aware context'], canDo: ['Compliance', 'Entity relations'], query: 'Why graph‑based RAG?' },
    { key: 'agentic_rag', title: 'Agentic RAG', icon: Brain, short: 'Plan actions and call tools with retrieval.', works: ['Planner + tools', 'Iterative retrieval'], canDo: ['Research', 'Automation'], query: 'What is agentic RAG?' },
    { key: 'realtime_rag', title: 'Real‑time RAG', icon: Cpu, short: 'Ingest new data and answer on fresh content.', works: ['Streaming ingestion', 'Ephemeral cache'], canDo: ['News', 'Ops alerts'], query: 'How to keep RAG real‑time?' },
    { key: 'personalized_rag', title: 'Personalized RAG', icon: Users, short: 'Use user profile and preferences in retrieval.', works: ['User context features', 'Scoped indexing'], canDo: ['Portals', 'Learning'], query: 'How to personalize RAG?' },
    { key: 'xl_rag', title: 'Cross‑lingual RAG', icon: Languages, short: 'Retrieve and answer across languages.', works: ['Multilingual embeddings', 'Optional translation'], canDo: ['Global sites', 'Support'], query: 'How to make RAG multilingual?' },
    { key: 'voice_rag', title: 'Voice RAG', icon: Mic, short: 'Voice in/out with retrieval and citations.', works: ['STT to query', 'TTS to speak'], canDo: ['Hotline', 'Kiosk'], query: 'Show voice RAG example' },
    { key: 'citation_rag', title: 'Citation RAG', icon: Book, short: 'Always show sources and evidence.', works: ['Chunk‑level ids', 'Inline references'], canDo: ['Knowledge pages', 'Audits'], query: 'How to ensure citations?' },
    { key: 'guardrails_rag', title: 'Guardrailed RAG', icon: Shield, short: 'Restrict topics and enforce policies.', works: ['Topic allow/deny', 'Safety checks'], canDo: ['Enterprise', 'Healthcare'], query: 'How to add guardrails?' }
  ];
  const assistantTypes = [
    { key: 'faq', title: 'FAQ Bot', icon: MessageCircle, short: 'Answers common questions with citations.', canDo: ['Website', 'Portals'], query: 'List top FAQs for PSG' },
    { key: 'support', title: 'Customer Support', icon: Users, short: 'Troubleshooting with guided flows.', canDo: ['Support', 'Warranty'], query: 'Help with a service issue' },
    { key: 'sales', title: 'Sales Assistant', icon: ShoppingCart, short: 'Qualify leads and suggest offerings.', canDo: ['Lead capture', 'Quotes'], query: 'Recommend a service package' },
    { key: 'hr', title: 'HR Assistant', icon: Briefcase, short: 'Policies and careers guidance.', canDo: ['Benefits', 'Hiring'], query: 'Show careers and apply steps' },
    { key: 'internal_search', title: 'Internal Search', icon: Search, short: 'Find internal docs quickly.', canDo: ['Confluence', 'Shared drive'], query: 'Locate SOP for procurement' },
    { key: 'doc_qa', title: 'Document Q&A', icon: Book, short: 'Ask questions across PDFs and docs.', canDo: ['Contracts', 'Manuals'], query: 'Summarize latest brochure' },
    { key: 'data_analyst', title: 'Data Analyst', icon: Cpu, short: 'Explain metrics and trends.', canDo: ['Reports', 'KPIs'], query: 'Analyze quarterly numbers' },
    { key: 'compliance', title: 'Compliance Advisor', icon: Shield, short: 'Policy, audit, and risk checks.', canDo: ['ISO', 'Regulatory'], query: 'What are key compliance steps?' }
  ];
  const [selected, setSelected] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

 
  useEffect(() => {
    const w = typeof window !== 'undefined' ? window : null;
    const SR = w && (w.SpeechRecognition || w.webkitSpeechRecognition);
    if (SR) {
      const r = new SR();
      r.continuous = false;
      r.lang = 'en-US';
      r.onresult = (e) => {
        const t = Array.from(e.results).map((x) => x[0].transcript).join(' ');
        setInputValue((prev) => (prev ? prev + ' ' + t : t));
      };
      r.onend = () => setIsListening(false);
      recognitionRef.current = r;
    }
  }, []);

  const sendAudio = async (blob) => {
    const fd = new FormData();
    fd.append('file', blob, 'speech.webm');
    try {
      const resp = await fetch('http://localhost:8000/transcribe', { method: 'POST', body: fd });
      if (!resp.ok) throw new Error('fail');
      const data = await resp.json();
      const t = (data && data.text) || '';
      if (t) setInputValue((prev) => (prev ? prev + ' ' + t : t));
    } catch (e) {
      const r = recognitionRef.current;
      if (r) {
        r.start();
        setIsListening(true);
      }
    }
  };

  const startListen = async () => {
    const w = typeof window !== 'undefined' ? window : null;
    if (!w || !w.navigator || !w.MediaRecorder) {
      const r = recognitionRef.current;
      if (r) {
        r.start();
        setIsListening(true);
      } else {
        setIsListening(true);
      }
      return;
    }
    try {
      const stream = await w.navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new w.MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        await sendAudio(blob);
        setIsListening(false);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsListening(true);
    } catch (e) {
      setIsListening(false);
    }
  };

  const stopListen = () => {
    const w = typeof window !== 'undefined' ? window : null;
    const mr = mediaRecorderRef.current;
    if (w && mr && mr.state !== 'inactive') {
      mr.stop();
      mediaRecorderRef.current = null;
      return;
    }
    const r = recognitionRef.current;
    if (r) {
      r.stop();
      setIsListening(false);
    } else {
      setIsListening(false);
    }
  };

  const handleSend = async (textOverride) => {
    const text = (textOverride ?? inputValue).trim();
    if (!text) return;
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      const botMsg = {
        id: Date.now() + 1,
        role: 'bot',
        content: data.answer,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = {
        id: Date.now() + 1,
        role: 'bot',
        content: "Sorry, I encountered an error while connecting to the server.",
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };
  const openModal = (type, item) => {
    setSelected({ type, item });
  };
  const closeModal = () => {
    setSelected(null);
  };
  const toggleListening = () => {
    if (isListening) {
      stopListen();
    } else {
      startListen();
    }
  };
  const applySampleQuery = (q) => {
    setInputValue(q);
    setIsOpen(true);
    handleSend(q);
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 font-sans text-zinc-100 selection:bg-cyan-500/30">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <FloatingLines
          linesGradient={['#22d3ee', '#00B2FF', '#3b82f6']}
          enabledWaves={['top', 'middle', 'bottom']}
          lineCount={[6, 6, 6]}
          lineDistance={[5, 5, 5]}
          animationSpeed={1}
          interactive={true}
          bendRadius={120}
          bendStrength={-30}
          mouseDamping={0.08}
          parallax={true}
          parallaxStrength={0.2}
          mixBlendMode="screen"
        />
      </div>
      <div className="relative z-10 overflow-x-hidden">
        <div className="px-8 pt-20 pb-10 max-w-7xl mx-auto">
          <div className="flex items-center justify-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl shadow-cyan-500/10 animate-float-more">
              <Bot className="w-10 h-10 text-[#22d3ee]" />
            </div>
          </div>
          <h1 className="text-center text-5xl md:text-6xl font-bold mb-6 text-white tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22d3ee] via-cyan-400 to-blue-500">Deploy AI Experiences</span> With Enterprise Design
          </h1>
          <p className="text-center text-lg md:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
            Build branded AI assistants and RAG-powered pages in minutes. No code. Secure by design. Tailored to Prime Source Global content.
          </p>
          <div className="flex items-center justify-center mt-8">
            <a href="#solutions" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#22d3ee] text-black font-semibold hover:scale-105 transition">
              <MessageCircle className="w-5 h-5" />
              Start Building
            </a>
          </div>
        </div>
        <div className="px-8 max-w-7xl mx-auto">
          <GlassIcons onSelect={(it) => {
            const byTitle = (arr, t) => arr.find(x => x.title === t);
            const map = {
              'Basic RAG': 'Basic RAG',
              'Hybrid RAG': 'Hybrid RAG',
              'Conversational': 'Conversational RAG',
              'Multimodal': 'Multimodal RAG',
              'Structured': 'Structured RAG',
              'Graph': 'Knowledge Graph RAG',
              'Agentic': 'Agentic RAG',
              'Realtime': 'Real‑time RAG',
              'Personalized': 'Personalized RAG',
              'Cross‑lingual': 'Cross‑lingual RAG',
              'Voice': 'Voice RAG',
              'Citations': 'Citation RAG',
              'Guardrails': 'Guardrailed RAG',
              'Sales': 'Sales Assistant',
              'HR': 'HR Assistant',
            };
            const keyTitle = map[it.label];
            let item = byTitle(ragTypes, keyTitle);
            let type = 'rag';
            if (!item) {
              item = byTitle(assistantTypes, keyTitle);
              type = 'assistant';
            }
            if (item) {
              openModal(type, item);
            }
          }} />
        </div>
 
        <div id="solutions" className="px-8 py-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold">RAG Types</h2>
            <span className="text-sm text-zinc-400">Tap a card to learn more</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ragTypes.map((r) => {
              const Icon = r.icon;
              return (
                <button key={r.key} onClick={() => openModal('rag', r)} className="text-left relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 hover:border-cyan-500/30 transition shadow-lg shadow-black/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur">
                      <Icon className="w-6 h-6 text-[#22d3ee]" />
                    </div>
                    <div className="text-lg font-semibold">{r.title}</div>
                  </div>
                  <div className="text-sm text-zinc-300 min-h-[48px]">{r.short}</div>
                  <div className="mt-4 flex items-center gap-2">
                    <Info className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs text-zinc-400">More info</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-8 pb-12 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold">Assistant Templates</h2>
            <span className="text-sm text-zinc-400">Ready for branding and voice</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {assistantTypes.map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.key} onClick={() => openModal('assistant', a)} className="text-left relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 hover:border-cyan-500/30 transition shadow-lg shadow-black/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur">
                      <Icon className="w-6 h-6 text-[#22d3ee]" />
                    </div>
                    <div className="text-lg font-semibold">{a.title}</div>
                  </div>
                  <div className="text-sm text-zinc-300 min-h-[48px]">{a.short}</div>
                  <div className="mt-4 flex items-center gap-2">
                    <Info className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs text-zinc-400">More info</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
 
      </div>

      {selected && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal}></div>
          <div className="relative w-full sm:w-[720px] bg-[#0b0b0e] border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  {selected.item.icon ? <selected.item.icon className="w-5 h-5 text-[#22d3ee]" /> : <Bot className="w-5 h-5 text-[#22d3ee]" />}
                </div>
                <div className="text-lg font-semibold">{selected.item.title}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleListening} className={`px-3 py-2 rounded-full border ${isListening ? 'border-cyan-500 bg-cyan-500 text-black' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    <span className="text-sm">{isListening ? 'Listening' : 'Voice'}</span>
                  </div>
                </button>
                <button onClick={closeModal} className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <div className="text-sm text-zinc-300">{selected.item.short}</div>
              {selected.item.works && (
                <div>
                  <div className="text-sm font-semibold mb-2">How it works</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.item.works.map((w, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">{w}</span>
                    ))}
                  </div>
                </div>
              )}
              {selected.item.canDo && (
                <div>
                  <div className="text-sm font-semibold mb-2">What you can build</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.item.canDo.map((w, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">{w}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                {selected.item.query && (
                  <button onClick={() => applySampleQuery(selected.item.query)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#22d3ee] text-black font-semibold">
                    <MessageCircle className="w-4 h-4" />
                    Try sample query
                  </button>
                )}
                <button onClick={() => setIsOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-200">
                  <Bot className="w-4 h-4" />
                  Open chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-8 pointer-events-none'}`}>
        <div className="w-[380px] h-[600px] bg-[#09090b] text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-zinc-800 ring-1 ring-black/5">
          
          <div className="flex items-center justify-between px-4 py-3 bg-[#09090b] border-b border-zinc-800">
            <div className="flex items-center gap-3">
               <div className="scale-75 origin-left">
                  <MiniRobot />
               </div>
               <div>
                  <h3 className="text-[15px] font-semibold">Chat with AI Bot</h3>
                  <div className="flex items-center gap-1.5">
                     <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                     <span className="text-[11px] text-zinc-400">Online</span>
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-1">
               <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition">
                  <Minus className="w-5 h-5" />
               </button>
               <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition">
                  <X className="w-5 h-5" />
               </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent perspective-[1000px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end animate-user-message-in' : 'justify-start animate-message-in'}`}
              >
                {msg.role === 'user' ? (
                  <div className="bg-[#22d3ee] text-black px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] text-[14px] font-medium leading-relaxed shadow-md">
                    {msg.content}
                  </div>
                ) : (
                  <div className="flex gap-3 max-w-[90%] animate-fade-in">
                     <div className="w-10 h-10 flex-shrink-0 -ml-1">
                        <div className="scale-[0.6] origin-top-left">
                            <MiniRobot />
                        </div>
                     </div>
                     <div className="flex flex-col gap-2">
                        <div className="bg-[#1c1c1e] p-3 rounded-2xl rounded-tl-sm border border-zinc-800/50 text-zinc-200 text-[14px] leading-6 font-normal">
                          {msg.content}
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 rounded-full hover:bg-zinc-800 transition text-zinc-500 hover:text-white">
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 rounded-full hover:bg-zinc-800 transition text-zinc-500 hover:text-white">
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 rounded-full hover:bg-zinc-800 transition text-zinc-500 hover:text-white">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                     </div>
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start animate-message-in">
                <div className="flex gap-3 max-w-[90%] animate-fade-in">
                   <div className="flex flex-col gap-2">
                      <div className="bg-gradient-to-br from-[#121214] to-[#1a1a1f]/90 backdrop-blur-sm p-4 rounded-2xl rounded-tl-md border border-white/10 shadow-xl ring-1 ring-cyan-500/10 flex items-center gap-5">
                        <div className="scale-75 origin-left">
                           <WaitingRobot />
                        </div>
                        <span className="text-zinc-300 text-sm tracking-wide animate-pulse">Request from PSG is coming...</span>
                      </div>
                   </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-[#09090b] border-t border-zinc-800">
            <div className="flex items-center gap-2 bg-[#1c1c1e] p-1.5 pl-3 pr-1.5 rounded-[24px] border border-zinc-800/50 focus-within:border-zinc-700 transition duration-300">
               <button className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 transition">
                  <LayoutGrid className="w-5 h-5" strokeWidth={1.5} />
               </button>
               
               <input 
                  type="text" 
                  placeholder="Type message..." 
                  className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-[14px]"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               />
              <button 
                 onClick={toggleListening}
                 className={`px-3 py-2 rounded-full border ${isListening ? 'border-cyan-500 bg-cyan-500 text-black' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}
              >
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  <span className="text-sm">{isListening ? 'Listening' : 'Voice'}</span>
                </div>
              </button>
               
               <button 
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className={`p-2 rounded-full transition-all duration-300 ${inputValue.trim() ? 'bg-[#22d3ee] text-black rotate-0' : 'bg-transparent text-zinc-600 rotate-90'}`}
               >
                  <Send className="w-4 h-4" fill={inputValue.trim() ? "currentColor" : "none"} />
               </button>
            </div>
            <div className="text-center mt-2 text-[10px] text-zinc-500">
               AI can make mistakes.
            </div>
          </div>
        </div>
      </div>

      <div 
        className={`fixed bottom-6 right-6 transition-all duration-300 z-40 ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        <Robot3D onClick={() => setIsOpen(true)} notificationCount={1} />
      </div>

       <button 
        onClick={() => setIsOpen(false)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 z-40 bg-zinc-800 text-white ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >
        <X className="w-7 h-7" />
      </button>

    </div>
  );
}

export default App;
