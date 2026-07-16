import { NextRequest, NextResponse } from "next/server";
import { callModel } from "@/lib/ai";
import fs from "fs";
import path from "path";

export const maxDuration = 300;

const FORMAT = `== OUTPUT FORMAT — EXACTLY this delimited structure, no JSON, no commentary outside it ==
===INSTRUCTIONS===
(Setup & go-live steps for Keith: how to demo it in simulation mode instantly, then the exact steps to connect real services and hand it to the business.)
===CHECKLIST===
- [ ] (8-14 concrete pre-delivery tests: open the app, click X and confirm Y, edge cases, mobile check…)
===FILE: index.html===
(the complete file content)
===END===
(Repeat ===FILE: name=== … blocks if more than one file is genuinely needed — prefer ONE self-contained file.)`;

const BUILD_SYSTEM = `You are an elite product engineer inside MonetizeMind Automations, building the ACTUAL deliverable Keith Welch (KWelchVisuals LLC) hands to a business that said yes to an automation. Keith is NOT a coder — the build must be finished and ready.

== HARD REQUIREMENTS ==
1. Deliver a COMPLETE, self-contained, production-quality build — prefer ONE single-file HTML web app: all CSS/JS inline, zero external dependencies, works offline by double-clicking the file, mobile-friendly, premium flat design branded tastefully for the target business (its name in the header).
2. The app is the operator console + workflow for the automation (queues, statuses, message previews, logs, settings) — a real tool, not a mockup.
3. SIMULATION MODE built in and ON by default: every external action (SMS, email, review reply, webhook) is simulated realistically in-app with zero keys/accounts, so Keith can demo it to the business instantly. A visible toggle/config panel ("Go Live") holds the placeholders and shows exactly what to paste (Twilio SID, webhook URL, etc.).
4. Persist app data in localStorage so the demo survives refresh.
5. NO flaws you can avoid: valid HTML, no unclosed tags, no undefined functions, every button wired, empty states handled, no console errors. Write it like it ships today.
6. All data shown must be sample/simulated — never fabricate real customer data.

${FORMAT}`;

const REVIEW_SYSTEM = `You are a ruthless QA + senior code reviewer. You receive a build package (instructions, checklist, files) for a business automation web app. Your job: make it flawless.

1. Hunt for EVERY defect: JavaScript errors, undefined/unwired functions or buttons, unclosed/invalid HTML, broken selectors, logic bugs, state not persisting to localStorage, missing simulation-mode behavior, dead ends, unclear setup steps, missing checklist items.
2. FIX everything you find directly in the code and text.
3. Return the ENTIRE corrected package — every file complete, not diffs, not commentary, no "looks good" notes.

${FORMAT}`;

type ParsedBuild = {
  instructions: string;
  checklist: string;
  files: { name: string; content: string }[];
};

function stripFences(s: string): string {
  let t = s.trim();
  t = t.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
  return t.trim();
}

function parsePackage(raw: string): ParsedBuild | null {
  const instructions =
    raw.match(/===INSTRUCTIONS===\s*([\s\S]*?)(?====CHECKLIST===|===FILE)/)?.[1]?.trim() || "";
  const checklist =
    raw.match(/===CHECKLIST===\s*([\s\S]*?)(?====FILE)/)?.[1]?.trim() || "";
  const files: { name: string; content: string }[] = [];
  const re = /===FILE:\s*(.+?)\s*===\s*\n([\s\S]*?)(?=\n===FILE:|\n===END===|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = m[1].trim().replace(/[/\\]/g, "-").slice(0, 80);
    const content = stripFences(m[2]);
    if (name && content.length > 50) files.push({ name, content });
  }
  if (!files.length) return null;
  return { instructions, checklist, files };
}

function looksSound(p: ParsedBuild): boolean {
  const main = p.files[0];
  if (!main) return false;
  const html = p.files.find((f) => f.name.endsWith(".html"));
  if (html) {
    const c = html.content.toLowerCase();
    if (!c.includes("</html>") || !c.includes("<body")) return false;
  }
  return p.files.every((f) => f.content.length > 200) && p.instructions.length > 50;
}

const T9_ROOT =
  process.env.T9_EXPORT_DIR || "/Volumes/T9/claudefiles/Automation Proposals";

function safeName(s: string, fallback: string): string {
  const clean = s
    .replace(/[/\\:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return clean || fallback;
}

function fileToT9(clientName: string, ideaTitle: string, p: ParsedBuild): string | undefined {
  try {
    if (!fs.existsSync("/Volumes/T9")) return undefined;
    const dir = path.join(
      T9_ROOT,
      safeName(clientName, "Unnamed Client"),
      "Builds",
      safeName(ideaTitle, "automation")
    );
    fs.mkdirSync(dir, { recursive: true });
    for (const f of p.files) fs.writeFileSync(path.join(dir, f.name), f.content, "utf8");
    fs.writeFileSync(
      path.join(dir, "BUILD-NOTES.md"),
      `# ${ideaTitle} — Build Notes\n\n## Setup & Go-Live\n\n${p.instructions}\n\n## Pre-Delivery Test Checklist\n\n${p.checklist}\n`,
      "utf8"
    );
    return dir;
  } catch {
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const c = body?.client || {};
    const idea = body?.idea || {};
    const clean = (v: any, n = 700) => (typeof v === "string" ? v.slice(0, n) : "");

    if (!clean(idea.title, 200)) {
      return NextResponse.json({ error: "Pick an automation idea first." }, { status: 400 });
    }

    const user = `Build the full deliverable now.

== THE BUSINESS (brand the app for them) ==
Business: ${clean(c.name, 150) || "(archetype client)"}
Industry: ${clean(c.industry, 120)}
Size: ${clean(c.size, 250)}
Their pains: ${clean(c.problems)}
Goals: ${clean(c.goals)}

== THE AUTOMATION TO BUILD ==
Title: ${clean(idea.title, 200)}
Pain point: ${clean(idea.painPoint)}
How it works: ${clean(idea.description)}
Expected impact: ${clean(idea.impact, 300)}
${clean(idea.prompt, 2500) ? `\nDetailed build intent (from the sales prompt):\n${clean(idea.prompt, 2500)}` : ""}

Return the package in the exact delimited format.`;

    // Pass 1: build it.
    const draftRaw = await callModel(BUILD_SYSTEM, user, 16000);
    const draft = parsePackage(draftRaw);
    if (!draft) throw new Error("The AI returned an unreadable build. Try again.");

    // Pass 2: QA review — find and fix flaws, return the corrected package.
    let final = draft;
    try {
      const reviewUser = `Review and fix this build package for "${clean(idea.title, 200)}" (business: ${clean(c.name, 150)}). Return the entire corrected package.\n\n${draftRaw.slice(0, 60000)}`;
      const fixedRaw = await callModel(REVIEW_SYSTEM, reviewUser, 16000);
      const fixed = parsePackage(fixedRaw);
      if (fixed && looksSound(fixed)) final = fixed;
    } catch {
      // Review pass failed — ship the draft rather than nothing.
    }

    if (!looksSound(final)) {
      throw new Error("The build didn't pass basic soundness checks. Try again.");
    }

    const savedTo = fileToT9(clean(c.name, 150) || "Unnamed Client", clean(idea.title, 200), final);

    return NextResponse.json({
      instructions: final.instructions,
      checklist: final.checklist,
      files: final.files,
      savedTo,
      reviewed: final !== draft,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
