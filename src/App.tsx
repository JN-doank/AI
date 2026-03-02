/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
  Send, 
  Plus, 
  MessageSquare, 
  Trash2, 
  Menu, 
  X, 
  Bot, 
  User, 
  Sparkles,
  History,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id?: number;
  role: 'user' | 'model';
  content: string;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  summary?: string;
  created_at: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      setCurrentConvId(id);
      setMessages(data.messages || []);
      setSummary(data.summary || null);
      setIsSidebarOpen(false);
    } catch (err) {
      console.error("Failed to load conversation", err);
    }
  };

  const createNewChat = async () => {
    const id = Math.random().toString(36).substring(7);
    const title = "Chat Baru";
    try {
      await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title })
      });
      await fetchConversations();
      setCurrentConvId(id);
      setMessages([]);
      setSummary(null);
      setIsSidebarOpen(false);
    } catch (err) {
      console.error("Failed to create chat", err);
    }
  };

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      await fetchConversations();
      if (currentConvId === id) {
        setCurrentConvId(null);
        setMessages([]);
        setSummary(null);
      }
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  const generateSummary = async (convId: string, chatHistory: Message[]) => {
    if (chatHistory.length < 4) return;

    try {
      const historyText = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Ringkas percakapan berikut dalam 2-3 kalimat yang padat. Fokus pada poin-poin penting yang dibicarakan user:\n\n${historyText}`,
      });

      const newSummary = response.text || "";
      setSummary(newSummary);

      await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: newSummary })
      });
      
      const current = conversations.find(c => c.id === convId);
      if (current?.title === "Chat Baru") {
        const titleResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Berikan judul singkat (maks 5 kata) untuk percakapan ini:\n\n${historyText}`,
        });
        const newTitle = titleResponse.text?.replace(/"/g, '') || "Chat";
        await fetch(`/api/conversations/${convId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle })
        });
        fetchConversations();
      }
    } catch (err) {
      console.error("Failed to generate summary", err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    let convId = currentConvId;
    if (!convId) {
      convId = Math.random().toString(36).substring(7);
      await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: convId, title: "Chat Baru" })
      });
      setCurrentConvId(convId);
      fetchConversations();
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: convId, ...userMessage })
      });

      const historyForGemini = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));
      historyForGemini.push({ role: 'user', parts: [{ text: input }] });

      const systemInstruction = `
        Kamu adalah asisten AI dengan memori percakapan. 
        Gunakan informasi dari percakapan sebelumnya untuk memberikan jawaban yang personal dan relevan.
        Jika user menyebutkan nama, hobi, atau preferensi, ingatlah itu.
        Jawablah dengan gaya yang ramah, membantu, dan profesional.
        Gunakan Bahasa Indonesia yang natural.
      `;

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: historyForGemini,
        config: { systemInstruction }
      });

      const botContent = response.text || "Maaf, saya tidak bisa merespon saat ini.";
      const botMessage: Message = { role: 'model', content: botContent };
      
      setMessages(prev => [...prev, botMessage]);

      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: convId, ...botMessage })
      });

      if ((messages.length + 2) % 5 === 0) {
        generateSummary(convId, [...messages, userMessage, botMessage]);
      }

    } catch (err) {
      console.error("Chat error", err);
      setMessages(prev => [...prev, { role: 'model', content: "Terjadi kesalahan saat menghubungi AI. Silakan coba lagi." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-300 lg:relative lg:translate-x-0 flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2 font-semibold text-zinc-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span>MemoriAI</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-zinc-400 hover:text-zinc-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <button onClick={createNewChat} className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl border border-zinc-700 transition-all active:scale-95">
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Chat Baru</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 custom-scrollbar space-y-1">
          <div className="px-2 py-2 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Riwayat Chat</div>
          {conversations.map((conv) => (
            <button key={conv.id} onClick={() => loadConversation(conv.id)} className={cn("w-full group flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left", currentConvId === conv.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200")}>
              <MessageSquare className={cn("w-4 h-4 flex-shrink-0", currentConvId === conv.id ? "text-emerald-400" : "text-zinc-500")} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{conv.title}</div>
                <div className="text-[10px] opacity-50 truncate">{new Date(conv.created_at).toLocaleDateString()}</div>
              </div>
              <button onClick={(e) => deleteChat(conv.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">U</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-zinc-200 truncate">User Account</div>
              <div className="text-[10px] text-zinc-500">Free Plan</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-100">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold text-zinc-100 truncate max-w-[200px] sm:max-w-md">
                {currentConvId ? conversations.find(c => c.id === currentConvId)?.title : "Mulai Percakapan"}
              </h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-tighter">Gemini AI Active</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {summary && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
                <BookOpen className="w-3 h-3 text-emerald-400" />
                <span>Ringkasan Tersedia</span>
              </div>
            )}
            <History className="w-5 h-5 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8 lg:px-0 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-8">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-2">
                  <Bot className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-zinc-100">Halo! Saya MemoriAI</h2>
                  <p className="text-sm text-zinc-500 max-w-xs mx-auto">Saya ingat apa yang kita bicarakan sebelumnya. Cobalah beritahu saya namamu atau hobimu!</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
                  {["Siapa namaku?", "Apa hobi yang pernah kusebutkan?", "Bantu aku merencanakan hari", "Ringkas percakapan kita"].map((suggestion) => (
                    <button key={suggestion} onClick={() => setInput(suggestion)} className="p-3 text-left text-xs font-medium bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-200 transition-all">{suggestion}</button>
                  ))}
                </div>
              </div>
            )}

            {summary && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Ringkasan Memori</span>
                </div>
                <p className="text-sm text-zinc-300 italic leading-relaxed">"{summary}"</p>
              </motion.div>
            )}

            {messages.map((msg, idx) => (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={idx} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                <div className={cn("w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center", msg.role === 'user' ? "bg-zinc-800" : "bg-emerald-500/10 border border-emerald-500/20")}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-zinc-400" /> : <Bot className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className={cn("max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-sm", msg.role === 'user' ? "bg-emerald-600 text-white rounded-tr-none" : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none")}>
                  <div className="markdown-body"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><Bot className="w-4 h-4 text-emerald-500" /></div>
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-2xl rounded-tl-none">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 lg:p-8 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
          <div className="max-w-3xl mx-auto relative">
            <div className="relative flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 focus-within:border-emerald-500/50 transition-all shadow-2xl">
              <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Tanyakan sesuatu..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-zinc-100 py-2 px-3 resize-none max-h-40 custom-scrollbar" />
              <button onClick={handleSend} disabled={!input.trim() || isLoading} className={cn("p-2.5 rounded-xl transition-all flex-shrink-0", input.trim() && !isLoading ? "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20" : "bg-zinc-800 text-zinc-500 cursor-not-allowed")}><Send className="w-4 h-4" /></button>
            </div>
            <p className="text-[10px] text-center mt-3 text-zinc-600">MemoriAI menggunakan Gemini 3 Flash. AI dapat membuat kesalahan.</p>
          </div>
        </div>
      </main>
    </div>
  );
        }
