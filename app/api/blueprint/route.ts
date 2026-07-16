import { NextRequest, NextResponse } from "next/server";
import { callModel, extractJson } from "@/lib/ai";

export const maxDuration = 60;

const VALID_TYPES = ["action", "ai", "condition", "notify", "wait"];

const SYSTEM = `You are the AUTOMATION ARCHITECT inside MonetizeMind, working for Keith Welch of KWelchVisuals LLC.

Keith sells custom business automations. He is NOT a coder. You turn a chosen automation idea into a clear, editable BLUEPRINT: one trigger, 4-8 steps, one outcome. Keith will show this flow to the client and tweak it, so every step must be plain-English and specific.

STEP RULES:
- "type" is exactly one of: "action" (a system does something), "ai" (an AI model reads/writes/decides), "condition" (a branch/check), "notify" (a person gets alerted), "wait" (a delay or scheduled pause).
- "tool" names a real, common tool category: e.g. "Web Form", "Google Sheets", "Email", "SMS (Twilio)", "AI Model", "Calendar", "CRM", "Webhook / Zapier", "Google Business Profile".
- "detail" says exactly what happens in 1-2 sentences.
- "sample" is a short realistic example of that step's output during a live run (a sample message, a sample row, a sample decision). Used in the app's simulation preview, so make it feel real for THIS business.

== OUTPUT — STRICT JSON ONLY, no prose before or after ==
{
  "name": "Automation name (reuse or sharpen the idea title)",
  "goal": "1 sentence: what this automation achieves for the client.",
  "trigger": { "title": "3-6 word trigger name", "detail": "What kicks the automation off, 1-2 sentences." },
  "steps": [
    { "type": "action|ai|condition|notify|wait", "title": "3-7 words", "detail": "1-2 sentences", "tool": "tool name", "sample": "1-2 line realistic example output" }
  ],
  "outcome": { "title": "3-6 word outcome name", "detail": "The end result the client sees, 1-2 sentences." }
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const c = body?.client || {};
    const idea = body?.idea || {};
    const clean = (v: any, n = 600) =>
      typeof v === "string" ? v.slice(0, n) : "";

    if (!clean(idea.title, 200)) {
      return NextResponse.json(
        { error: "Pick an automation idea first." },
        { status: 400 }
      );
    }

    const user = `Design the blueprint for this automation and return the JSON.

== THE CLIENT ==
Business: ${clean(c.name, 120) || "(not given)"} — ${clean(c.industry, 120) || "(not given)"}
Size: ${clean(c.size, 200) || "(not given)"}
Problems: ${clean(c.problems) || "(not given)"}
Manual processes today: ${clean(c.processes) || "(not given)"}
Goals: ${clean(c.goals) || "(not given)"}

== THE CHOSEN AUTOMATION IDEA ==
Title: ${clean(idea.title, 200)}
Pain point: ${clean(idea.painPoint)}
How it works: ${clean(idea.description)}
Expected impact: ${clean(idea.impact, 300)}`;

    const raw = await callModel(SYSTEM, user, 3500);
    const data = extractJson(raw);
    const steps = Array.isArray(data?.steps) ? data.steps : [];
    if (!data?.trigger || !data?.outcome || steps.length < 3) {
      throw new Error("The AI returned an incomplete blueprint. Try again.");
    }

    return NextResponse.json({
      name: String(data.name || idea.title),
      goal: String(data.goal || ""),
      trigger: {
        title: String(data.trigger?.title || "Trigger"),
        detail: String(data.trigger?.detail || ""),
      },
      steps: steps.slice(0, 10).map((s: any) => ({
        type: VALID_TYPES.includes(String(s?.type)) ? String(s.type) : "action",
        title: String(s?.title || "Step"),
        detail: String(s?.detail || ""),
        tool: String(s?.tool || ""),
        sample: String(s?.sample || ""),
      })),
      outcome: {
        title: String(data.outcome?.title || "Outcome"),
        detail: String(data.outcome?.detail || ""),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
