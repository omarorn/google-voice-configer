import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Play, Loader2, Volume2, Square, Info, Code, Copy, Check, Settings } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Note: Gemini 2.5 Flash TTS strictly supports only these 5 voices.
const PROVIDERS = ['Gemini', 'OpenAI', 'ElevenLabs'];
const VOICES: Record<string, string[]> = {
  Gemini: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'],
  OpenAI: ['Alloy', 'Echo', 'Fable', 'Onyx', 'Nova', 'Shimmer'],
  ElevenLabs: ['Rachel', 'Drew', 'Clyde', 'Fin', 'Sarah', 'Antoni', 'Charlie', 'Callum', 'Charlotte', 'Alice', 'Matilda', 'Will', 'Freya', 'Jessie', 'Michael']
};
const EMOTIONS = [
  { id: 'neutral', label: 'Hlutlaust', suffix: '' },
  { id: 'cheerfully', label: 'Glaðlega', suffix: 'og segðu það glaðlega' },
  { id: 'sadly', label: 'Sorgmætt', suffix: 'og segðu það sorgmætt' },
  { id: 'angrily', label: 'Reiðilega', suffix: 'og segðu það reiðilega' },
  { id: 'whispering', label: 'Hvíslandi', suffix: 'og hvíslar því' },
  { id: 'shouting', label: 'Öskrandi', suffix: 'og öskraðu það' },
  { id: 'custom', label: 'Sérsniðið', suffix: '' }
];

export default function App() {
  const [provider, setProvider] = useState('Gemini');
  const [text, setText] = useState('Hæ, hvernig hefur þú það í dag? Ég vona að þú hafir það gott.');
  const [voice, setVoice] = useState('Kore');
  const [emotion, setEmotion] = useState('neutral');
  const [customDirection, setCustomDirection] = useState('');
  const [basePrompt, setBasePrompt] = useState('Talaðu á íslensku');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // OpenAI Settings
  const [openAiKey, setOpenAiKey] = useState('');
  const [openAiModel, setOpenAiModel] = useState('tts-1');
  const [openAiSpeed, setOpenAiSpeed] = useState(1.0);

  // ElevenLabs Settings
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [elevenLabsModel, setElevenLabsModel] = useState('eleven_turbo_v2_5');
  const [elevenLabsStability, setElevenLabsStability] = useState(0.5);
  const [elevenLabsSimilarity, setElevenLabsSimilarity] = useState(0.75);

  // Load saved keys on mount
  useEffect(() => {
    const savedOpenAi = localStorage.getItem('openai_api_key');
    const savedElevenLabs = localStorage.getItem('elevenlabs_api_key');
    if (savedOpenAi) setOpenAiKey(savedOpenAi);
    if (savedElevenLabs) setElevenLabsKey(savedElevenLabs);
  }, []);

  const saveKeys = () => {
    localStorage.setItem('openai_api_key', openAiKey);
    localStorage.setItem('elevenlabs_api_key', elevenLabsKey);
    alert('API lyklar vistaðir!');
  };

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Dynamically generate the final prompt based on current settings
  let promptInstruction = basePrompt;
  const selectedEmotion = EMOTIONS.find(e => e.id === emotion);
  if (selectedEmotion && selectedEmotion.suffix) {
    promptInstruction += ` ${selectedEmotion.suffix}`;
  } else if (emotion === 'custom' && customDirection.trim()) {
    promptInstruction += `. ${customDirection.trim()}`;
  }
  const finalPrompt = `${promptInstruction}:\n${text}`;

  let codeSnippet = '';
  if (provider === 'Gemini') {
    codeSnippet = `import { GoogleGenAI } from '@google/genai';

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
  } else if (provider === 'OpenAI') {
    codeSnippet = `// Call your backend endpoint
const response = await fetch('/api/tts/openai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: ${JSON.stringify(text)},
    voice: '${voice}',
    model: '${openAiModel}',
    speed: ${openAiSpeed},
    apiKey: ${openAiKey ? `'${openAiKey}'` : "'YOUR_API_KEY'"}
  })
});
const data = await response.json();
const audioBase64 = data.audioBase64;`;
  } else if (provider === 'ElevenLabs') {
    codeSnippet = `// Call your backend endpoint
const response = await fetch('/api/tts/elevenlabs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: ${JSON.stringify(text)},
    voice: '${voice}',
    model_id: '${elevenLabsModel}',
    stability: ${elevenLabsStability},
    similarity_boost: ${elevenLabsSimilarity},
    apiKey: ${elevenLabsKey ? `'${elevenLabsKey}'` : "'YOUR_API_KEY'"}
  })
});
const data = await response.json();
const audioBase64 = data.audioBase64;`;
  }

  const cloudTtsJson = JSON.stringify({
    url: "https://europe-west4-texttospeech.googleapis.com/v1/text:synthesize",
    headers: {
      Authorization: "Bearer YOUR_GOOGLE_SERVICE_ACCOUNT_CREDENTIALS",
      "Content-Type": "application/json"
    },
    body: {
      input: { text: finalPrompt },
      voice: {
        languageCode: "en-US",
        name: `en-US-Chirp3-HD-${voice}`
      },
      audioConfig: {
        audioEncoding: "LINEAR16",
        speakingRate: 1.0,
        sampleRateHertz: 48000
      }
    },
    responseSampleRate: 48000,
    jsonAudioFieldPath: "audioContent"
  }, null, 2);

  const [copiedJson, setCopiedJson] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(cloudTtsJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
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
      if (provider === 'Gemini') {
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
      } else if (provider === 'OpenAI') {
        const response = await fetch('/api/tts/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice, model: openAiModel, speed: openAiSpeed, apiKey: openAiKey })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to generate OpenAI speech');
        playAudio(data.audioBase64, data.mimeType);
      } else if (provider === 'ElevenLabs') {
        const response = await fetch('/api/tts/elevenlabs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice, model_id: elevenLabsModel, stability: elevenLabsStability, similarity_boost: elevenLabsSimilarity, apiKey: elevenLabsKey })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to generate ElevenLabs speech');
        playAudio(data.audioBase64, data.mimeType);
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
      if (mimeType.includes('wav') || mimeType.includes('mp3') || mimeType.includes('ogg') || mimeType.includes('mpeg')) {
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
                <h1 className="text-xl font-semibold tracking-tight">Íslenskt Texta-í-Tal</h1>
                <p className="text-zinc-400 text-xs mt-0.5">Keyrt af Gemini 2.5 Flash TTS</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
              title="Stillingar"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          {showSettings && (
            <div className="px-6 py-5 bg-zinc-50 border-b border-zinc-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <Settings className="w-4 h-4" /> Stillingar fyrir fyrirmæli og rödd
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">Þjónustuaðili</label>
                  <select
                    value={provider}
                    onChange={(e) => {
                      const newProvider = e.target.value;
                      setProvider(newProvider);
                      setVoice(VOICES[newProvider][0]);
                    }}
                    className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none bg-white text-sm"
                  >
                    {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700">Rödd <span className="text-zinc-400 font-normal text-xs ml-1">({VOICES[provider].length} í boði)</span></label>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none bg-white text-sm"
                  >
                    {VOICES[provider].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                
                {provider === 'Gemini' && (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-zinc-700">Grunnfyrirmæli</label>
                      <input 
                        type="text" 
                        value={basePrompt} 
                        onChange={(e) => setBasePrompt(e.target.value)}
                        className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none text-sm bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-zinc-700">Tilfinning / Stíll</label>
                      <select
                        value={emotion}
                        onChange={(e) => setEmotion(e.target.value)}
                        className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none bg-white text-sm"
                      >
                        {EMOTIONS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                      </select>
                    </div>
                    {emotion === 'custom' && (
                      <div className="space-y-2 md:col-span-2">
                        <label className="block text-sm font-medium text-zinc-700">Sérsniðin fyrirmæli</label>
                        <input
                          type="text"
                          value={customDirection}
                          onChange={(e) => setCustomDirection(e.target.value)}
                          placeholder="t.d., Talaðu hægt..."
                          className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none text-sm bg-white"
                        />
                      </div>
                    )}
                  </>
                )}

                {provider === 'OpenAI' && (
                  <>
                    <div className="space-y-2 md:col-span-2 pt-2 border-t border-zinc-200">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-zinc-900">OpenAI Stillingar</h4>
                        <button onClick={saveKeys} className="text-xs bg-zinc-200 hover:bg-zinc-300 text-zinc-800 px-2 py-1 rounded">Vista lykla</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-zinc-700">API Lykill (Valfrjálst)</label>
                      <input 
                        type="password" 
                        value={openAiKey} 
                        onChange={(e) => setOpenAiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none text-sm bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-zinc-700">Líkan</label>
                      <select
                        value={openAiModel}
                        onChange={(e) => setOpenAiModel(e.target.value)}
                        className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none bg-white text-sm"
                      >
                        <option value="tts-1">tts-1</option>
                        <option value="tts-1-hd">tts-1-hd</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-medium text-zinc-700">Hraði ({openAiSpeed}x)</label>
                      <input 
                        type="range" min="0.25" max="4.0" step="0.25" 
                        value={openAiSpeed} 
                        onChange={(e) => setOpenAiSpeed(parseFloat(e.target.value))}
                        className="w-full accent-zinc-900"
                      />
                    </div>
                  </>
                )}

                {provider === 'ElevenLabs' && (
                  <>
                    <div className="space-y-2 md:col-span-2 pt-2 border-t border-zinc-200">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-zinc-900">ElevenLabs Stillingar</h4>
                        <button onClick={saveKeys} className="text-xs bg-zinc-200 hover:bg-zinc-300 text-zinc-800 px-2 py-1 rounded">Vista lykla</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-zinc-700">API Lykill (Valfrjálst)</label>
                      <input 
                        type="password" 
                        value={elevenLabsKey} 
                        onChange={(e) => setElevenLabsKey(e.target.value)}
                        placeholder="sk_..."
                        className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none text-sm bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-zinc-700">Líkan</label>
                      <select
                        value={elevenLabsModel}
                        onChange={(e) => setElevenLabsModel(e.target.value)}
                        className="w-full p-2.5 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none bg-white text-sm"
                      >
                        <option value="eleven_turbo_v2_5">Turbo v2.5</option>
                        <option value="eleven_multilingual_v2">Multilingual v2</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-zinc-700">Stöðugleiki ({elevenLabsStability})</label>
                      <input 
                        type="range" min="0" max="1" step="0.05" 
                        value={elevenLabsStability} 
                        onChange={(e) => setElevenLabsStability(parseFloat(e.target.value))}
                        className="w-full accent-zinc-900"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-zinc-700">Líkindauppörvun ({elevenLabsSimilarity})</label>
                      <input 
                        type="range" min="0" max="1" step="0.05" 
                        value={elevenLabsSimilarity} 
                        onChange={(e) => setElevenLabsSimilarity(parseFloat(e.target.value))}
                        className="w-full accent-zinc-900"
                      />
                    </div>
                  </>
                )}
              </div>

              {provider === 'Gemini' && (
                <div className="space-y-2 pt-2">
                  <label className="block text-sm font-medium text-zinc-700">Forskoðun á endanlegum fyrirmælum</label>
                  <div className="p-3 bg-zinc-200/50 rounded-lg text-sm text-zinc-700 font-mono whitespace-pre-wrap border border-zinc-200">
                    {finalPrompt}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label htmlFor="text-input" className="block text-sm font-medium text-zinc-700">
                Texti til að lesa
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
                    Bý til...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Búa til og spila
                  </>
                )}
              </button>
              
              {isPlaying && (
                <button
                  onClick={stopAudio}
                  className="py-3 px-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-medium transition-colors flex items-center justify-center"
                  title="Stöðva hljóð"
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
              <span className="text-sm font-medium">API Kóði</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors bg-zinc-800/50 hover:bg-zinc-800 px-2.5 py-1.5 rounded-md"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Afritað!' : 'Afrita kóða'}
            </button>
          </div>
          <div className="p-4 overflow-x-auto">
            <pre className="text-sm text-zinc-300 font-mono leading-relaxed">
              <code>{codeSnippet}</code>
            </pre>
          </div>
        </div>

        {/* Cloud TTS JSON Viewer Card */}
        {provider === 'Gemini' && (
          <div className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2 text-zinc-400">
                <Code className="w-4 h-4" />
                <span className="text-sm font-medium">Cloud TTS JSON</span>
              </div>
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors bg-zinc-800/50 hover:bg-zinc-800 px-2.5 py-1.5 rounded-md"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedJson ? 'Afritað!' : 'Afrita JSON'}
              </button>
            </div>
            <div className="p-4 overflow-x-auto">
              <pre className="text-sm text-zinc-300 font-mono leading-relaxed">
                <code>{cloudTtsJson}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Documentation / Help Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <Info className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="space-y-3">
              <h3 className="font-medium text-zinc-900">Um þjónustuaðila og raddir</h3>
              <div className="text-sm text-zinc-600 space-y-4">
                <div>
                  <h4 className="font-medium text-zinc-900 mb-1">Gemini 2.5 Flash TTS</h4>
                  <p>
                    Gemini notar <strong>náttúruleg tungumálafyrirmæli</strong> í stað SSML merkja. Forritið setur sjálfkrafa valda tilfinningu/stíl fyrir framan textann. Þú getur notað <strong>Sérsniðið</strong> valmöguleikann til að skrifa ákveðin fyrirmæli (t.d. <em>„Talaðu mjög hægt og skýrt eins og kennari“</em>). Gemini styður nákvæmlega <strong>5 innbyggðar raddir</strong> (Puck, Charon, Kore, Fenrir, Zephyr), sem aðlagast til að hljóma íslenskt út frá fyrirmælunum.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-zinc-900 mb-1">OpenAI og ElevenLabs</h4>
                  <p>
                    Þú getur nú valið <strong>OpenAI</strong> eða <strong>ElevenLabs</strong> fyrir fleiri hágæða raddir. Þessir þjónustuaðilar krefjast þess að API lyklar þeirra séu stilltir í umhverfisbreytum (<code>OPENAI_API_KEY</code> og <code>ELEVENLABS_API_KEY</code>).
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>OpenAI:</strong> Notar <code>tts-1</code> líkanið sem styður mörg tungumál þar á meðal íslensku.</li>
                    <li><strong>ElevenLabs:</strong> Notar <code>eleven_turbo_v2_5</code> fjöltungumálalíkanið fyrir mjög raunverulegt tal.</li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-zinc-100">
                  <h4 className="font-medium text-zinc-900 mb-1">Ábendingar fyrir íslenskan framburð</h4>
                  <p className="mb-2">TTS líkön geta stundum átt í erfiðleikum með íslensk blæbrigði. Hér eru nokkrar bestu venjur til að fá sem eðlilegast hljóð:</p>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Málfræði og fallbeygingar:</strong> TTS vélar treysta mikið á rétta málfræði fyrir réttan tónfall. Gakktu úr skugga um að þú notir rétt föll (t.d. <em>„með skilagjaldi“</em> í stað <em>„með skilagjald“</em>).</li>
                    <li><strong>Tökuorð:</strong> Ensk eða erlend orð gætu verið borin fram með strangri íslenskri hljóðfræði. Ef orð hljómar vitlaust, reyndu að stafa það hljóðfræðilega á íslensku (t.d. skrifaðu <em>„Feisbúkk“</em> í stað <em>„Facebook“</em>).</li>
                    <li><strong>Skammstafanir og tölur:</strong> Ef gervigreindin hikar við skammstafanir eða tölur skaltu skrifa þær að fullu (t.d. skrifaðu <em>„til dæmis“</em> í stað <em>„t.d.“</em> og <em>„fimmtán“</em> í stað <em>„15“</em>).</li>
                    <li><strong>Greinarmerki fyrir takt:</strong> Notaðu kommur, punkta og línubil ríkulega. Þau virka sem beinar vísbendingar fyrir gervigreindina um að gera hlé og draga andann, sem bætir eðlilegan takt talsins til muna.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
