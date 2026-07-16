import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Writes generated proposals to an organized folder on the T9 drive,
// one subfolder per client. On machines without the T9 volume (e.g. the
// live Render deployment) this quietly reports saved:false and the UI
// falls back to browser downloads.
const T9_ROOT = process.env.T9_EXPORT_DIR || "/Volumes/T9/claudefiles/Automation Proposals";
const T9_VOLUME = "/Volumes/T9";

function safeName(s: string, fallback: string): string {
  const clean = s
    .replace(/[/\\:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return clean || fallback;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clientName = typeof body?.clientName === "string" ? body.clientName : "";
    const automationName = typeof body?.automationName === "string" ? body.automationName : "";
    const markdown = typeof body?.markdown === "string" ? body.markdown : "";

    if (!markdown.trim()) {
      return NextResponse.json({ error: "Nothing to save yet." }, { status: 400 });
    }
    if (!fs.existsSync(T9_VOLUME)) {
      return NextResponse.json({
        saved: false,
        reason: "T9 drive not connected on this computer — use Download .md instead.",
      });
    }

    const dir = path.join(T9_ROOT, safeName(clientName, "Unnamed Client"));
    fs.mkdirSync(dir, { recursive: true });

    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    const file = path.join(dir, `${safeName(automationName, "automation")} — Proposal ${date}.md`);
    fs.writeFileSync(file, markdown, "utf8");

    return NextResponse.json({ saved: true, path: file });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Couldn't save the file. Try again." },
      { status: 500 }
    );
  }
}
