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
      const { text, voice } = req.body;
      if (!process.env.OPENAI_API_KEY) {
        return res.status(400).json({ error: "OPENAI_API_KEY is not configured in the environment." });
      }

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: voice.toLowerCase(),
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
      const { text, voice } = req.body;
      if (!process.env.ELEVENLABS_API_KEY) {
        return res.status(400).json({ error: "ELEVENLABS_API_KEY is not configured in the environment." });
      }

      const voiceId = ELEVENLABS_VOICES[voice] || ELEVENLABS_VOICES['Rachel'];

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
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
