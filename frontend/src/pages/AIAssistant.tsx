import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Activity } from 'lucide-react';
import { apiClient } from '../api/client';

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  sources?: string[];
}

export const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      text: 'Welcome. I am the Traffic Intelligence Assistant. Ask questions about license sightings, active watchlists, and road network congestion bottlenecks.',
      sources: ["PostgreSQL Live State", "Traffic Metrics Index"]
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sampleQueries = [
    "Where was TN01AB1234 last detected?",
    "Show blacklisted vehicle alerts.",
    "Which intersection is most congested?",
    "What is the average speed at Central Plaza North?"
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;
    
    const userMsg = textToSend;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiClient.post('/assistant/query', { query: userMsg });
      setMessages((prev) => [...prev, {
        sender: 'assistant',
        text: res.data.response,
        sources: res.data.sources
      }]);
    } catch (err) {
      console.error('Error querying AI assistant:', err);
      setMessages((prev) => [
        ...prev,
        { sender: 'assistant', text: 'Error executing the query. Please verify connection and try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 h-[calc(100vh-64px)] flex flex-col justify-between bg-[#F8F5FC] select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between border-l-4 border-l-[#7258A6] bg-[#F2EEFA] p-3 rounded shrink-0">
        <div>
          <h1 className="text-sm font-bold text-[#4E3D73] tracking-tight uppercase">Traffic Intelligence Assistant</h1>
          <p className="text-[10px] text-[#4E3D73]/80 font-mono mt-0.5">Municipal Knowledge Base Dynamic Natural Language Queries</p>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 my-4 overflow-hidden">
        {/* Chat log */}
        <div className="lg:col-span-3 bg-white rounded flex flex-col justify-between overflow-hidden border border-[#DDD4EC]">
          <div className="p-4 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
            {messages.map((msg, idx) => {
              const isAssistant = msg.sender === 'assistant';
              return (
                <div key={idx} className={`flex gap-3 max-w-2xl ${isAssistant ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 border ${
                    isAssistant 
                      ? 'bg-[#F2EEFA] text-[#7258A6] border-[#DDD4EC]' 
                      : 'bg-[#EEF2F5] text-slate-700 border-[#DCE4EA]'
                  }`}>
                    {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  {/* Speech Bubble */}
                  <div className={`p-3.5 rounded-lg text-xs leading-relaxed border ${
                    isAssistant 
                      ? 'bg-[#F2EEFA] text-[#24313D] border-[#DDD4EC]' 
                      : 'bg-[#EEF2F5] text-[#24313D] border-[#DCE4EA]'
                  }`}>
                    <p className="font-semibold whitespace-pre-wrap">{msg.text}</p>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-[#DDD4EC]/65 flex flex-wrap gap-1.5 items-center">
                        <span className="text-[9px] font-mono text-slate-400 font-bold uppercase mr-1">Sources:</span>
                        {msg.sources.map((src, sIdx) => (
                          <span key={sIdx} className="px-1.5 py-0.5 rounded bg-[#EAE3F7] text-[#553E87] border border-[#DDD4EC] font-mono text-[9px] font-bold">
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex gap-3 max-w-2xl mr-auto">
                <div className="w-8 h-8 rounded bg-[#F2EEFA] text-[#7258A6] flex items-center justify-center shrink-0 border border-[#DDD4EC]">
                  <Bot className="w-4 h-4 animate-pulse" />
                </div>
                <div className="p-3.5 rounded-lg bg-[#F2EEFA] text-slate-500 border border-[#DDD4EC] text-xs font-mono animate-pulse">
                  Querying database tables...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Form input */}
          <div className="p-4 border-t border-[#DCE4EA] bg-slate-50 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="flex gap-3"
            >
              <input
                type="text"
                required
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about vehicle plates, active alerts, bottlenecks..."
                className="flex-1 bg-white border border-[#CBD6DE] rounded px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-[#4A82A8] focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#245B84] hover:bg-[#1D4D70] text-white rounded flex items-center justify-center transition-colors shadow-sm disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Side templates */}
        <div className="lg:col-span-1 bg-white p-5 rounded border border-[#DDD4EC] flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <h2 className="text-xs font-mono font-bold text-[#4E3D73] uppercase flex items-center gap-1.5 border-b border-[#DDD4EC] pb-2">
              <Activity className="w-4 h-4 text-[#7258A6]" /> Example Queries
            </h2>
            <p className="text-[10px] text-[#667582] font-mono leading-relaxed">
              Click any of the operational templates below to query the database using the SQL generation engine:
            </p>
            <div className="space-y-2">
              {sampleQueries.map((query, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(query)}
                  disabled={loading}
                  className="w-full text-left p-2.5 bg-[#F8F5FC] border border-[#DDD4EC] hover:bg-[#F2EEFA] rounded text-[10px] text-slate-650 font-mono font-semibold transition-colors leading-relaxed block"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
