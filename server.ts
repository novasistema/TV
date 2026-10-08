import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// High body limits to allow client-uploaded base64 images for background cutout or AI analysis
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy GoogleGenAI client helper
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString(),
  });
});

// AI Copy Generation for Digital Signage Slides
app.post("/api/gemini/generate-copy", async (req, res) => {
  try {
    const {
      productName,
      category = "Comercio / Tienda",
      rawDetails = "",
      tone = "comercial",
      templateStyle = "modern-retail",
      targetAudience = "Clientes en mostrador",
    } = req.body;

    if (!productName && !rawDetails) {
      return res.status(400).json({
        error: "Debes proporcionar al menos el nombre del producto o detalles para generar el copy.",
      });
    }

    const ai = getGeminiClient();

    const systemInstruction = `Eres un redactor publicitario senior especializado en cartelería digital, pantallas de escaparate y televisores de mostrador (Point of Sale / Digital Signage).
Los clientes en mostrador miran la pantalla entre 3 y 8 segundos, por lo que el mensaje debe ser:
1. Extremadamente legible, conciso y de alto impacto visual.
2. Formato uniforme y profesional adaptado a la plantilla y estilo elegido.
3. Llamativo, apetecible y orientado a la compra por impulso.
4. Idioma: Español natural de España/Latinoamérica comercial.`;

    const prompt = `Genera el copy publicitario perfecto para una diapositiva de TV de mostrador:
- Producto / Servicio: ${productName || "Artículo destacado"}
- Categoría del negocio: ${category}
- Detalles / Promoción: ${rawDetails || "Destacar calidad superior y precio especial"}
- Tono deseado: ${tone} (ej: comercial enérgico, gourmet apetitoso, elegante boutique, urgente oferta flash)
- Estilo de plantilla: ${templateStyle}
- Público objetivo: ${targetAudience}

Devuelve un JSON estrictamente estructurado según el schema especificado con titulares impactantes, badge promocional, puntos clave y llamada a la acción clara.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headline: {
              type: Type.STRING,
              description: "Titular principal llamativo (máx 5-7 palabras).",
            },
            subtitle: {
              type: Type.STRING,
              description: "Subtítulo descriptivo o beneficio irresistible (máx 12-15 palabras).",
            },
            badge: {
              type: Type.STRING,
              description: "Etiqueta superior en mayúsculas (ej: 'OFERTA DEL DÍA', 'TOP VENTAS', 'RECIÉN HECHO', 'NUEVO', '-40% HOY').",
            },
            price: {
              type: Type.STRING,
              description: "Precio actual o promocional formateado (ej: '3,95 €' o '99 €').",
            },
            originalPrice: {
              type: Type.STRING,
              description: "Precio anterior tachado si hay descuento (ej: '5,50 €') o cadena vacía si no aplica.",
            },
            highlights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2 o 3 viñetas breves con los puntos fuertes (ej: '100% natural', 'Garantía 2 años').",
            },
            ctaText: {
              type: Type.STRING,
              description: "Llamada a la acción para pedir en el mostrador (ej: 'Pídelo aquí en caja', 'Pregunta a nuestro equipo').",
            },
            tickerText: {
              type: Type.STRING,
              description: "Frase para la barra deslizante / ticker inferior de la pantalla (ej: '✨ Aprovecha esta oferta sólo hoy hasta agotar existencias · Consulta opciones sin gluten').",
            },
          },
          required: ["headline", "subtitle", "badge", "highlights", "ctaText"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({ success: true, copy: parsed });
  } catch (error: any) {
    console.error("Error in generate-copy:", error);
    return res.status(500).json({
      error: error?.message || "Error al generar copy publicitario con IA",
    });
  }
});

// AI Image Analyzer (recognize product from uploaded image to prefill copy)
app.post("/api/gemini/analyze-image", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Falta la imagen base64." });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, "");
    const ai = getGeminiClient();

    const imagePart = {
      inlineData: {
        mimeType,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: "Analiza este producto para un carrusel de televisión publicitaria. Identifica el nombre del producto, categoría comercial, 3 características atractivas y sugiere un titular de venta y una etiqueta promocional adecuada.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedProductName: { type: Type.STRING },
            category: { type: Type.STRING },
            suggestedHeadline: { type: Type.STRING },
            suggestedBadge: { type: Type.STRING },
            suggestedPricePlaceholder: { type: Type.STRING },
            highlights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            backgroundDescription: {
              type: Type.STRING,
              description: "Breve descripción del fondo para saber si es uniforme o complejo para recortar.",
            },
          },
          required: ["detectedProductName", "suggestedHeadline", "suggestedBadge", "highlights"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({ success: true, analysis: parsed });
  } catch (error: any) {
    console.error("Error in analyze-image:", error);
    return res.status(500).json({
      error: error?.message || "Error al analizar imagen con IA",
    });
  }
});

// Endpoint: Convert WebM Video to Standard Full HD MP4 (H.264 / AAC)
app.post(
  "/api/video/convert-to-mp4",
  express.raw({ type: "*/*", limit: "150mb" }),
  async (req, res) => {
    const rawBuffer = req.body;
    if (!rawBuffer || !(rawBuffer instanceof Buffer) || rawBuffer.length === 0) {
      return res.status(400).json({ error: "No se recibieron datos de video para convertir." });
    }

    const tmpDir = os.tmpdir();
    const id = Date.now() + "_" + Math.random().toString(36).substring(2, 8);
    const inputPath = path.join(tmpDir, `input_${id}.webm`);
    const outputPath = path.join(tmpDir, `output_${id}.mp4`);

    try {
      await fs.promises.writeFile(inputPath, rawBuffer);

      // Transcode WebM to pristine Full HD H.264 MP4 (30fps CFR, CRF 17 High Profile)
      // 100% smooth, razor-sharp images, compatible with 100% of TV USB players
      await new Promise<void>((resolve, reject) => {
        const ff = spawn("ffmpeg", [
          "-y",
          "-i",
          inputPath,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "17",
          "-profile:v",
          "high",
          "-level",
          "4.1",
          "-pix_fmt",
          "yuv420p",
          "-r",
          "30",
          "-vsync",
          "cfr",
          "-c:a",
          "aac",
          "-b:a",
          "192k",
          "-movflags",
          "+faststart",
          outputPath,
        ]);

        let stderr = "";
        ff.stderr.on("data", (d) => {
          stderr += d.toString();
        });

        ff.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg error (código ${code}): ${stderr.slice(-300)}`));
          }
        });

        ff.on("error", (err) => {
          reject(err);
        });
      });

      const mp4Buffer = await fs.promises.readFile(outputPath);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", 'attachment; filename="video_tv.mp4"');
      res.setHeader("Content-Length", mp4Buffer.length);
      return res.send(mp4Buffer);
    } catch (err: any) {
      console.error("FFmpeg conversion error:", err);
      return res.status(500).json({
        error: err.message || "Error al convertir video a MP4 con FFmpeg",
      });
    } finally {
      fs.promises.unlink(inputPath).catch(() => {});
      fs.promises.unlink(outputPath).catch(() => {});
    }
  }
);

// Server boot with Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DisplayTV Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
