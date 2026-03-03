import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Brain, 
  Send, 
  Menu, 
  X, 
  User, 
  Save, 
  Copy, 
  Sparkles,
  MessageSquare,
  Heart,
  Pin,
  RefreshCw,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Inisialisasi Gemini menggunakan API Key dari environment
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

  // Simpan data ke LocalStorage otomatis
  useEffect(() => {
    localStorage.setItem('mindbot_name', userName);
    localStorage.setItem('mindbot_memories', JSON.stringify(memories));
    localStorage.setItem('mindbot_summary', summary);
  }, [userName, memories, summary]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

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

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', text: userText, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }
    ];
    setMessages(newMessages);
    setIsTyping(true);

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

      setMessages(prev => [
        ...prev,
        { role: 'model', text: responseText, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }
      ]);

      extractMemories(userText, responseText);
    } catch (error) {
      console.error(error);
      setMessages(prev => [
        ...prev,
        { role: 'model', text: "⚠️ Maaf, terjadi kesalahan saat menghubungi otak saya.", timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const extractMemories = async (userMsg: string, botResponse: string) => {
    try {
      const prompt = `Analisis pesan pengguna berikut dan ekstrak informasi penting tentang PENGGUNA yang perlu diingat.
Pesan user: "${userMsg}"
Kembalikan JSON array: [{"type": "preferensi|fakta|kebiasaan|tujuan", "text": "info singkat"}]`;

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
    } catch (e) {}
  };

  const generateSummary = async () => {
    if (messages.length < 2) {
      showNotification('Butuh lebih banyak pesan.');
      return;
    }
    setSummary('⏳ Membuat ringkasan...');
    try {
      const conversation = messages.map(m => `${m.role === 'user' ? (userName || 'User') : 'MindBot'}: ${m.text}`).join('\n');
      const prompt = `Buat ringkasan singkat percakapan ini dalam Bahasa Indonesia:\n${conversation}`;
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      setSummary(result.text || "");
      showNotification('✅ Ringkasan berhasil!');
    } catch (e) {
      setSummary('Gagal membuat ringkasan.');
    }
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
      <header className="px-4 py-3 border-b border-border bg-surface flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 hover:bg-card rounded-lg">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-white">
              <Brain size={20} />
            </div>
            <h1 className="font-syne text-lg font-extrabold tracking-tight">Mind<span className="text-accent">Bot</span></h1>
          </div>
        </div>
        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-[11px] px-3 py-1.5 rounded-lg border border-border hover:text-accent2 font-mono">Reset</button>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <AnimatePresence>
          {(isSidebarOpen || window.innerWidth >= 768) && (
            <motion.aside 
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              className="fixed md:relative z-30 w-[280px] h-full border-r border-border bg-surface flex flex-col"
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted flex items-center gap-2"><User size={12} /> Profil</h2>
                  <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-muted"><X size={16} /></button>
                </div>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Nama..." className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-[11px] outline-none focus:border-accent" />
                  <button onClick={handleSetName} className="bg-accent text-white px-3 py-2 rounded-lg text-[11px]">Set</button>
                </div>
                <p className="text-[11px] text-muted">{userName ? `Hai, ${userName}! 👋` : 'Belum diset'}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted mb-3 flex items-center gap-2"><Save size={12} /> Memori</h2>
                <div className="space-y-2">
                  {memories.map((m) => (
                    <div key={m.id} className="group relative bg-card border border-border rounded-xl p-3 hover:border-accent animate-fade-up">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase mb-1">
                        {getTypeIcon(m.type)} <span className={m.type === 'preferensi' ? 'text-accent2' : m.type === 'fakta' ? 'text-accent3' : ''}>{m.type}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">{m.text}</p>
                      <button onClick={() => { setMemories(prev => prev.filter(x => x.id !== m.id)); showNotification('🗑️ Dihapus'); }} className="absolute top-2 right-2 text-muted hover:text-accent2 opacity-0 group-hover:opacity-100"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-border">
                <div className="bg-card border border-border rounded-xl p-3 text-[11px] max-h-[100px] overflow-y-auto mb-2">{summary}</div>
                <button onClick={generateSummary} className="w-full border border-border rounded-lg py-2 text-[11px] hover:text-accent flex items-center justify-center gap-2"><Sparkles size={12} /> Ringkasan</button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="text-5xl animate-bounce">🧠</div>
                <h2 className="font-syne text-2xl font-extrabold">Halo! Saya MindBot</h2>
                <p className="text-muted text-sm max-w-xs">Saya mengingat cerita Anda untuk percakapan yang lebih personal.</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex flex-col max-w-[85%] animate-fade-up ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                  <span className="text-[10px] text-muted mb-1">{msg.role === 'user' ? (userName || 'Kamu') : 'MindBot'}</span>
                  <div className={`px-4 py-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-user-bubble border border-[#3a3060] text-[#d4d0f0] rounded-tr-none' : 'bg-bot-bubble border border-border text-text rounded-tl-none'}`}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-muted mt-1">{msg.timestamp}</span>
                </div>
              ))
            )}
            {isTyping && <div className="dot-bounce">...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-border bg-surface">
            <div className="max-w-4xl mx-auto flex items-end gap-3">
              <textarea 
                ref={inputRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Ketik pesan..." className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-accent resize-none"
              />
              <button onClick={sendMessage} disabled={!input.trim() || isTyping} className="w-12 h-12 rounded-xl bg-accent text-white flex items-center justify-center hover:scale-105 transition-all disabled:opacity-40"><Send size={20} /></button>
            </div>
          </div>
        </main>
      </div>

      {/* Notifikasi */}
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ x: 100 }} animate={{ x: 0 }} exit={{ x: 100 }} className="fixed top-20 right-4 z-50 bg-card border border-accent3 rounded-xl px-4 py-2 text-xs text-accent3 shadow-xl">
            {notification}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
