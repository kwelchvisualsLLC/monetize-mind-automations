import { NextRequest, NextResponse } from "next/server";
import { callModel, extractJson } from "@/lib/ai";

export const maxDuration = 60;

const SYSTEM = `You are the CLIENT SCOUT inside MonetizeMind Automations, working for Keith Welch of KWelchVisuals LLC.

Keith sells custom business automations to local businesses (school districts, restaurants, gyms, real estate, med spas, wineries, cities, hotels, wedding venues, chambers of commerce). He is NOT a coder — automations are assembled with AI + common tools (email, SMS, forms, spreadsheets, calendars, webhooks, CRMs) and Keith is the orchestrator. He uses Claude to build everything technical.

== YOUR JOB ==
Research and propose ONE high-value client business PROFILE Keith should go sell automations to — like a top consultant scanning a market. Do NOT invent a specific real company name; describe a precise, recognizable business archetype (e.g. "Boutique med spa, 2-6 treatment rooms, 1 front-desk person") that Keith can match to real businesses near him.

Then propose 3-4 HIGH-IMPACT automations that business type needs, each with a FULL copy-paste Claude build prompt.

RULES FOR THE BUSINESS PROFILE:
- Ground it in what these businesses genuinely struggle with day to day (missed calls, no-shows, slow lead follow-up, review management, manual reporting, scheduling chaos, paper processes, compliance).
- "howToFind" must be practical: exact Google Maps / Yelp / Instagram search terms plus the tell-tale signals that a specific business needs automations (no online booking link, slow review replies, "call us" only, etc.).

RULES FOR EACH AUTOMATION IDEA:
- Attacks one named pain point; buildable with AI + common tools; no custom hardware or enterprise IT.
- Quantify impact plainly (hours saved/week, % fewer no-shows, faster response).
- "difficulty" is exactly one of: "Easy", "Medium", "Advanced".
- "pitch": ONE sentence Keith says to the owner to sell it.
- "prompt": a complete, standalone, copy-paste-ready prompt Keith pastes into Claude to BUILD the automation deliverable. It must open with a sharp role line, contain ALL context (assume the AI knows nothing), specify a simple self-contained no-code-for-Keith stack, include client placeholder fields ([CLIENT NAME], [CLIENT PHONE], etc.), demand the full finished deliverable in one shot with verification, and end by telling the AI to make all decisions itself and deliver finished output rather than asking questions. Use \\n for line breaks.

== OUTPUT — STRICT JSON ONLY, no prose before or after ==
{
  "businessName": "Archetype label, e.g. 'Boutique Med Spa (2-6 treatment rooms)'",
  "industry": "one of Keith's niches or the given one",
  "size": "typical size, e.g. '5-10 staff, 1 location, ~400 active clients'",
  "problems": "their core day-to-day pains, 1-2 sentences in plain words",
  "processes": "what they still do by hand today, 1-2 sentences",
  "goals": "what they want, 1 sentence",
  "whyTarget": "2-3 sentences: why this business type is a hot automation prospect right now and can afford it",
  "howToFind": "2-3 sentences: exact search terms + signals to spot ones that need this",
  "summary": "4-6 sentences Keith can read aloud to the owner: what businesses like this struggle with and what automation changes",
  "ideas": [
    { "title": "3-8 words", "painPoint": "1 sentence", "description": "2-3 sentences end to end", "impact": "plain-terms benefit", "difficulty": "Easy | Medium | Advanced", "pitch": "1 sentence", "prompt": "FULL build prompt" }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clean = (v: any, n = 300) =>
      typeof v === "string" ? v.slice(0, n) : "";
    const industry = clean(body?.industry, 120);
    const notes = clean(body?.notes, 400);
    const previous: string[] = Array.isArray(body?.previous)
      ? body.previous.filter((t: any) => typeof t === "string").slice(0, 30)
      : [];

    let user =
      industry && industry !== "Surprise Me"
        ? `Research one high-value ${industry} prospect for Keith now.`
        : "Pick the hottest niche from Keith's list and research one high-value prospect now.";
    if (notes) user += ` Keith's direction: "${notes}".`;
    if (previous.length)
      user += `\n\nBusiness profiles Keith already has (make this one meaningfully different):\n- ${previous.join(
        "\n- "
      )}`;
    user += "\n\nReturn the JSON.";

    const raw = await callModel(SYSTEM, user, 8000);
    const data = extractJson(raw);
    const ideas = Array.isArray(data?.ideas) ? data.ideas : [];
    if (!data?.businessName || !data?.summary || ideas.length < 3) {
      throw new Error("The AI returned an incomplete prospect. Try again.");
    }

    return NextResponse.json({
      businessName: String(data.businessName),
      industry: String(data.industry || industry || ""),
      size: String(data.size || ""),
      problems: String(data.problems || ""),
      processes: String(data.processes || ""),
      goals: String(data.goals || ""),
      whyTarget: String(data.whyTarget || ""),
      howToFind: String(data.howToFind || ""),
      summary: String(data.summary),
      ideas: ideas.slice(0, 4).map((i: any) => ({
        title: String(i?.title || "Untitled automation"),
        painPoint: String(i?.painPoint || ""),
        description: String(i?.description || ""),
        impact: String(i?.impact || ""),
        difficulty: String(i?.difficulty || "Medium"),
        pitch: String(i?.pitch || ""),
        prompt: String(i?.prompt || ""),
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
