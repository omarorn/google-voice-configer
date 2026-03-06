import { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Play, Loader2, Volume2, Square, Info, Code, Copy, Check, Settings } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Note: Gemini 2.5 Flash TTS strictly supports only these 5 voices.
const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
const EMOTIONS = ['Neutral', 'Cheerfully', 'Sadly', 'Angrily', 'Whispering', 'Shouting', 'Custom'];

export default function App() {
  const [text, setText] = useState('Hæ, hvernig hefur þú það í dag? Ég vona að þú hafir það gott.');
  const [voice, setVoice] = useState('Kore');
  const [emotion, setEmotion] = useState('Neutral');
  const [customDirection, setCustomDirection] = useState('');
  const [basePrompt, setBasePrompt] = useState('Speak in Icelandic');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Dynamically generate the final prompt based on current settings
  let promptInstruction = basePrompt;
  if (emotion !== 'Neutral' && emotion !== 'Custom') {
    promptInstruction += ` and say it ${emotion.toLowerCase()}`;
  } else if (emotion === 'Custom' && customDirection.trim()) {
    promptInstruction += `. ${customDirection.trim()}`;
  }
  const finalPrompt = `${promptInstruction}:\n${text}`;

  const codeSnippet = `import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateIcelandicSpeech() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ 
      parts: [{ 
        text: ${JSON.stringify(finalPrompt)} 
      }] 
    }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: '${voice}' },
        },
      },
    },
  });

  // Extract base64 audio data
  const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return audioBase64;
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {
        // Ignore
      }
      sourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    stopAudio();

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: finalPrompt }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (audioPart && audioPart.data) {
        playAudio(audioPart.data, audioPart.mimeType);
      } else {
        setError('No audio generated.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while generating speech.');
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (base64: string, mimeType: string) => {
    try {
      if (mimeType.includes('wav') || mimeType.includes('mp3') || mimeType.includes('ogg')) {
        const audio = new Audio(`data:${mimeType};base64,${base64}`);
        audio.onended = () => setIsPlaying(false);
        audio.play();
        setIsPlaying(true);
      } else {
        // Assume raw PCM 16-bit 24000Hz
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const audioCtx = audioCtxRef.current;
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }

        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }
        const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsPlaying(false);
        source.start();
        
        sourceRef.current = source;
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Error playing audio:', err);
      setError('Error playing audio. See console for details.');
      setIsPlaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center py-12 px-4 font-sans text-zinc-900">
      <div className="max-w-2xl w-full space-y-6">
        
        {/* Main App Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-zinc-100">
          <div className="p-6 bg-zinc-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-800 rounded-lg">
                <Volume2 className="w-6 h-6 text-zinc-100" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Icelandic TTS</h1>
                <p className="text-zinc-400 text-xs mt-0.5">Powered by Gemini 2.5 Flash TTS</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          {showSettings && (
            <div className="px-6 py-5 bg-zinc-50 border-b border-zinc-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Prompt & Voice Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">Base Prompt</label>
                  <input 
                    type="text" 
                    value={basePrompt} 
                    onChange={(e) => setBasePrompt(e.target.value)}
                    className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none text-sm bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">Voice <span className="text-zinc-400 font-normal text-xs ml-1">(5 available)</span></label>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none bg-white text-sm"
                  >
                    {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">Emotion / Style</label>
                  <select
                    value={emotion}
                    onChange={(e) => setEmotion(e.target.value)}
                    className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none bg-white text-sm"
                  >
                    {EMOTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                {emotion === 'Custom' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-zinc-700">Custom Direction</label>
                    <input
                      type="text"
                      value={customDirection}
                      onChange={(e) => setCustomDirection(e.target.value)}
                      placeholder="e.g., Speak slowly..."
                      className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none text-sm bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <label className="block text-sm font-medium text-zinc-700">Final Prompt Preview</label>
                <div className="p-3 bg-zinc-200/50 rounded-lg text-sm text-zinc-700 font-mono whitespace-pre-wrap border border-zinc-200">
                  {finalPrompt}
                </div>
              </div>
            </div>
          )}

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label htmlFor="text-input" className="block text-sm font-medium text-zinc-700">
                Text to speak
              </label>
              <textarea
                id="text-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-32 p-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none resize-none transition-all text-sm"
                placeholder="Sláðu inn texta hér..."
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleGenerate}
                disabled={loading || !text.trim()}
                className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Generate & Play
                  </>
                )}
              </button>
              
              {isPlaying && (
                <button
                  onClick={stopAudio}
                  className="py-3 px-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-medium transition-colors flex items-center justify-center"
                  title="Stop Audio"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Code Viewer Card */}
        <div className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
            <div className="flex items-center gap-2 text-zinc-400">
              <Code className="w-4 h-4" />
              <span className="text-sm font-medium">API Code</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors bg-zinc-800/50 hover:bg-zinc-800 px-2.5 py-1.5 rounded-md"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
          <div className="p-4 overflow-x-auto">
            <pre className="text-sm text-zinc-300 font-mono leading-relaxed">
              <code>{codeSnippet}</code>
            </pre>
          </div>
        </div>

        {/* Documentation / Help Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Info className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="space-y-3">
              <h3 className="font-medium text-zinc-900">How Emotions and Directions Work</h3>
              <div className="text-sm text-zinc-600 space-y-4">
                <p>
                  Unlike older TTS systems, Gemini 2.5 Flash TTS does not use traditional SSML tags (like <code>&lt;prosody&gt;</code> or <code>&lt;emotion&gt;</code>). Instead, it understands <strong>natural language prompting</strong>.
                </p>
                
                <div>
                  <h4 className="font-medium text-zinc-900 mb-1">Built-in Options</h4>
                  <p>
                    When you select an emotion from the dropdown (e.g., <em>Cheerfully</em>), the app automatically prepends an instruction to the AI: <br/>
                    <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800 mt-1 inline-block">Speak in Icelandic and say it cheerfully: [Your Text]</code>
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-zinc-900 mb-1">Custom Directions</h4>
                  <p>
                    By selecting <strong>Custom</strong>, you can write your own specific instructions. The AI is highly responsive to descriptive cues. Examples you can try:
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><em>"Speak very slowly and clearly like a teacher"</em></li>
                    <li><em>"Whisper as if you are telling a secret"</em></li>
                    <li><em>"Speak with a deep, dramatic, cinematic voice"</em></li>
                    <li><em>"Sound terrified and out of breath"</em></li>
                  </ul>
                </div>
                
                <div className="pt-2 border-t border-zinc-100">
                  <h4 className="font-medium text-zinc-900 mb-1">Voice Limitations</h4>
                  <p>
                    The Gemini 2.5 Flash TTS API strictly supports exactly <strong>5 prebuilt voices</strong> (Puck, Charon, Kore, Fenrir, Zephyr). There are no other valid voice names in the API. The model adapts these core voices to sound like native Icelandic speakers based on the prompt instructions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
