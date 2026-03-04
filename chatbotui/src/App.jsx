import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { ArrowLeft, MoreHorizontal, ThumbsUp, ThumbsDown, Copy, Send, LayoutGrid, Bot, MessageCircle, X, Minus, ShoppingCart, Briefcase, GraduationCap, Building2, Leaf, Plane, Cpu, Users, Search, Layers, Database, Globe, Wand2, Mic, Volume2, Book, Shield, Brain, Workflow, Languages, Info, Play, Check, ChevronDown, Menu, Palette } from 'lucide-react';
import Robot3D from './components/Robot3D';
import MiniRobot from './components/MiniRobot';
import WaitingRobot from './components/WaitingRobot';
import GlassIcons from './components/GlassIcons';
import FloatingLines from './components/FloatingLines';
import CreateRagModal from './components/CreateRagModal';
import ThemeSettings from './components/ThemeSettings';
import LegalModal from './components/LegalModal';
import { API_BASE_URL } from './config';
const RagAnalyticsDashboard = lazy(() => import('./components/RagAnalyticsDashboard'));

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: 'bot',
    content: 'Hello! I am your RAG architecture guide, powered by the local Qwen model. How can I help you today?',
    suggestions: [
      { id: 'build', label: 'Build a Custom RAG' },
      { id: 'explain', label: 'Explain RAG Types' },
      { id: 'eratimbers', label: 'Test EraTimbers Demo RAG' }
    ]
  }
];



function App() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPosInitialized, setIsPosInitialized] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      // Position in bottom-right corner with a small gap
      setPosition({
        x: window.innerWidth - (isMobile ? 80 : 90),
        y: window.innerHeight - (isMobile ? 80 : 90)
      });
      setIsPosInitialized(true);

      const handleResize = () => {
        setPosition(prev => {
          const padding = 20;
          const elWidth = 80 + padding; // Snug around the 60px robot
          const elHeight = 80 + padding;
          return {
            x: Math.max(padding, Math.min(prev.x, window.innerWidth - elWidth)),
            y: Math.max(padding, Math.min(prev.y, window.innerHeight - elHeight))
          };
        });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const handleDragStart = (e) => {
    const isTouch = e.type === 'touchstart';
    if (!isTouch && e.button !== 0) return;

    // e.preventDefault(); // Remove to allow click
    setHasMoved(false);
    setIsDragging(true);

    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    dragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position.x,
      initialY: position.y
    };

    const onMove = (moveEvent) => {
      const currentX = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = moveEvent.type === 'touchmove' ? moveEvent.touches[0].clientY : moveEvent.clientY;

      if (Math.abs(currentX - dragRef.current.startX) > 3 || Math.abs(currentY - dragRef.current.startY) > 3) {
        setHasMoved(true);
        if (moveEvent.type === 'touchmove') moveEvent.preventDefault(); // Prevent scrolling while dragging
      }

      let newX = dragRef.current.initialX + (currentX - dragRef.current.startX);
      let newY = dragRef.current.initialY + (currentY - dragRef.current.startY);

      const padding = 20;
      const isMobile = window.innerWidth < 768;
      const elementWidth = (isMobile ? 40 : 80) + padding;
      const elementHeight = (isMobile ? 40 : 80) + padding;

      newX = Math.max(padding, Math.min(newX, window.innerWidth - elementWidth));
      newY = Math.max(padding, Math.min(newY, window.innerHeight - elementHeight));
      setPosition({ x: newX, y: newY });
    };

    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    if (isTouch) {
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    } else {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
  };

  const messagesEndRef = useRef(null);
  const terminalRef = useRef(null);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [initialCreateConfig, setInitialCreateConfig] = useState(null);
  const [activeTheme, setActiveTheme] = useState('cyan');
  const [ragConfig, setRagConfig] = useState({ themeHue: 190 });
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isThemeSettingsOpen, setIsThemeSettingsOpen] = useState(false);
  const [themeHue, setThemeHue] = useState(() => {
    const saved = localStorage.getItem('omnirag_theme_hue');
    return saved ? parseInt(saved) : 190; // Default cyan hue
  });
  const [legalModalType, setLegalModalType] = useState(null);

  useEffect(() => {
    localStorage.setItem('omnirag_theme_hue', themeHue);
  }, [themeHue]);

  useEffect(() => {
    const root = document.documentElement;

    // Generate theme colors based on hue
    const accent = `hsl(${themeHue}, 100%, 50%)`;
    const accentDark = `hsl(${themeHue}, 100%, 40%)`;
    const accentGlow = `hsla(${themeHue}, 100%, 50%, 0.3)`;
    const bgTint = `radial-gradient(circle at 50% 50%, hsl(${themeHue}, 30%, 5%) 0%, #020508 100%)`;

    root.style.setProperty('--current-accent', accent);
    root.style.setProperty('--accent-glow', accentGlow);
    root.style.setProperty('--orb-color', accent);
    root.style.setProperty('--bg-void-image', bgTint);

    // Fallback for parts using legacy themes
    const themes = {
      cyan: { bg: '#020508' },
      emerald: { bg: '#010805' },
      purple: { bg: '#050208' },
      rose: { bg: '#080204' }
    };
    const theme = themes[activeTheme] || themes.cyan;
    document.body.style.backgroundColor = theme.bg;
  }, [themeHue, activeTheme]);

  // Mouse move effect for glass panels
  useEffect(() => {
    const handleMouseMove = (e) => {
      document.querySelectorAll('.glass-panel').forEach(panel => {
        const rect = panel.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        panel.style.setProperty('--mouse-x', `${x}%`);
        panel.style.setProperty('--mouse-y', `${y}%`);
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Terminal state
  const terminalLines = [
    "> [SYSTEM] Initializing Agentic Node #402",
    "> [AUTH] Token validated (PRIME_SOURCE_ENT)",
    "> [THINK] Browsing vector store...",
    "> [ACTION] Executing tool: SQLRunner",
    "> [SYSTEM] Retrieved 4 rows",
    "> [THINK] Synthesizing reasoning...",
    "> [OUTPUT] Generation complete."
  ];
  const [termIdx, setTermIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTermIdx(prev => (prev >= terminalLines.length - 1 ? 0 : prev + 1));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [termIdx]);

  const ragTypes = [
    { key: 'basic_rag', title: 'Universal Neural RAG', icon: Search, short: 'Neural vector search for precise text retrieval and answering.', works: ['Chunk text precisely', 'Neural embeddings', 'Top-K retrieval', 'Contextual generation'], canDo: ['FAQs', 'Knowledge Bases'], query: 'How does Universal Neural RAG work?' },
    { key: 'hybrid_rag', title: 'Global Data Integration', icon: Wand2, short: 'Combines keyword & vector search for maximum recall.', works: ['BM25 + Dense vector', 'Reciprocal Rank Fusion', 'Semantic re-ranking'], canDo: ['Documentation', 'Code Search'], query: 'Why use Global Data Integration?' },
    { key: 'conversational_rag', title: 'Enterprise Cognitive RAG', icon: MessageCircle, short: 'Maintains long-term context and chat history.', works: ['Session persistence', 'Context compression', 'Memory management'], canDo: ['Customer Support', 'AI Tutors'], query: 'Explain Cognitive RAG memory.' },
    { key: 'multimodal_rag', title: 'Global Context RAG', icon: Layers, short: 'Seamlessly retrieve images, audio, and video.', works: ['Cross-modal embedding', 'Multi-vector indexing'], canDo: ['Media Search', 'Product Catalogs'], query: 'Show Global Context capabilities.' },
    { key: 'structured_rag', title: 'Structured Intelligence', icon: Database, short: 'Query SQL and structured data sources alongside text.', works: ['Text-to-SQL', 'Table parsing'], canDo: ['Data Analysis', 'Financial Reports'], query: 'How does Structured Intelligence work?' },
    { key: 'graph_rag', title: 'Synaptic Graph RAG', icon: Workflow, short: 'Deep reasoning across knowledge graphs and relationships.', works: ['Entity extraction', 'Relationship mapping', 'Graph traversal'], canDo: ['Legal Discovery', 'Medical Research'], query: 'Why use Synaptic Graph for reasoning?' },
    { key: 'agentic_rag', title: 'Autonomous Network', icon: Brain, short: 'Reasoning agents that plan and use tools.', works: ['Multi-step planning', 'Tool execution', 'Self-correction'], canDo: ['Data Analysis', 'Web Research'], query: 'Show Autonomous Network in action.' },
    { key: 'realtime_rag', title: 'Live Neural Stream', icon: Cpu, short: 'Ingest new data and answer on fresh content.', works: ['Streaming ingestion', 'Ephemeral cache'], canDo: ['News', 'Ops alerts'], query: 'How to keep streams live?' },
    { key: 'personalized_rag', title: 'Adaptive Persona', icon: Users, short: 'Use user profile and preferences in retrieval.', works: ['User context features', 'Scoped indexing'], canDo: ['Portals', 'Learning'], query: 'How to adapt the persona?' },
    { key: 'xl_rag', title: 'Universal Matrix', icon: Languages, short: 'Retrieve and answer across languages.', works: ['Multilingual embeddings', 'Optional translation'], canDo: ['Global sites', 'Support'], query: 'How to connect Universal Matrix?' },
    { key: 'voice_rag', title: 'Vocal Synthesis', icon: Mic, short: 'Voice in/out with retrieval and citations.', works: ['STT to query', 'TTS to speak'], canDo: ['Hotline', 'Kiosk'], query: 'Show Vocal Synthesis example' },
    { key: 'citation_rag', title: 'Verified Intelligence', icon: Book, short: 'Always show sources and evidence.', works: ['Chunk‑level ids', 'Inline references'], canDo: ['Knowledge pages', 'Audits'], query: 'How to ensure verification?' },
    { key: 'guardrails_rag', title: 'Policy Guard Architecture', icon: Shield, short: 'Restrict topics and enforce policies.', works: ['Topic allow/deny', 'Safety checks'], canDo: ['Enterprise', 'Healthcare'], query: 'How to enforce Policy Guard?' }
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
      const resp = await fetch(`${API_BASE_URL}/transcribe`, { method: 'POST', body: fd });
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
      const endpoint = ragConfig?.deployData?.deployment_info?.query_endpoint || `${API_BASE_URL}/api/test-chat`;
      const response = await fetch(endpoint, {
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

  const handleSuggestionClick = async (suggestionId) => {
    if (suggestionId === 'build') {
      setIsCreateModalOpen(true);
      setIsOpen(false);
    } else if (suggestionId === 'explain') {
      handleSend("Can you explain the different types of RAG architectures available?");
    } else if (suggestionId === 'eratimbers') {
      const userMsg = { id: Date.now(), role: 'user', content: 'Trigger Era Timbers Demo RAG' };
      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/demo/eratimbers`, { method: 'POST' });
        if (!response.ok) throw new Error('Demo failed');
        const data = await response.json();

        setRagConfig({ deployData: data });
        const botMsg = {
          id: Date.now() + 1,
          role: 'bot',
          content: `✅ Successfully scraped eratimbers.com and deployed a Hybrid RAG using the local Qwen model! You are now chatting with the deployed pipeline. Ask me anything about Era Timbers products (e.g. "What timber types are available?").`
        };
        setMessages(prev => [...prev, botMsg]);
      } catch (error) {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'bot', content: "Failed to deploy Era Timbers Demo." }]);
      } finally {
        setIsLoading(false);
      }
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

  const loadDashboardData = async () => {
    try {
      const [mRes, lRes] = await Promise.all([
        fetch('http://localhost:8000/api/metrics'),
        fetch('http://localhost:8000/api/logs?limit=50')
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (lRes.ok) setLogs(await lRes.json());
      setIsDashboardOpen(true);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    }
  };

  const chipData = [
    { icon: <Search className="w-3 h-3 text-cyan-400" />, label: 'Universal Neural' },
    { icon: <Wand2 className="w-3 h-3 text-[#a78bfa]" />, label: 'Global Data' },
    { icon: <MessageCircle className="w-3 h-3 text-[#22c55e]" />, label: 'Cognitive' },
    { icon: <Layers className="w-3 h-3 text-[#f97316]" />, label: 'Global Context' },
    { icon: <Workflow className="w-3 h-3 text-[#38bdf8]" />, label: 'Synaptic Graph' },
    { icon: <Brain className="w-3 h-3 text-[#fde047]" />, label: 'Autonomous' },
    { icon: <Cpu className="w-3 h-3 text-[#60a5fa]" />, label: 'Live Stream' },
    { icon: <Users className="w-3 h-3 text-[#34d399]" />, label: 'Adaptive Persona' },
    { icon: <Languages className="w-3 h-3 text-[#f43f5e]" />, label: 'Universal Matrix' },
    { icon: <Mic className="w-3 h-3 text-[#00b4d8]" />, label: 'Vocal Synth' },
    { icon: <Book className="w-3 h-3 text-[#eab308]" />, label: 'Verified Intel' },
    { icon: <Shield className="w-3 h-3 text-[#64748b]" />, label: 'Policy Guard' },
    { icon: <Briefcase className="w-3 h-3 text-[#22c55e]" />, label: 'HR Assistant' },
    { icon: <Book className="w-3 h-3 text-[#fbbf24]" />, label: 'Document Q&A' },
  ];
  const chips = [...chipData, ...chipData];

  return (
    <div className="relative min-h-screen bg-[#020508] font-sans text-zinc-100 selection:bg-cyan-500/30 page-wrap">
      <div className="aurora-container pointer-events-none">
        <div className="aurora-orb orb-1" id="orb1"></div>
        <div className="aurora-orb orb-2"></div>
      </div>

      <nav className="fixed top-8 left-0 right-0 z-50 flex justify-center px-4">
        <div className="nav-pill flex items-center justify-between w-full max-w-lg lg:max-w-none lg:w-auto gap-4 lg:gap-12 animate-fade-in-up">
          <div className="flex items-center gap-3 font-['Syne'] font-bold text-xl tracking-tighter">
            <span className="text-cyan-400">⚡</span> OmniRAG Engine
          </div>

          {/* Burger Menu for Mobile */}
          <button
            className="lg:hidden p-2 text-zinc-400 hover:text-white transition"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="hidden lg:flex items-center gap-8 text-xs font-bold tracking-widest uppercase text-zinc-500">
            <a href="#platform" className="hover:text-white transition">Platform</a>
            <a href="#architectures" className="hover:text-white transition">Architectures</a>
            <a href="#observability" className="hover:text-white transition cursor-pointer">Observability</a>
          </div>
          <button className="hidden sm:block bg-white text-black px-6 py-2.5 rounded-full text-xs font-bold hover:scale-110 active:scale-95 transition shadow-2xl" onClick={() => { setInitialCreateConfig(null); setIsCreateModalOpen(true); }}>
            START BUILDING
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      <div className={`fixed inset-0 z-[100] transition-all duration-500 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)}></div>
        <div className={`absolute right-0 top-0 bottom-0 w-64 glass-panel border-l border-white/10 p-8 flex flex-col gap-8 transition-transform duration-500 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex justify-between items-center">
            <div className="font-['Syne'] font-bold text-xl tracking-tighter">OmniRAG Engine</div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-zinc-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex flex-col gap-6 text-sm font-bold tracking-widest uppercase text-zinc-500">
            <a href="#platform" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-white transition">Platform</a>
            <a href="#architectures" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-white transition">Architectures</a>
            <a href="#observability" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-white transition">Observability</a>
          </div>
          <button className="mt-auto bg-white text-black px-6 py-4 rounded-full text-xs font-bold hover:scale-105 active:scale-95 transition" onClick={() => { setIsMobileMenuOpen(false); setInitialCreateConfig(null); setIsCreateModalOpen(true); }}>
            START BUILDING
          </button>
        </div>
      </div>

      <main className="pt-48 px-6 max-w-7xl mx-auto relative z-10 flex-1 w-full pb-20">

        {/* V2 Hero */}
        <header className="text-center mb-16 md:mb-40 animate-fade-in-up">
          <h1 className="font-['Syne'] text-4xl sm:text-6xl md:text-9xl font-extrabold leading-[1.1] md:leading-[0.9] tracking-tighter mb-10">
            OmniRAG <span className="shimmer-text">Engine</span>
          </h1>
          <p className="text-zinc-500 text-lg md:text-2xl max-w-3xl mx-auto font-light leading-relaxed mb-12">
            Unified RAG infrastructure for enterprise intelligence.
            Move from data silos to a cohesive glass knowledge base.
          </p>
          <div className="flex flex-wrap justify-center gap-6 mb-16">
            <button className="px-10 py-5 bg-cyan-500 text-black rounded-full font-bold shadow-[0_0_30px_rgba(0,210,255,0.4)] hover:scale-105 transition" onClick={() => { setInitialCreateConfig(null); setIsCreateModalOpen(true); }}>
              Deploy Assistant
            </button>
            <button className="px-10 py-5 glass-panel rounded-full font-bold flex items-center gap-3">
              <Play className="w-5 h-5" />
              Watch Ecosystem Overview
            </button>
          </div>

          <div className="ent-type-scroll-wrap">
            <div className="ent-type-scroll-track">
              {chips.map((c, i) => (
                <div key={i} className="ent-type-chip">
                  <span className="ent-chip-icon flex items-center justify-center mr-1">{c.icon}</span>{c.label}
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Dynamic Analytics Dashboard - Moved Up for Visibility */}
        <section id="observability" className="mb-40 relative z-20">
          <Suspense fallback={
            <div className="w-full bg-[#0b0b0e] border border-white/5 rounded-[40px] p-8 glass-card shadow-2xl relative overflow-hidden min-h-[600px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                <span className="text-zinc-500 font-bold text-xs uppercase tracking-widest animate-pulse">Loading Neural Analytics...</span>
              </div>
            </div>
          }>
            <RagAnalyticsDashboard />
          </Suspense>
        </section>

        {/* Advanced Feature: Architecture Flow */}
        <section className="mb-40 animate-fade-in-up animation-delay-200">
          <div className="glass-panel rounded-[40px] p-12 flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/3 text-left">
              <div className="text-cyan-400 font-bold text-xs uppercase tracking-widest mb-4">Core Pipeline</div>
              <h2 className="font-['Syne'] text-4xl font-bold mb-6 text-white">Real-time Retrieval Flow</h2>
              <p className="text-zinc-500 text-sm leading-relaxed mb-8">
                Our hybrid engine concurrently queries vector stores and relational databases,
                merging results through a cross-attention reranker before generation.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <Check className="w-5 h-5 text-emerald-500" />
                  Latency: &lt; 42ms per hop
                </div>
                <div className="flex items-center gap-3 text-sm font-medium">
                  <Check className="w-5 h-5 text-emerald-500" />
                  Context Window: 128k Tokens
                </div>
              </div>
            </div>

            <div className="flex-1 w-full bg-black/20 rounded-3xl p-8 border border-white/5 relative overflow-hidden hidden md:block">
              <svg viewBox="0 0 600 300" className="w-full h-full">
                <path d="M50,150 L150,150 M250,150 L350,150 M450,150 L550,150" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" className="pipeline-path" />

                <g className="node">
                  <circle cx="50" cy="150" r="40" fill="rgba(0, 210, 255, 0.1)" stroke="var(--accent-cyan)" strokeWidth="2" />
                  <foreignObject x="30" y="130" width="40" height="40">
                    <Database className="w-10 h-10 text-cyan-400" />
                  </foreignObject>
                  <text x="50" y="215" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">SOURCE</text>
                </g>

                <g className="node">
                  <circle cx="200" cy="150" r="45" fill="rgba(124, 58, 237, 0.1)" stroke="var(--accent-purple)" strokeWidth="2" />
                  <foreignObject x="175" y="125" width="50" height="50">
                    <Search className="w-12 h-12 text-purple-400" />
                  </foreignObject>
                  <text x="200" y="220" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">RETRIEVAL</text>
                </g>

                <g className="node">
                  <circle cx="400" cy="150" r="45" fill="rgba(16, 185, 129, 0.1)" stroke="var(--accent-emerald)" strokeWidth="2" />
                  <foreignObject x="375" y="125" width="50" height="50">
                    <Layers className="w-12 h-12 text-emerald-400" />
                  </foreignObject>
                  <text x="400" y="220" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">RANKER</text>
                </g>

                <g className="node">
                  <circle cx="550" cy="150" r="40" fill="rgba(255, 255, 255, 0.1)" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
                  <foreignObject x="532" y="132" width="36" height="36">
                    <Check className="w-9 h-9 text-white" />
                  </foreignObject>
                  <text x="550" y="215" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">RESULT</text>
                </g>

                <circle cx="50" cy="150" r="4" fill="var(--accent-cyan)" className="data-packet">
                  <animate attributeName="cx" from="50" to="550" dur="4s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
          </div>
        </section>

        {/* Upgraded Bento Modules */}
        <section className="mb-40 animate-fade-in-up animation-delay-300">
          <div className="bento-grid">

            <div className={`glass-panel rounded-[32px] p-8 bento-main flex flex-col justify-between overflow-hidden transition-all duration-700 ${activeTheme === 'cyan' ? 'ring-2 ring-cyan-500/50' : ''}`}
              onClick={() => setActiveTheme('cyan')}>
              <div className="flex justify-between items-start">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Cpu className="w-8 h-8" />
                </div>
                <div className="px-3 py-1 bg-cyan-500/20 rounded-full text-[10px] font-bold text-cyan-400 uppercase">Live Processing</div>
              </div>

              <div className="mt-8 h-48 bg-black/40 rounded-xl p-4 border border-white/5 overflow-hidden relative">
                <div ref={terminalRef} className="terminal-text text-[11px] font-mono leading-relaxed h-full overflow-y-auto scrollbar-none" id="terminal-logs">
                  {terminalLines.slice(0, termIdx + 1).map((line, i) => (
                    <div key={i} className="text-zinc-300 animate-in fade-in slide-in-from-left-2 duration-300">
                      {line}
                    </div>
                  ))}
                  <div className="animate-pulse text-cyan-400 mt-1">_</div>
                </div>
              </div>

              <div className="mt-6 text-left">
                <h3 className="text-2xl font-bold text-white mb-2">Agentic Reasoning</h3>
                <p className="text-zinc-500 text-sm">Autonomous agents that iterate on complex queries until a high-confidence answer is found.</p>
              </div>
            </div>

            <div className={`glass-panel rounded-[32px] p-8 flex flex-col justify-between transition-all duration-700 ${activeTheme === 'emerald' ? 'ring-2 ring-emerald-500/50' : ''}`}
              onClick={() => setActiveTheme('emerald')}>
              <Shield className="w-10 h-10 text-emerald-400" />
              <div className="text-left mt-4">
                <h3 className="text-xl font-bold text-white mb-2">Policy Guard</h3>
                <p className="text-zinc-500 text-xs">PII Redaction & Topic Compliance.</p>
              </div>
            </div>

            <div className={`glass-panel rounded-[32px] p-8 flex flex-col justify-between transition-all duration-700 ${activeTheme === 'purple' ? 'ring-2 ring-purple-500/50' : ''}`}
              onClick={() => setActiveTheme('purple')}>
              <Layers className="w-10 h-10 text-purple-400" />
              <div className="text-left mt-4">
                <h3 className="text-xl font-bold text-white mb-2">Multi-RAG</h3>
                <p className="text-zinc-500 text-xs">Image, Video, & PDF Retrieval.</p>
              </div>
            </div>

            <div className={`glass-panel rounded-[32px] p-8 bento-wide flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-700 ${activeTheme === 'rose' ? 'ring-2 ring-rose-500/50' : ''}`}
              onClick={() => setActiveTheme('rose')}>
              <div className="flex gap-6 items-center text-left">
                <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-white shrink-0">
                  <Globe className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Cross-Lingual Engine</h3>
                  <p className="text-zinc-500 text-xs">Translate and answer in 94+ languages natively.</p>
                </div>
              </div>
              <div className="flex -space-x-3">
                <div className="w-10 h-10 rounded-full bg-zinc-700 border-2 border-zinc-900 flex items-center justify-center font-bold text-xs">EN</div>
                <div className="w-10 h-10 rounded-full bg-zinc-600 border-2 border-zinc-900 flex items-center justify-center font-bold text-xs">ES</div>
                <div className="w-10 h-10 rounded-full bg-zinc-500 border-2 border-zinc-900 flex items-center justify-center font-bold text-xs pb-1">...</div>
              </div>
            </div>

          </div>
        </section>

        <section className="ent-section" id="platform" style={{ paddingBottom: '20px' }}>
          <div className="ent-section-header-row animate-fade-in-up">
            <div>
              <div className="ent-section-label">Platform Modules</div>
              <h2 className="ent-section-title">Interactive AI Capabilities</h2>
              <p className="ent-section-desc">Explore our highly specialized RAG modules and assistant templates below.</p>
            </div>
          </div>
          <div className="w-full relative z-10 animate-fade-in-up animation-delay-300">
            <GlassIcons onSelect={(it) => {
              const byTitle = (arr, t) => arr.find(x => x.title === t);
              const map = {
                'Universal Neural': 'Universal Neural RAG',
                'Global Data': 'Global Data Integration',
                'Cognitive': 'Enterprise Cognitive RAG',
                'Global Context': 'Global Context RAG',
                'Structured Intel': 'Structured Intelligence',
                'Synaptic Graph': 'Synaptic Graph RAG',
                'Autonomous': 'Autonomous Network',
                'Live Stream': 'Live Neural Stream',
                'Adaptive Persona': 'Adaptive Persona',
                'Universal Matrix': 'Universal Matrix',
                'Vocal Synth': 'Vocal Synthesis',
                'Verified Intel': 'Verified Intelligence',
                'Policy Guard': 'Policy Guard Architecture',
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
        </section>

        <section className="ent-section" id="architectures">
          <div className="ent-section-header-row animate-fade-in-up">
            <div>
              <div className="ent-section-label">RAG Types</div>
              <h2 className="ent-section-title">Choose Your Architecture</h2>
              <p className="ent-section-desc">Thirteen specialized retrieval patterns, each optimized for a different use case and data type.</p>
            </div>
            <button className="ent-btn-ghost hidden md:inline-flex">Tap a card to learn more →</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {ragTypes.map((r) => {
              const Icon = r.icon;
              return (
                <button key={r.key} onClick={() => openModal('rag', r)} className={`text-left relative rounded-[28px] p-6 transition-all duration-300 glass-card group ${activeTheme === 'cyan' && r.key === 'agentic_rag' ? 'live-processing-pulse' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl group-hover:scale-110 transition-transform">
                        <Icon className="w-7 h-7 text-[#22d3ee]" />
                      </div>
                      <div className="text-xl font-bold text-premium">{r.title}</div>
                    </div>
                    {(activeTheme === 'cyan' && r.key === 'agentic_rag') && (
                      <div className="px-2 py-0.5 bg-cyan-500/20 rounded-full text-[8px] font-bold text-cyan-400 uppercase animate-pulse">Live</div>
                    )}
                  </div>
                  <div className="text-sm text-zinc-400 leading-relaxed min-h-[48px]">{r.short}</div>
                  <div className="mt-5 flex items-center gap-2 pt-4 border-t border-white/5">
                    <div className={`w-2 h-2 rounded-full ${activeTheme === 'cyan' && r.key === 'agentic_rag' ? 'bg-cyan-400 animate-ping' : 'bg-cyan-500 animate-pulse'}`}></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      {activeTheme === 'cyan' && r.key === 'agentic_rag' ? 'Processing Node' : 'Ready to Deploy'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="ent-section-divider"><div className="ent-divider-line"></div></div>

        <section className="ent-section" id="templates">
          <div className="ent-section-header-row animate-fade-in-up">
            <div>
              <div className="ent-section-label">Assistant Templates</div>
              <h2 className="ent-section-title">Ready in Minutes</h2>
              <p className="ent-section-desc">Production-ready templates for every department. Fully branded. No engineering required.</p>
            </div>
            <button className="ent-btn-ghost hidden md:inline-flex">Ready for branding and voice →</button>
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
        </section>

        <footer className="ent-footer">
          <div className="ent-footer-logo">omniragengine</div>
          <div className="ent-footer-copy">© 2026 Omniragengine. All rights reserved.</div>
          <div className="flex gap-6">
            <button onClick={() => setLegalModalType('privacy')} className="text-xs text-zinc-500 border-none hover:text-white transition cursor-pointer bg-transparent">Privacy</button>
            <button onClick={() => setLegalModalType('terms')} className="text-xs text-zinc-500 border-none hover:text-white transition cursor-pointer bg-transparent">Terms</button>
            <button onClick={() => setLegalModalType('contact')} className="text-xs text-zinc-500 border-none hover:text-white transition cursor-pointer bg-transparent">Contact</button>
          </div>
        </footer>
      </main>

      {
        selected && (
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
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-800">
                  <button
                    onClick={() => {
                      setInitialCreateConfig({ ragType: selected.item.key, useCase: selected.type === 'assistant' ? selected.item.key : '' });
                      setIsCreateModalOpen(true);
                      closeModal();
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#22d3ee] to-blue-500 text-white font-bold hover:scale-[1.02] transition active:scale-95"
                  >
                    <Wand2 className="w-5 h-5" />
                    Create this RAG
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {selected.item.query && (
                    <button onClick={() => applySampleQuery(selected.item.query)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 text-zinc-300 font-semibold text-sm hover:bg-zinc-700 hover:text-white transition">
                      <MessageCircle className="w-4 h-4" />
                      Try sample query
                    </button>
                  )}
                  <button onClick={() => setIsOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition text-sm">
                    <Bot className="w-4 h-4" />
                    Open chat
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      <div className={`fixed z-[100] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] transform origin-bottom-right ${isOpen ? 'bottom-0 right-0 sm:bottom-10 sm:right-10 scale-100 opacity-100 translate-y-0' : 'bottom-0 right-0 scale-90 opacity-0 translate-y-8 pointer-events-none'}`}>
        <div className="w-screen sm:w-[420px] h-[75dvh] sm:h-[650px] glass-panel mobile-chat-window sm:rounded-[40px] rounded-t-[30px] flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.7)] overflow-hidden">

          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5 mobile-chat-header">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-black shadow-lg shadow-cyan-500/20">
                <Bot className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-white tracking-wide">Neural Assistant</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Node Active</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsThemeSettingsOpen(!isThemeSettingsOpen)}
                className={`p-2 rounded-full transition ${isThemeSettingsOpen ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-white/10 text-zinc-400 hover:text-white'}`}
              >
                <Palette className="w-5 h-5" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition text-zinc-400 hover:text-white">
                <ChevronDown className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative flex flex-col">
            {isThemeSettingsOpen && (
              <div className="absolute inset-x-0 top-0 z-20 bg-[#0b0b0e]/95 backdrop-blur-md border-b border-white/5 animate-slide-up">
                <ThemeSettings
                  currentHue={themeHue}
                  onHueChange={setThemeHue}
                  onClose={() => setIsThemeSettingsOpen(false)}
                />
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-premium">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end animate-user-message-in' : 'justify-start animate-message-in'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="bg-gradient-to-br from-cyan-400 to-blue-500 text-black px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-[14px] font-semibold leading-relaxed shadow-lg shadow-cyan-500/20">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="flex gap-4 max-w-[90%] animate-fade-in">
                      <div className="w-10 h-10 flex-shrink-0">
                        <div className="scale-[0.6] origin-top-left drop-shadow-lg" style={{ filter: `hue-rotate(${themeHue - 190}deg)` }}>
                          <MiniRobot />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl rounded-tl-sm border border-white/10 text-zinc-200 text-[14px] leading-relaxed font-normal shadow-lg">
                          {msg.content}
                        </div>

                        {msg.suggestions && (
                          <div className="flex flex-col gap-2 mt-2 w-full max-w-[280px]">
                            {msg.suggestions.map(s => (
                              <button
                                key={s.id}
                                onClick={() => handleSuggestionClick(s.id)}
                                className="px-4 py-2.5 text-sm text-left bg-black/40 border border-white/10 rounded-xl hover:bg-white/10 hover:border-cyan-500/50 hover:text-cyan-400 transition-all text-zinc-300 shadow-sm"
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 mt-1 ml-1">
                          <button className="p-1.5 rounded-full hover:bg-white/10 transition text-zinc-500 hover:text-white">
                            <ThumbsUp className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 rounded-full hover:bg-white/10 transition text-zinc-500 hover:text-white">
                            <ThumbsDown className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 rounded-full hover:bg-white/10 transition text-zinc-500 hover:text-white">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start animate-message-in">
                  <div className="flex gap-4 max-w-[90%] animate-fade-in">
                    <div className="flex flex-col gap-2">
                      <div className="bg-gradient-to-br from-black/60 to-black/80 backdrop-blur-md p-4 rounded-2xl rounded-tl-sm border border-cyan-500/20 shadow-xl shadow-cyan-500/10 flex items-center gap-5">
                        <div className="scale-[0.6] origin-left" style={{ filter: `hue-rotate(${themeHue - 190}deg)` }}>
                          <WaitingRobot />
                        </div>
                        <span className="text-cyan-400 font-medium text-sm tracking-wide animate-pulse">Computing Node Response...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-6 bg-black/20 backdrop-blur-xl border-t border-white/5">

              {isListening && (
                <div className="w-full h-8 mb-4 flex items-center justify-center gap-1.5">
                  <div className="w-1 h-3 bg-cyan-400 animate-pulse rounded-full"></div>
                  <div className="w-1 h-6 bg-cyan-400 animate-pulse rounded-full" style={{ animationDelay: '100ms' }}></div>
                  <div className="w-1 h-4 bg-cyan-400 animate-pulse rounded-full" style={{ animationDelay: '200ms' }}></div>
                  <div className="w-1 h-8 bg-cyan-400 animate-pulse rounded-full" style={{ animationDelay: '300ms' }}></div>
                  <div className="w-1 h-5 bg-cyan-400 animate-pulse rounded-full" style={{ animationDelay: '400ms' }}></div>
                </div>
              )}

              <div className="flex items-center gap-3 bg-white/5 p-2 rounded-[30px] border border-white/10 focus-within:border-cyan-500/50 focus-within:bg-white/10 transition-all duration-300">
                <button
                  onClick={toggleListening}
                  className={`p-3 rounded-full transition-all flex items-center justify-center ${isListening ? 'text-cyan-400 bg-cyan-400/10 scale-110' : 'text-zinc-500 hover:text-cyan-400 hover:bg-white/5'}`}
                >
                  <Mic className="w-5 h-5" strokeWidth={isListening ? 2 : 1.5} />
                </button>

                <input
                  type="text"
                  placeholder="Describe your architecture..."
                  className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-[14px] px-2"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />

                <button
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim()}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${inputValue.trim() ? 'bg-cyan-400 text-black hover:scale-105 active:scale-95 shadow-lg shadow-cyan-400/20 shrink-0' : 'bg-white/5 text-zinc-600 cursor-not-allowed shrink-0 rotate-90'}`}
                >
                  <Send className="w-5 h-5 ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {
        isPosInitialized && (
          <div
            className={`fixed z-50 group cursor-pointer ${isOpen ? 'scale-0 opacity-0 pointer-events-none transition-all duration-500' : 'scale-100 opacity-100'} ${isDragging ? 'cursor-grabbing' : 'cursor-grab transition-all duration-300'}`}
            style={{ left: position.x, top: position.y }}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onClick={() => {
              if (!hasMoved) setIsOpen(true);
            }}
          >
            <div className="relative w-[40px] h-[40px] sm:w-[50px] sm:h-[50px] flex items-center justify-center overflow-visible group/bot">
              {/* Robot Container - Compact and always visible */}
              <div className="scale-[0.5] sm:scale-[0.65] drop-shadow-[0_0_16px_rgba(0,210,255,0.3)] group-hover:scale-[0.75] transition-transform duration-300 pointer-events-none" style={{ filter: `hue-rotate(${themeHue - 190}deg)` }}>
                <Robot3D />
              </div>
            </div>
          </div>
        )
      }

      {/* Observability Dashboard Modal */}
      {
        isDashboardOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fade-in backdrop-blur-sm bg-black/50">
            <div className="absolute inset-0 bg-zinc-950/80" onClick={() => setIsDashboardOpen(false)} />
            <div className="relative w-full max-w-5xl bg-[#0b0b0e]/90 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[800px] animate-slide-up glass-card">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                <h2 className="text-xl font-bold text-white flex items-center gap-2"><Database className="text-cyan-400" /> Platform Observability Dashboard</h2>
                <button onClick={() => setIsDashboardOpen(false)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5 text-zinc-400" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {metrics && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center"><div className="text-xl sm:text-3xl font-bold text-cyan-400">{metrics.total_queries}</div><div className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-wider">Total Queries</div></div>
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center"><div className="text-xl sm:text-3xl font-bold text-emerald-400">{metrics.total_tokens.toLocaleString()}</div><div className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-wider">Tokens Consumed</div></div>
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center"><div className="text-xl sm:text-3xl font-bold text-amber-400">{metrics.average_latency.toFixed(2)}s</div><div className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-wider">Avg Latency</div></div>
                    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center"><div className="text-xl sm:text-3xl font-bold text-rose-400">{metrics.total_errors}</div><div className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-wider">Total Errors</div></div>
                  </div>
                )}
                {logs && (
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 overflow-hidden">
                    <h3 className="text-lg font-semibold text-white mb-4">Recent Query Logs</h3>
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-left text-sm text-zinc-300">
                        <thead>
                          <tr className="border-b border-white/10 text-zinc-500">
                            <th className="py-2 px-2">Time</th>
                            <th className="py-2 px-2">Pipeline</th>
                            <th className="py-2 px-2">Model</th>
                            <th className="py-2 px-2">Latency</th>
                            <th className="py-2 px-2">Tokens</th>
                            <th className="py-2 px-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-2 px-2 text-xs">{new Date(log.timestamp).toLocaleTimeString()}</td>
                              <td className="py-2 px-2">{log.pipeline_id}</td>
                              <td className="py-2 px-2">{log.model_name || 'unknown'}</td>
                              <td className="py-2 px-2">{log.latency.toFixed(2)}s</td>
                              <td className="py-2 px-2">{log.tokens}</td>
                              <td className="py-2 px-2">{log.error ? <span className="text-rose-400">Error</span> : <span className="text-emerald-400">OK</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      <CreateRagModal
        isOpen={isCreateModalOpen}
        initialConfig={initialCreateConfig}
        onClose={() => setIsCreateModalOpen(false)}
        onComplete={(config) => {
          setRagConfig(config);
          setIsCreateModalOpen(false);
          const msg = {
            id: Date.now(),
            role: 'bot',
            content: `Your ${config.ragType.toUpperCase()} RAG for ${config.useCase} using ${config.vectorDb} is successfully deployed! How can I help you today?`
          };
          setMessages([msg]);
          setIsOpen(true);
        }}
      />

      <LegalModal
        isOpen={!!legalModalType}
        onClose={() => setLegalModalType(null)}
        type={legalModalType}
      />
    </div >
  );
}

export default App;
