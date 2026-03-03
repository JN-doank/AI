import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Send, Plus, MessageSquare, Trash2, Menu, X, Bot, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface Message { role: 'user' | 'model'; content: string; }
interface Conversation { id: string; title: string; messages: Message[]; created_at: string; }

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('memoriai_chats');
    if (saved) {
      const parsed = JSON.parse(saved);
      setConversations(parsed);
      if (parsed.length > 0) setCurrentConvId(parsed[0].id);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('memoriai_chats', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentConvId, conversations]);

  const currentChat = conversations.find(c => c.id === currentConvId);

  const createNewChat = () => {
    const newChat: Conversation = {
      id: Math.random().toString(36).substring(7),
      title: "Chat Baru",
      messages: [],
      created_at: new Date().toISOString()
    };
    setConversations([newChat, ...conversations]);
    setCurrentConvId(newChat.id);
    setIsSidebarOpen(false);
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = conversations.filter(c => c.id !== id);
    setConversations(filtered);
    if (currentConvId === id) setCurrentConvId(filtered.length > 0 ? filtered[0].id : null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    let activeId = currentConvId;
    let updatedConvs = [...conversations];

    if (!activeId) {
      const newId = Math.random().toString(36).substring(7);
      const newChat: Conversation = { id: newId, title: "Chat Baru", messages: [], created_at: new Date().toISOString() };
      updatedConvs = [newChat, ...updatedConvs];
      activeId = newId;
      setCurrentConvId(newId);
    }

    const userMsg: Message = { role: 'user', content: input };
    const chatIdx = updatedConvs.findIndex(c => c.id === activeId);
    updatedConvs[chatIdx].messages.push(userMsg);
    
    setConversations([...updatedConvs]);
    setInput('');
    setIsLoading(true);

    try {
      const history = updatedConvs[chatIdx].messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: history,
        config: { systemInstruction: "Kamu adalah MemoriAI. Ingat informasi user untuk personalisasi. Gunakan Bahasa Indonesia." }
      });

      const botMsg: Message = { role: 'model', content: response.text || "Maaf, saya tidak bisa merespon." };
      updatedConvs[chatIdx].messages.push(botMsg);

      if (updatedConvs[chatIdx].messages.length === 2) {
        const titleRes = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Berikan judul singkat (maks 5 kata) untuk chat ini: ${input}`
        });
        updatedConvs[chatIdx].title = titleRes.text?.replace(/"/g, '') || "Chat";
      }

      setConversations([...updatedConvs]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-50 w-72 bg-zinc-900 border-r border-zinc-800 transition-transform lg:relative lg:translate-x-0", isSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="p-4 flex justify-between items-center border-b border-zinc-800">
          <div className="flex items-center gap-2 font-bold"><Sparkles className="text-emerald-500"/> MemoriAI</div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden"><X/></button>
        </div>
        <div className="p-4"><button onClick={createNewChat} className="w-full py-2 bg-zinc-800 rounded-xl border border-zinc-700 hover:bg-zinc-700 flex items-center justify-center gap-2"><Plus size={18}/> Chat Baru</button></div>
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {conversations.map(c => (
            <div key={c.id} onClick={() => {setCurrentConvId(c.id); setIsSidebarOpen(false);}} className={cn("p-3 rounded-xl cursor-pointer flex items-center gap-3 group", currentConvId === c.id ? "bg-zinc-800" : "hover:bg-zinc-800/50")}>
              <MessageSquare size={16} className="text-zinc-500"/>
              <span className="flex-1 truncate text-sm">{c.title}</span>
              <button onClick={(e) => deleteChat(c.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400"><Trash2 size={14}/></button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-zinc-800 flex items-center px-4 gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden"><Menu/></button>
          <h1 className="font-semibold truncate">{currentChat?.title || "MemoriAI"}</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">
            {currentChat?.messages.map((m, i) => (
              <div key={i} className={cn("flex gap-4", m.role === 'user' ? "flex-row-reverse" : "")}>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", m.role === 'user' ? "bg-zinc-800" : "bg-emerald-500/10 border border-emerald-500/20")}>
                  {m.role === 'user' ? <User size={16}/> : <Bot size={16} className="text-emerald-500"/>}
                </div>
                <div className={cn("max-w-[80%] p-3 rounded-2xl text-sm", m.role === 'user' ? "bg-emerald-600" : "bg-zinc-900 border border-zinc-800")}>
                  <ReactMarkdown className="prose prose-invert max-w-none">{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {isLoading && <div className="text-zinc-500 text-xs animate-pulse">MemoriAI sedang berpikir...</div>}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 lg:p-8">
          <div className="max-w-3xl mx-auto flex gap-2 bg-zinc-900 border border-zinc-800 p-2 rounded-2xl">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Tanyakan sesuatu..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2"/>
            <button onClick={handleSend} disabled={isLoading} className="p-2 bg-emerald-500 rounded-xl hover:bg-emerald-400 disabled:opacity-50"><Send size={18}/></button>
          </div>
        </div>
      </main>
    </div>
  );
}
