import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Brain, 
  Send, 
  Menu, 
  X, 
  User, 
  Save, 
  Trash2, 
  Copy, 
  Sparkles,
  MessageSquare,
  Heart,
  Pin,
  RefreshCw,
  Target,
  Check,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Memory {
  id: string;
  type: 'preferensi' | 'fakta' | 'kebiasaan' | 'tujuan' | string;
  text: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

export default function App() {
  const [userName, setUserName] = useState<string>(localStorage.getItem('mindbot_name') || '');
  const [nameInput, setNameInput] = useState('');
  const [memories, setMemories] = useState<Memory[]>(JSON.parse(localStorage.getItem('mindbot_memories') || '[]'));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [summary, setSummary] = useState<string>(localStorage.getItem('mindbot_summary') || 'Belum ada ringkasan. Klik tombol di bawah setelah beberapa pesan.');
  const [notification, setNotification] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist data
  useEffect(() => {
    localStorage.setItem('mindbot_name', userName);
    localStorage.setItem('mindbot_memories', JSON.stringify(memories));
    localStorage.setItem('mindbot_summary', summary);
  }, [userName, memories, summary]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSetName = () => {
    if (!nameInput.trim()) return;
    setUserName(nameInput.trim());
    setNameInput('');
    showNotification(`Nama disimpan: ${nameInput}`);
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const userMessage: ChatMessage = { 
      role: 'user', 
      text: userText, 
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };

    const newMessages: ChatMessage[] = [...messages, userMessage];
    setMessages(newMessages);
    setIsTyping(true);

    // Simulate delivery
    setTimeout(() => {
      setMessages(prev => prev.map((msg, idx) => 
        idx === prev.length - 1 && msg.role === 'user' ? { ...msg, status: 'delivered' } : msg
      ));
    }, 500);

    try {
      const chat = genAI.chats.create({ 
        model: "gemini-2.0-flash",
        config: {
          systemInstruction: `Kamu adalah MindBot, asisten AI yang cerdas, hangat, dan memiliki memori tentang pengguna. 
Kamu berbicara dalam Bahasa Indonesia dengan gaya yang natural, ramah, dan personal.
Nama pengguna: ${userName || 'belum diketahui'}
INFO TENTANG USER:
${memories.map(m => `- [${m.type}] ${m.text}`).join('\n')}

Gunakan informasi di atas untuk mempersonalisasi responmu. Sebut nama pengguna sesekali. 
Jika relevan, referensikan hal-hal yang sudah kamu ketahui tentang mereka.
Berikan respons yang helpful, natural, dan terasa seperti percakapan dengan teman yang mengenalmu.`
        },
        history: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }],
        })),
      });

      const result = await chat.sendMessage({ message: userText });
      const responseText = result.text || "";

      // Mark user message as read when bot responds
      setMessages(prev => {
        const updated = prev.map(msg => 
          msg.role === 'user' && msg.status !== 'read' ? { ...msg, status: 'read' } : msg
        );
        return [
          ...updated,
          { 
            role: 'model', 
            text: responseText, 
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) 
          }
        ];
      });

      // Extract memories in background
      extractMemories(userText, responseText);
    } catch (error) {
      console.error(error);
      setMessages(prev => [
        ...prev,
        { role: 'model', text: "⚠️ Maaf, terjadi kesalahan saat menghubungi otak saya. Coba lagi nanti.", timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const extractMemories = async (userMsg: string, botResponse: string) => {
    try {
      const prompt = `Analisis pesan pengguna berikut dan ekstrak informasi penting tentang PENGGUNA yang perlu diingat.
      
Pesan user: "${userMsg}"

Kembalikan JSON array dengan format:
[{"type": "TIPE", "text": "informasi singkat"}]

Tipe yang tersedia: "preferensi" (suka/tidak suka), "fakta" (data personal: umur, pekerjaan, lokasi, dll), "kebiasaan" (rutinitas/aktivitas), "tujuan" (goals/rencana)

Jika tidak ada info penting, kembalikan array kosong: []
HANYA kembalikan JSON, tidak ada teks lain.`;

      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.1, maxOutputTokens: 300 }
      });
      
      const raw = result.text || "";
      const clean = raw.replace(/```json|```/g, '').trim();
      const extracted = JSON.parse(clean);
      
      if (Array.isArray(extracted) && extracted.length > 0) {
        setMemories(prev => {
          const newMemories = [...prev];
          extracted.forEach(item => {
            const exists = newMemories.some(m => m.text.toLowerCase() === item.text.toLowerCase());
            if (!exists && item.text) {
              newMemories.push({ ...item, id: Date.now() + Math.random().toString() });
              showNotification(`💾 Memori baru: ${item.text.substring(0, 30)}...`);
            }
          });
          return newMemories;
        });
      }
    } catch (e) {
      // Silent fail
    }
  };

  const generateSummary = async () => {
    if (messages.length < 2) {
      showNotification('Butuh lebih banyak pesan untuk ringkasan.');
      return;
    }

    setSummary('⏳ Membuat ringkasan...');
    try {
      const conversation = messages.map(m => `${m.role === 'user' ? (userName || 'User') : 'MindBot'}: ${m.text}`).join('\n');
      const prompt = `Buat ringkasan singkat dan terstruktur dari percakapan berikut dalam Bahasa Indonesia.
Format ringkasan:
• Topik utama yang dibahas
• Poin-poin penting
• Kesimpulan atau tindak lanjut (jika ada)

Percakapan:
${conversation.substring(0, 4000)}`;

      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.3, maxOutputTokens: 500 }
      });
      
      setSummary(result.text || "");
      showNotification('✅ Ringkasan berhasil dibuat!');
    } catch (e) {
      setSummary('Gagal membuat ringkasan. Coba lagi.');
    }
  };

  const deleteMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
    showNotification('🗑️ Memori dihapus');
  };

  const clearAll = () => {
    if (!confirm('Reset semua? Memori dan riwayat chat akan hilang.')) return;
    setMemories([]);
    setMessages([]);
    setUserName('');
    setSummary('Belum ada ringkasan. Klik tombol di bawah setelah beberapa pesan.');
    localStorage.clear();
    showNotification('🧹 Semua data dibersihkan');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'preferensi': return <Heart size={10} className="text-accent2" />;
      case 'fakta': return <Pin size={10} className="text-accent3" />;
      case 'kebiasaan': return <RefreshCw size={10} className="text-yellow-400" />;
      case 'tujuan': return <Target size={10} className="text-blue-400" />;
      default: return <Sparkles size={10} className="text-accent" />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg text-text overflow-hidden">
      {/* Header */}
      <header className="px-4 md:px-6 py-3 border-b border-border bg-surface flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-2 hover:bg-card rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-white">
              <Brain size={20} />
            </div>
            <h1 className="font-syne text-lg font-extrabold tracking-tight">
              Mind<span className="text-accent">Bot</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex gap-2">
            <span className="text-[10px] px-2 py-1 rounded-full border border-accent3 text-accent3 font-mono">
              {memories.length} memori
            </span>
            <span className="text-[10px] px-2 py-1 rounded-full border border-border text-muted font-mono">
              {Math.floor(messages.length / 2)} pesan
            </span>
          </div>
          <button 
            onClick={clearAll}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-border hover:border-accent2 hover:text-accent2 transition-all font-mono"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar / Drawer */}
        <AnimatePresence>
          {(isSidebarOpen || window.innerWidth >= 768) && (
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`
                fixed md:relative z-30 w-[280px] h-full border-r border-border bg-surface flex flex-col
                ${isSidebarOpen ? 'shadow-2xl shadow-black' : ''}
              `}
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-syne text-[11px] font-bold tracking-widest uppercase text-muted flex items-center gap-2">
                    <User size={12} /> Profil Kamu
                  </h2>
                  <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-muted">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Nama kamu..."
                    className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-[11px] outline-none focus:border-accent transition-colors"
                  />
                  <button 
                    onClick={handleSetName}
                    className="bg-accent text-white px-3 py-2 rounded-lg text-[11px] hover:opacity-85 transition-opacity"
                  >
                    Set
                  </button>
                </div>
                <p className="text-[11px] text-muted">
                  {userName ? `Hai, ${userName}! 👋` : 'Belum diset — sapa saya dulu!'}
                </p>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col p-4">
                <h2 className="font-syne text-[11px] font-bold tracking-widest uppercase text-muted mb-3 flex items-center gap-2">
                  <Save size={12} /> Memori Tersimpan
                </h2>
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  {memories.length === 0 ? (
                    <div className="text-center py-10 text-muted text-[11px] leading-relaxed">
                      Belum ada memori.<br/>Mulai ngobrol untuk<br/>mengisi memori! 🌱
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {memories.map((m) => (
                        <div key={m.id} className="group relative bg-card border border-border rounded-xl p-3 hover:border-accent transition-all animate-fade-up">
                          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider mb-1">
                            {getTypeIcon(m.type)}
                            <span style={{ color: m.type === 'preferensi' ? 'var(--color-accent2)' : m.type === 'fakta' ? 'var(--color-accent3)' : 'inherit' }}>
                              {m.type}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed pr-4">{m.text}</p>
                          <button 
                            onClick={() => deleteMemory(m.id)}
                            className="absolute top-2 right-2 text-muted hover:text-accent2 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-border">
                <h2 className="font-syne text-[11px] font-bold tracking-widest uppercase text-muted mb-3 flex items-center gap-2">
                  <MessageSquare size={12} /> Ringkasan Chat
                </h2>
                <div className="bg-card border border-border rounded-xl p-3 text-[11px] leading-relaxed max-h-[150px] overflow-y-auto whitespace-pre-wrap mb-2">
                  {summary}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={generateSummary}
                    className="flex-1 border border-border rounded-lg py-2 text-[11px] hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles size={12} /> Buat Ringkasan
                  </button>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(summary);
                      showNotification('📋 Ringkasan disalin!');
                    }}
                    className="border border-border rounded-lg px-3 py-2 hover:border-accent hover:text-accent transition-all"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-fade-up">
                <div className="text-5xl animate-bounce">🧠</div>
                <h2 className="font-syne text-2xl font-extrabold">Halo! Saya MindBot</h2>
                <p className="text-muted text-sm max-w-xs leading-relaxed">
                  Saya mengingat semua yang kamu ceritakan dan mempersonalisasi percakapan berdasarkan memori tentang kamu.
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex flex-col max-w-[85%] md:max-w-[75%] animate-fade-up ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                >
                  <span className="text-[10px] text-muted mb-1.5 tracking-wide">
                    {msg.role === 'user' ? (userName || 'Kamu') : 'MindBot'}
                  </span>
                  <div className={`
                    px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
                    ${msg.role === 'user' 
                      ? 'bg-user-bubble border border-[#3a3060] text-[#d4d0f0] rounded-tr-none' 
                      : 'bg-bot-bubble border border-border text-text rounded-tl-none'}
                  `}>
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-muted">{msg.timestamp}</span>
                    {msg.role === 'user' && (
                      <div className="flex items-center">
                        {msg.status === 'sent' && <Check size={10} className="text-muted" />}
                        {msg.status === 'delivered' && <CheckCheck size={10} className="text-muted" />}
                        {msg.status === 'read' && <CheckCheck size={10} className="text-accent3" />}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {isTyping && (
              <div className="flex flex-col items-start max-w-[75%] animate-fade-up">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-muted tracking-wide">MindBot</span>
                  <span className="text-[9px] text-accent font-medium animate-pulse">sedang berpikir...</span>
                </div>
                <div className="bg-bot-bubble border border-border px-5 py-4 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent dot-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-accent dot-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-accent dot-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 md:p-6 border-t border-border bg-surface">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end gap-3">
                <textarea 
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                  placeholder="Ketik pesan..."
                  className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-accent transition-colors resize-none max-h-[120px] leading-relaxed"
                />
                <button 
                  onClick={sendMessage}
                  disabled={!input.trim() || isTyping}
                  className="w-12 h-12 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-[#6a5ae0] hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <Send size={20} />
                </button>
              </div>
              <p className="text-[10px] text-muted mt-3 text-center">
                Enter untuk kirim • Shift+Enter untuk baris baru • Powered by Gemini AI
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="fixed top-20 right-4 md:right-8 z-50 bg-card border border-accent3 rounded-xl px-4 py-3 text-xs text-accent3 shadow-xl"
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }
      `}</style>
    </div>
  );
}
