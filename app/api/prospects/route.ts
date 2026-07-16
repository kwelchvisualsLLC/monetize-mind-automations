import { NextRequest, NextResponse } from "next/server";
import { callModel, extractJson } from "@/lib/ai";

export const maxDuration = 60;

const SYSTEM = `You are the LEAD SCOUT inside MonetizeMind Automations, working for Keith Welch of KWelchVisuals LLC.

Keith sells custom business automations. Given an industry (and optionally a location or direction), list TEN REAL businesses in that field he could pitch.

HARD RULES:
- Only name businesses you are CONFIDENT actually exist: national/regional chains, franchises, and well-known prominent businesses (e.g. "Red Robin", "Crunch Fitness", "Kendall-Jackson"). If a location is given, prefer real businesses known to operate there; otherwise mix well-known national and regional names.
- NEVER invent a business name. Ten confident real names beats a padded list.
- Mix sizes: a couple of big chains (their individual locations buy local services too), several mid-size regional players, and known independents where you're sure they exist.
- "signals": what businesses like this observably struggle with that automation fixes — phrased about THIS business (reservations chaos, slow review replies, loyalty program friction, franchise-location reporting…).
- "hook": ONE opener sentence Keith could use with that business.

== OUTPUT — STRICT JSON ONLY, no prose before or after ==
{
  "leads": [
    {
      "name": "Real business name",
      "descriptor": "what/where it is, one line (e.g. 'Casual gourmet-burger chain, 500+ US locations')",
      "signals": "1-2 sentences: the automation-shaped pain this business visibly has",
      "hook": "1 sentence opener"
    }
  ]
}
Exactly 10 leads (or as many real ones as you are confident of, minimum 6).`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clean = (v: any, n = 300) =>
      typeof v === "string" ? v.slice(0, n) : "";
    const industry = clean(body?.industry, 120);
    const notes = clean(body?.notes, 400);
    const previous: string[] = Array.isArray(body?.previous)
      ? body.previous.filter((t: any) => typeof t === "string").slice(0, 40)
      : [];

    let user =
      industry && industry !== "Surprise Me"
        ? `List 10 real ${industry} businesses Keith can pitch automations to.`
        : "Pick the hottest niche from Keith's list and give 10 real businesses in it.";
    if (notes) user += ` Keith's direction: "${notes}".`;
    if (previous.length)
      user += `\n\nSkip these (already in Keith's pipeline):\n- ${previous.join("\n- ")}`;
    user += "\n\nReturn the JSON.";

    const raw = await callModel(SYSTEM, user, 4000);
    const data = extractJson(raw);
    const leads = Array.isArray(data?.leads) ? data.leads : [];
    if (leads.length < 3) {
      throw new Error("The AI couldn't produce a solid lead list. Try again.");
    }

    return NextResponse.json({
      leads: leads.slice(0, 10).map((l: any) => ({
        name: String(l?.name || "").slice(0, 120),
        descriptor: String(l?.descriptor || ""),
        signals: String(l?.signals || ""),
        hook: String(l?.hook || ""),
      })).filter((l: any) => l.name),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
