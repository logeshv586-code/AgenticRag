import React from 'react';
import { X, Shield, Book, Mail, Copy, Check, ExternalLink } from 'lucide-react';

const LegalModal = ({ isOpen, onClose, type }) => {
    const [copied, setCopied] = React.useState(false);

    if (!isOpen) return null;

    const handleCopyEmail = () => {
        navigator.clipboard.writeText('logeshv586@gmail.com');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const content = {
        privacy: {
            title: 'Privacy Policy',
            icon: Shield,
            color: 'text-cyan-400',
            body: (
                <div className="space-y-4 text-zinc-300 text-sm leading-relaxed">
                    <p>
                        At OmniRAG Engine, we prioritize the security and privacy of your enterprise data.
                        Our platform is designed with a "privacy-first" architecture.
                    </p>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <h4 className="font-bold text-white mb-2">Data Handling</h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Local RAG deployments process all data within your infrastructure.</li>
                            <li>Cloud RAG deployments use encrypted transit and storage.</li>
                            <li>PII is automatically redacted when Privacy Mode is enabled.</li>
                        </ul>
                    </div>
                    <p>
                        We do not sell or share your data with third parties for training purposes.
                        Your knowledge base remains exclusively yours.
                    </p>
                </div>
            )
        },
        terms: {
            title: 'Terms of Service',
            icon: Book,
            color: 'text-purple-400',
            body: (
                <div className="space-y-4 text-zinc-300 text-sm leading-relaxed">
                    <p>
                        By using OmniRAG Engine, you agree to our terms of service designed for enterprise intelligence.
                    </p>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <h4 className="font-bold text-white mb-2">Key Guidelines</h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li>The platform is provided for knowledge retrieval and reasoning.</li>
                            <li>Users are responsible for the data ingested into the system.</li>
                            <li>Enterprise licenses are required for production scale deployment.</li>
                        </ul>
                    </div>
                    <p>
                        We continuously update our neural engines to ensure high accuracy and reliability.
                    </p>
                </div>
            )
        },
        contact: {
            title: 'Contact Support',
            icon: Mail,
            color: 'text-emerald-400',
            body: (
                <div className="space-y-6 text-zinc-300 text-sm leading-relaxed">
                    <p>
                        Need help with your RAG pipeline or enterprise deployment? Reach out to our technical team.
                    </p>

                    <div className="bg-white/5 p-6 rounded-2xl border border-white-10 flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                            <Mail className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="text-zinc-500 text-xs mb-1 uppercase tracking-widest font-bold">Email Address</div>
                            <div className="text-xl font-bold text-white">logeshv586@gmail.com</div>
                        </div>

                        <div className="flex gap-3 w-full">
                            <button
                                onClick={handleCopyEmail}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition group"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400 group-hover:text-white" />}
                                <span className="font-bold">{copied ? 'Copied!' : 'Copy Email'}</span>
                            </button>
                            <a
                                href="mailto:logeshv586@gmail.com"
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:scale-[1.02] active:scale-95 transition"
                            >
                                <ExternalLink className="w-4 h-4" />
                                <span>Send Mail</span>
                            </a>
                        </div>
                    </div>
                </div>
            )
        }
    };

    const selected = content[type] || content.privacy;
    const Icon = selected.icon;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-fade-in backdrop-blur-md bg-black/60">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-[#0b0b0e]/95 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-slide-up glass-card">
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${selected.color}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-white">{selected.title}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8">
                    {selected.body}
                </div>

                <div className="px-8 pb-8">
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LegalModal;
