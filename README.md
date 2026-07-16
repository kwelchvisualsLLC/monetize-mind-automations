# MonetizeMind Automations — KWelchVisuals

The **Automations** section of MonetizeMind: define a client business, let AI find its
highest-impact automation opportunities, design the automation visually, simulate it
live for the client, and generate a client-ready business plan / proposal.

**LIVE at https://monetize-mind-automations.onrender.com** (Render free tier — first
load after idle takes ~50s to wake). Local runs additionally file every generated
proposal on the T9 drive under `/Volumes/T9/claudefiles/Automation Proposals/<Client>/`.

## Run it

Double-click **Start-App.command** (installs on first run, then opens
http://localhost:3090 automatically). Or:

```bash
npm install
npm run dev   # port 3090
```

## Workflow

1. **+ New Client Business** — name, industry, size, problems, manual processes, goals.
2. **✨ Run AI Needs Analysis** — the AI reads the business and pitches 3-5 automations.
3. **Build this automation →** — AI drafts a full blueprint (trigger → steps → outcome);
   every field is editable, steps can be reordered, inserted, retyped, deleted.
4. **▶ Simulate** — animated end-to-end run with realistic sample outputs per step.
5. **📄 Business Plan** — generates the proposal (problem, solution, benefits, timeline,
   investment, next step). Copy as Markdown, download .md, or Print / Save as PDF.

Everything persists in the browser via `localStorage` (`mma-data-v1`).

## Stack

Next.js 14 (App Router) · Tailwind · `lib/ai.ts` (Gemini free tier preferred,
Anthropic fallback — keys in `.env.local`). API routes: `/api/analyze`,
`/api/blueprint`, `/api/plan`. Deployable to Render as-is (same shape as MonetizeMind).
