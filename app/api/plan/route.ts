import { NextRequest, NextResponse } from "next/server";
import { callModel } from "@/lib/ai";

export const maxDuration = 60;

const SYSTEM = `You are the PROPOSAL WRITER inside MonetizeMind, working for Keith Welch of KWelchVisuals LLC (kwelchvisuals@gmail.com).

You write the client-facing business plan / proposal for ONE custom automation Keith has designed. Keith presents this document directly to the client, so it must be polished, confident and jargon-free — a business owner should understand every line.

== OUTPUT — CLEAN MARKDOWN ONLY (no code fences, no JSON, no preamble) ==
Use exactly this structure:

# <Automation Name>
### Custom Automation Proposal — Prepared by KWelchVisuals LLC for <Client Name>

## The Problem
(3-5 sentences grounded in THIS client's stated pains and manual processes. Make the cost of doing nothing tangible.)

## The Solution
(Explain the automation in plain English. Then a numbered walkthrough of the flow: the trigger, each step, the outcome — one line each.)

## What You Gain
(A markdown bullet list of 4-6 concrete benefits: time saved, cost reduction, revenue lift, accuracy/consistency, customer experience. Use the realistic numbers implied by the blueprint.)

## Implementation Timeline
(A short markdown table: Phase | What Happens | Duration. 3-4 phases, realistic total of 1-4 weeks: discovery/setup, build & connect, test with real data, go live + training.)

## Investment
(One short paragraph. Pricing line: "Custom Quote — tailored to your tools and volume" unless a price was provided. Mention it includes setup, testing, training and 30 days of post-launch support.)

## Next Step
(2-3 sentence call to action: a 20-minute kickoff call with Keith Welch, and that the automation can be live within the timeline above. Contact: kwelchvisuals@gmail.com.)

Tone: premium, direct, zero fluff. Never invent facts about the client beyond what is given — extrapolate sensibly from their industry instead.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const c = body?.client || {};
    const a = body?.automation || {};
    const clean = (v: any, n = 700) =>
      typeof v === "string" ? v.slice(0, n) : "";

    if (!clean(a.name, 200)) {
      return NextResponse.json(
        { error: "Build the automation first, then generate its plan." },
        { status: 400 }
      );
    }

    const steps = Array.isArray(a.steps) ? a.steps.slice(0, 12) : [];
    const stepLines = steps
      .map(
        (s: any, i: number) =>
          `${i + 1}. [${clean(s?.type, 20)}] ${clean(s?.title, 120)} — ${clean(
            s?.detail,
            300
          )} (tool: ${clean(s?.tool, 60)})`
      )
      .join("\n");

    const user = `Write the proposal now.

== THE CLIENT ==
Business: ${clean(c.name, 120) || "(not given)"}
Industry: ${clean(c.industry, 120) || "(not given)"}
Size: ${clean(c.size, 200) || "(not given)"}
Stated problems: ${clean(c.problems) || "(not given)"}
Manual processes today: ${clean(c.processes) || "(not given)"}
Goals: ${clean(c.goals) || "(not given)"}

== THE AUTOMATION BLUEPRINT ==
Name: ${clean(a.name, 200)}
Goal: ${clean(a.goal, 400)}
Trigger: ${clean(a.trigger?.title, 120)} — ${clean(a.trigger?.detail, 300)}
Steps:
${stepLines || "(no steps)"}
Outcome: ${clean(a.outcome?.title, 120)} — ${clean(a.outcome?.detail, 300)}`;

    const markdown = (await callModel(SYSTEM, user, 4000)).trim();
    if (!markdown || markdown.length < 200) {
      throw new Error("The AI returned an incomplete plan. Try again.");
    }
    return NextResponse.json({ markdown });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
