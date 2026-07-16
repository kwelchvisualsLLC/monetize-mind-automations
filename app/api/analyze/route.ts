import { NextRequest, NextResponse } from "next/server";
import { callModel, extractJson } from "@/lib/ai";

export const maxDuration = 60;

const SYSTEM = `You are the AUTOMATION STRATEGIST inside MonetizeMind, working for Keith Welch of KWelchVisuals LLC.

Keith sells custom business automations to local businesses (school districts, restaurants, gyms, real estate, med spas, wineries, cities, hotels, wedding venues). He is NOT a coder — the automations are assembled with AI + no-code tools and he is the orchestrator.

== YOUR JOB ==
Given a specific client business, act like a top operations consultant:
1. Read the business type and its stated problems, manual processes and goals.
2. Draw on what businesses of this type commonly struggle with (staffing, no-shows, lead follow-up, reviews, scheduling, reporting, communication, compliance, etc.).
3. Propose 3-5 HIGH-IMPACT automation ideas Keith can build and sell to THIS client.

RULES:
- Each idea must attack a real, named pain point of the business.
- Each idea must be buildable with AI + common tools (email, SMS, forms, spreadsheets, calendars, webhooks, CRMs) — no custom hardware, no enterprise IT projects.
- Be specific and concrete. "Automate marketing" is bad. "Auto-reply to every new Google review within 10 minutes in the owner's voice" is good.
- Quantify impact in plain terms (hours saved per week, faster response, more bookings, fewer no-shows).
- difficulty is exactly one of: "Easy", "Medium", "Advanced".

== OUTPUT — STRICT JSON ONLY, no prose before or after ==
{
  "summary": "4-6 sentences: what businesses like this typically struggle with, tied to this client's specific situation. Written so Keith can read it aloud to the client.",
  "ideas": [
    {
      "title": "Short punchy name (3-8 words)",
      "painPoint": "The specific problem it solves, 1 sentence.",
      "description": "2-3 sentences: what the automation does end to end.",
      "impact": "Plain-terms benefit, e.g. 'Saves ~8 hrs/week and cuts no-shows ~30%'.",
      "difficulty": "Easy | Medium | Advanced"
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const c = body?.client || {};
    const clean = (v: any, n = 600) =>
      typeof v === "string" ? v.slice(0, n) : "";

    const name = clean(c.name, 120);
    const industry = clean(c.industry, 120);
    if (!name && !industry) {
      return NextResponse.json(
        { error: "Add the client's name or industry first." },
        { status: 400 }
      );
    }

    const user = `Analyze this client business and return the JSON.

Business name: ${name || "(not given)"}
Industry / type: ${industry || "(not given)"}
Size: ${clean(c.size, 200) || "(not given)"}
Core problems (in their words): ${clean(c.problems) || "(not given)"}
Current manual processes: ${clean(c.processes) || "(not given)"}
Goals: ${clean(c.goals) || "(not given)"}`;

    const raw = await callModel(SYSTEM, user, 3000);
    const data = extractJson(raw);
    const ideas = Array.isArray(data?.ideas) ? data.ideas : [];
    if (!data?.summary || ideas.length < 3) {
      throw new Error("The AI returned an incomplete analysis. Try again.");
    }

    return NextResponse.json({
      summary: String(data.summary),
      ideas: ideas.slice(0, 5).map((i: any) => ({
        title: String(i?.title || "Untitled automation"),
        painPoint: String(i?.painPoint || ""),
        description: String(i?.description || ""),
        impact: String(i?.impact || ""),
        difficulty: String(i?.difficulty || "Medium"),
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
