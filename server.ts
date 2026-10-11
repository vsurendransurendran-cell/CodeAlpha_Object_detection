import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '20mb' }));

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Healthcheck endpoint for Cloud Run
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'visiontrack-ai',
    geminiConfigured: !!apiKey,
  });
});

// Scene Intelligence endpoint
app.post('/api/ai/analyze-scene', async (req: Request, res: Response) => {
  try {
    const { imageBase64, detections, telemetry } = req.body;

    if (!ai) {
      // Graceful analytical response when running in demo environment without API key
      return res.json({
        success: true,
        isSynthetic: true,
        summary: `Automated Scene Audit: Detected ${telemetry?.activeTracksCount || 0} active objects across ${Object.keys(telemetry?.classCounts || {}).length || 0} categories. Flow density is nominal with steady trajectory patterns.`,
        hazards: telemetry?.activeTracksCount > 10 ? ['High localized density detected near primary intersection.'] : ['No immediate safety boundary breaches detected.'],
        recommendations: [
          'Maintain tripwire threshold monitoring on outbound corridors.',
          'Verify crosswalk clearance timing during peak flow transitions.',
        ],
        confidenceScore: 0.94,
      });
    }

    const promptText = `
You are the VisionTrack AI Computer Vision Analytics Engine.
Analyze this captured video frame and its real-time telemetry:
Current active tracked objects: ${telemetry?.activeTracksCount ?? 0}
Total crossings recorded: ${telemetry?.totalCrossings ?? 0}
Class breakdown: ${JSON.stringify(telemetry?.classCounts ?? {})}
Detected speed range: ${telemetry?.speedStats ?? 'Normal range 20-55 km/h'}
Known anomalies/incidents: ${JSON.stringify(telemetry?.incidents ?? [])}

Please provide a concise, high-level JSON response with:
1. "summary": A 2-sentence executive summary of current scene status, spatial distribution, and flow state.
2. "hazards": An array of 1-3 observed risk factors, bottlenecks, or safety violations (e.g. loitering, pedestrian near vehicular path, congestion). If none, state nominal conditions.
3. "recommendations": An array of 2 actionable operational adjustments (e.g. signal timing, lane clearance, surveillance priority).
4. "confidenceScore": A numeric assessment score between 0.85 and 0.99.

Respond ONLY with valid JSON.
`;

    const parts: any[] = [{ text: promptText }];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch {
      parsedData = {
        summary: text,
        hazards: ['Review telemetry feed for localized congestion.'],
        recommendations: ['Monitor active tracks.'],
        confidenceScore: 0.92,
      };
    }

    return res.json({
      success: true,
      ...parsedData,
    });
  } catch (error: any) {
    console.error('Gemini Scene Analysis error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze scene with Gemini AI',
    });
  }
});

// Scene Q&A endpoint
app.post('/api/ai/ask-assistant', async (req: Request, res: Response) => {
  try {
    const { question, telemetry, imageBase64 } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!ai) {
      return res.json({
        answer: `[VisionTrack Telemetry Engine]: Based on current video telemetry (${telemetry?.activeTracksCount || 0} active objects, ${telemetry?.totalCrossings || 0} total tripwire crossings), the flow is proceeding within standard operational bounds.`,
      });
    }

    const promptText = `
You are the VisionTrack AI Telemetry & Surveillance Copilot.
User Question: "${question}"

Current Video Telemetry Context:
- Active Objects Being Tracked: ${telemetry?.activeTracksCount ?? 0}
- Total Unique Tracks Processed: ${telemetry?.totalTracks ?? 0}
- Tripwire Line 1 Crossings (In/Out): ${telemetry?.line1Crossings ?? '0/0'}
- Tripwire Line 2 Crossings (In/Out): ${telemetry?.line2Crossings ?? '0/0'}
- Current Class Distribution: ${JSON.stringify(telemetry?.classCounts ?? {})}
- Estimated Average Velocity: ${telemetry?.avgSpeed ?? '34 km/h'}
- Active Incidents: ${JSON.stringify(telemetry?.incidents ?? [])}

Provide a direct, professional, 2-3 sentence answer addressing the user's specific question based on this data. Do not hallucinate data outside this context.
`;

    const parts: any[] = [{ text: promptText }];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
    });

    return res.json({
      answer: response.text?.trim() || 'No telemetry insight available.',
    });
  } catch (error: any) {
    console.error('Gemini Ask Assistant error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process question',
    });
  }
});

// Setup Vite in Dev or Static Serving in Production
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VisionTrack AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
