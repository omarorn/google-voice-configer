import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  image?: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '', vertexai: true });

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', text: 'Halló! Ég er KnowledgeBot. Hvernig get ég aðstoðað þig í dag?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mcpConfig, setMcpConfig] = useState('');
  const [language, setLanguage] = useState('is-IS');
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (text: string, imageBase64?: string) => {
    setLoading(true);
    try {
      const parts: any[] = [{ text }];
      if (imageBase64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { role: 'user', parts },
        config: { systemInstruction: `Þú ert hjálplegur aðstoðarmaður. Svaraðu á tungumálinu sem notandinn biður um. MCP Stillingar: ${mcpConfig}` }
      });
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', text: response.text || '...' }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: 'err', role: 'assistant', text: 'Villa kom upp.' }]);
    } finally {
      setLoading(false);
    }
  };

  const capturePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current!.videoWidth;
    canvas.height = videoRef.current!.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current!, 0, 0);
    const data = canvas.toDataURL('image/jpeg').split(',')[1];
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: 'Greini mynd...', image: canvas.toDataURL() }]);
    sendMessage('Greindu þessa mynd', data);
  };

  const shareScreen = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    videoRef.current!.srcObject = stream;
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white shadow-2xl">
      <header className="p-4 border-b flex justify-between items-center bg-white">
        <h1 className="text-xl font-bold text-indigo-600">KnowledgeBot AI</h1>
        <div className="flex gap-2">
          <button onClick={shareScreen} className="p-2 bg-slate-100 rounded-full">🖥️</button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 bg-slate-100 rounded-full">⚙️</button>
        </div>
      </header>

      {showSettings && (
        <div className="p-4 bg-slate-50 border-b space-y-4">
          <h2 className="font-bold">Stillingar</h2>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full p-2 border rounded">
            <option value="is-IS">Íslenska</option>
            <option value="en-US">English</option>
          </select>
          <input className="w-full p-2 border rounded" placeholder="Google Service Account Key (JSON)" />
          <textarea className="w-full p-2 border rounded" placeholder="MCP Stillingar (JSON)" value={mcpConfig} onChange={e => setMcpConfig(e.target.value)} />
          <div className="text-sm text-slate-700 bg-white p-3 rounded border">
            <strong>Leiðbeiningar:</strong>
            <ul className="list-disc ml-4">
              <li>Spyrðu um almenna þekkingu.</li>
              <li>Notaðu myndavélina til að greina hluti.</li>
              <li>Notaðu MCP stillingar fyrir verkfæri.</li>
              <li>Ýttu á "Tala" til að heyra svarið.</li>
            </ul>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" ref={scrollRef}>
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%] p-4 rounded-2xl bg-white border shadow-sm">
              {m.image && <img src={m.image} className="rounded-lg mb-2" alt="input" />}
              <p>{m.text}</p>
              {m.role === 'assistant' && <button onClick={() => speak(m.text)} className="text-xs text-indigo-500 mt-2 font-bold">🔊 Tala</button>}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t bg-white">
        <video ref={videoRef} autoPlay playsInline className="hidden" />
        <div className="flex gap-2">
          <input className="flex-1 p-3 border rounded-full" value={input} onChange={e => setInput(e.target.value)} placeholder="Spyrðu um hvað sem er..." />
          <button onClick={capturePhoto} className="bg-slate-800 text-white px-4 rounded-full">📸</button>
          <button onClick={() => { sendMessage(input); setInput(''); }} className="bg-indigo-600 text-white px-6 rounded-full">Senda</button>
        </div>
      </div>
    </div>
  );
}