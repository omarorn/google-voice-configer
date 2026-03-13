import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

const ELEVENLABS_VOICES: Record<string, string> = {
  'Rachel': '21m00Tcm4TlvDq8ikWAM',
  'Drew': '29vD33N1CtxCmqQRPOHJ',
  'Clyde': '2EiwWnXFnvU5JabPnv8n',
  'Fin': 'D38z5RcWu1voky8WS1ja',
  'Sarah': 'EXAVITQu4vr4xnSDxMaL',
  'Antoni': 'ErXwobaYiN019PkySvjV',
  'Charlie': 'IKne3meq5aSn9XLyUdCD',
  'Callum': 'N2lVS1w4EtoT3dr4eOWO',
  'Charlotte': 'XB0fDUnXU5ywgMpo72XZ',
  'Alice': 'Xb7hH8BzWAzGuMacFm1B',
  'Matilda': 'XrExE9yKIg1WjnnRuVNn',
  'Will': 'bIHbv24MWmeRgasZH58o',
  'Freya': 'jsCqWAovK2MacYKomiFT',
  'Jessie': 't0jbNlBVZ17f02VDIeMI',
  'Michael': 'flq6f7yk4E4fJM5XTYuZ',
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.post("/api/tts/openai", async (req, res) => {
    try {
      const { text, voice, model = 'tts-1', speed = 1.0, apiKey } = req.body;
      const keyToUse = apiKey || process.env.OPENAI_API_KEY || process.env.openai_api_key;
      if (!keyToUse) {
        return res.status(400).json({ error: "OpenAI API Key is missing. Provide it in settings or environment." });
      }

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          input: text,
          voice: voice.toLowerCase(),
          speed: Number(speed),
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API Error: ${errText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      res.json({ audioBase64: base64, mimeType: 'audio/mpeg' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tts/elevenlabs", async (req, res) => {
    try {
      const { text, voice, model_id = 'eleven_turbo_v2_5', stability = 0.5, similarity_boost = 0.75, apiKey } = req.body;
      const keyToUse = apiKey || process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABAS_API_KEY;
      if (!keyToUse) {
        return res.status(400).json({ error: "ElevenLabs API Key is missing. Provide it in settings or environment." });
      }

      const voiceId = ELEVENLABS_VOICES[voice] || ELEVENLABS_VOICES['Rachel'];

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': keyToUse,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: model_id,
          voice_settings: {
            stability: Number(stability),
            similarity_boost: Number(similarity_boost),
          }
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs API Error: ${errText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      res.json({ audioBase64: base64, mimeType: 'audio/mpeg' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
