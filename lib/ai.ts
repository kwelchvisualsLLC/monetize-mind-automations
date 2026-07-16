// ─────────────────────────────────────────────
// AI PROVIDER ROUTER (shared by all API routes)
// Prefers FREE Google Gemini; falls back to Anthropic.
// ─────────────────────────────────────────────
import Anthropic from "@anthropic-ai/sdk";

export type ImagePart = { mimeType: string; dataBase64: string };

export async function callModel(
  system: string,
  user: string,
  maxTokens: number,
  images?: ImagePart[]
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (geminiKey) return callGemini(system, user, maxTokens, geminiKey, images);
  if (anthropicKey)
    return callClaude(system, user, maxTokens, anthropicKey, images);

  throw new Error(
    "No AI key set. Add a FREE Google Gemini key as GEMINI_API_KEY in .env.local " +
      "(get one free, no card, at aistudio.google.com/apikey) — or an ANTHROPIC_API_KEY."
  );
}

// FREE — Google Gemini (multimodal, free tier)
async function callGemini(
  system: string,
  user: string,
  maxTokens: number,
  apiKey: string,
  images?: ImagePart[]
) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const parts: any[] = [{ text: user }];
  if (images?.length) {
    for (const img of images) {
      parts.push({
        inline_data: { mime_type: img.mimeType, data: img.dataBase64 },
      });
    }
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.9,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  // Retry transient overload / rate-limit errors with backoff.
  const RETRY = [800, 2000, 4500];
  let lastErr = "";
  for (let attempt = 0; attempt <= RETRY.length; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    if (res.ok) {
      const d = await res.json();
      const text =
        d?.candidates?.[0]?.content?.parts
          ?.map((p: any) => p.text || "")
          .join("") || "";
      if (!text) throw new Error("Gemini returned an empty response. Try again.");
      return text;
    }
    const t = await res.text().catch(() => "");
    lastErr = `Gemini ${res.status}: ${t.slice(0, 300)}`;
    const transient = res.status === 503 || res.status === 429 || res.status === 500;
    if (!transient || attempt === RETRY.length) throw new Error(lastErr);
    await new Promise((r) => setTimeout(r, RETRY[attempt]));
  }
  throw new Error(lastErr);
}

// PAID — Anthropic (fallback only)
async function callClaude(
  system: string,
  user: string,
  maxTokens: number,
  apiKey: string,
  images?: ImagePart[]
) {
  const client = new Anthropic({ apiKey });
  const content: any[] = [{ type: "text", text: user }];
  if (images?.length) {
    for (const img of images) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mimeType,
          data: img.dataBase64,
        },
      });
    }
  }
  const msg = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content }],
  });
  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");
}

// Pull the first JSON object/array out of a model response.
export function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const objStart = candidate.indexOf("{");
  const arrStart = candidate.indexOf("[");
  let start = -1;
  if (objStart === -1) start = arrStart;
  else if (arrStart === -1) start = objStart;
  else start = Math.min(objStart, arrStart);
  if (start === -1) throw new Error("No JSON found in response");
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(close);
  if (end === -1) throw new Error("Malformed JSON in response");
  return JSON.parse(candidate.slice(start, end + 1));
}
