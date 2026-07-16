"use client";

import { useEffect, useRef, useState } from "react";
import {
  Analysis,
  Automation,
  AutomationIdea,
  BizLead,
  Client,
  INDUSTRIES,
  Prospect,
  STEP_TYPES,
  Step,
  StepType,
  uid,
} from "@/lib/types";

const STORE_KEY = "mma-data-v1";

// ── View routing ──────────────────────────────
type View =
  | { screen: "home" }
  | { screen: "client"; clientId: string }
  | { screen: "auto"; clientId: string; autoId: string; tab: AutoTab };
type AutoTab = "build" | "simulate" | "plan";

// ── Helpers ───────────────────────────────────
async function post<T = any>(url: string, body: any): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the app server. Is it still running?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

function stepMeta(type: StepType) {
  return STEP_TYPES.find((t) => t.value === type) || STEP_TYPES[0];
}

function blankStep(): Step {
  return { id: uid(), type: "action", title: "", detail: "", tool: "", sample: "" };
}

function blankAutomation(name = "New Automation"): Automation {
  const now = Date.now();
  return {
    id: uid(),
    name,
    goal: "",
    trigger: { title: "", detail: "" },
    steps: [blankStep()],
    outcome: { title: "", detail: "" },
    createdAt: now,
    updatedAt: now,
  };
}

// ── Tiny markdown renderer (headings, bold, lists, tables, hr) ──
function inlineMd(text: string, key: number) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <span key={key}>
      {parts.map((p, i) =>
        i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>
      )}
    </span>
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: JSX.Element[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      i++;
      continue;
    }
    if (t.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      out.push(
        <div key={k++} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri === 0 ? "bg-kwgold/10" : ""}>
                  {r.map((c, ci) => (
                    <td
                      key={ci}
                      className={`border border-kwgold/20 px-3 py-2 ${
                        ri === 0 ? "font-bold text-kwgold" : ""
                      }`}
                    >
                      {inlineMd(c, ci)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^[-*] /.test(t) || /^\d+\. /.test(t)) {
      const ordered = /^\d+\. /.test(t);
      const items: string[] = [];
      while (
        i < lines.length &&
        (/^[-*] /.test(lines[i].trim()) || /^\d+\. /.test(lines[i].trim()))
      ) {
        items.push(lines[i].trim().replace(/^([-*]|\d+\.) /, ""));
        i++;
      }
      const cls = "my-3 space-y-1.5 pl-6 text-sm leading-relaxed";
      out.push(
        ordered ? (
          <ol key={k++} className={`${cls} list-decimal marker:text-kwgold`}>
            {items.map((it, ii) => (
              <li key={ii}>{inlineMd(it, ii)}</li>
            ))}
          </ol>
        ) : (
          <ul key={k++} className={`${cls} list-disc marker:text-kwgold`}>
            {items.map((it, ii) => (
              <li key={ii}>{inlineMd(it, ii)}</li>
            ))}
          </ul>
        )
      );
      continue;
    }
    if (t.startsWith("### "))
      out.push(
        <h3 key={k++} className="mt-1 text-sm font-semibold uppercase tracking-widest text-kwgold/80">
          {inlineMd(t.slice(4), 0)}
        </h3>
      );
    else if (t.startsWith("## "))
      out.push(
        <h2 key={k++} className="mt-7 border-b border-kwgold/25 pb-1.5 text-lg font-bold text-kwgold">
          {inlineMd(t.slice(3), 0)}
        </h2>
      );
    else if (t.startsWith("# "))
      out.push(
        <h1 key={k++} className="text-2xl font-extrabold tracking-tight">
          {inlineMd(t.slice(2), 0)}
        </h1>
      );
    else if (/^(-{3,}|\*{3,})$/.test(t))
      out.push(<hr key={k++} className="my-5 border-kwgold/20" />);
    else
      out.push(
        <p key={k++} className="my-3 text-sm leading-relaxed">
          {inlineMd(t, 0)}
        </p>
      );
    i++;
  }
  return <div>{out}</div>;
}

// ── Small shared pieces ───────────────────────
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        copied
          ? "border-kwgold bg-kwgold text-kwblack"
          : "border-kwgold/40 text-kwgold hover:border-kwgold hover:bg-kwgold/10"
      }`}
    >
      {copied ? "Copied ✓" : label || "Copy"}
    </button>
  );
}

function GoldButton({
  children,
  onClick,
  disabled,
  ghost,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  ghost?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        small ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm"
      } ${
        ghost
          ? "border border-kwgold/40 text-kwgold hover:border-kwgold hover:bg-kwgold/10"
          : "bg-kwgold text-kwblack hover:bg-kwgoldlight"
      }`}
    >
      {children}
    </button>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-kwgold">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-kwgold/30 border-t-kwgold" />
      {label}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  area,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  area?: boolean;
}) {
  const cls =
    "w-full rounded-xl border border-kwgold/20 bg-black/40 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-white/25 focus:border-kwgold/70";
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-kwgold/70">
        {label}
      </span>
      {area ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${cls} resize-y`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}

function PromptBlock({ prompt, title }: { prompt: string; title?: string }) {
  const [open, setOpen] = useState(false);
  if (!prompt) return null;
  return (
    <div className="mt-3 rounded-xl border border-kwgold/20 bg-black/50">
      <div className="flex items-center justify-between gap-2 border-b border-kwgold/15 px-4 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-left text-[11px] font-bold uppercase tracking-widest text-kwgold"
        >
          {open ? "▾" : "▸"} {title || "Copy-paste Claude build prompt"}
        </button>
        <CopyButton text={prompt} label="Copy prompt" />
      </div>
      {open && (
        <pre className="gold-scroll max-h-72 overflow-y-auto whitespace-pre-wrap px-4 py-3 font-sans text-xs leading-relaxed text-white/70">
          {prompt}
        </pre>
      )}
    </div>
  );
}

function DiffBadge({ d }: { d: string }) {
  const color =
    d === "Easy"
      ? "border-emerald-400/40 text-emerald-300"
      : d === "Advanced"
      ? "border-rose-400/40 text-rose-300"
      : "border-kwgold/40 text-kwgold";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${color}`}>
      {d}
    </span>
  );
}

// ── Main app ──────────────────────────────────
export default function Page() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>({ screen: "home" });
  const [error, setError] = useState("");

  // Load once, save on every change after load.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d?.clients)) setClients(d.clients);
      }
    } catch {
      setError("Saved data could not be read — starting fresh (nothing was deleted).");
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ clients }));
    } catch {
      setError("Couldn't save — browser storage may be full.");
    }
  }, [clients, loaded]);

  const updateClient = (id: string, fn: (c: Client) => Client) =>
    setClients((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  const updateAuto = (clientId: string, autoId: string, fn: (a: Automation) => Automation) =>
    updateClient(clientId, (c) => ({
      ...c,
      automations: c.automations.map((a) =>
        a.id === autoId ? { ...fn(a), updatedAt: Date.now() } : a
      ),
    }));

  const client =
    view.screen !== "home" ? clients.find((c) => c.id === view.clientId) : undefined;
  const auto =
    view.screen === "auto" && client
      ? client.automations.find((a) => a.id === view.autoId)
      : undefined;

  // Keep the printable plan available to the print stylesheet.
  const printPlan = auto?.plan?.markdown;

  // Wait for localStorage before first paint so screens see the real data.
  if (!loaded) return null;

  return (
    <>
      <div className="no-print mx-auto min-h-screen max-w-5xl px-4 pb-24 pt-6 sm:px-6">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setView({ screen: "home" })}
            className="text-left"
            title="Back to all clients"
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-kwgold">
              MonetizeMind
            </div>
            <div className="text-2xl font-extrabold tracking-tight">
              Automations<span className="text-kwgold">.</span>
            </div>
          </button>
          <div className="text-right text-[11px] uppercase tracking-widest text-white/40">
            Build it. Show it. Sell it.
            <div className="text-kwgold/60">KWelchVisuals LLC</div>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-400/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            <span>⚠️ {error}</span>
            <button onClick={() => setError("")} className="font-bold text-rose-300">
              ✕
            </button>
          </div>
        )}

        {view.screen === "home" && (
          <HomeScreen
            clients={clients}
            onAdd={(c) => {
              setClients((cs) => [c, ...cs]);
              setView({ screen: "client", clientId: c.id });
            }}
            onOpen={(id) => setView({ screen: "client", clientId: id })}
            onDelete={(id) => {
              const c = clients.find((x) => x.id === id);
              if (
                confirm(
                  `Delete "${c?.name}" and its ${c?.automations.length || 0} automation(s)? This can't be undone.`
                )
              )
                setClients((cs) => cs.filter((x) => x.id !== id));
            }}
          />
        )}

        {view.screen === "client" && client && (
          <ClientScreen
            client={client}
            setError={setError}
            update={(fn) => updateClient(client.id, fn)}
            openAuto={(autoId) =>
              setView({ screen: "auto", clientId: client.id, autoId, tab: "build" })
            }
            back={() => setView({ screen: "home" })}
          />
        )}

        {view.screen === "auto" && client && auto && (
          <AutoScreen
            client={client}
            auto={auto}
            tab={view.tab}
            setTab={(tab) => setView({ ...view, tab })}
            setError={setError}
            update={(fn) => updateAuto(client.id, auto.id, fn)}
            back={() => setView({ screen: "client", clientId: client.id })}
          />
        )}

        {view.screen !== "home" && !client && (
          <div className="py-20 text-center text-white/50">
            That client no longer exists.{" "}
            <button className="text-kwgold underline" onClick={() => setView({ screen: "home" })}>
              Back to all clients
            </button>
          </div>
        )}
      </div>

      {/* Print-only proposal */}
      {printPlan && (
        <div className="print-area hidden px-8 py-6">
          <Markdown text={printPlan} />
        </div>
      )}
    </>
  );
}

// ── AI Client Finder ──────────────────────────
const FINDER_INDUSTRIES = ["Surprise Me", ...INDUSTRIES.filter((i) => i !== "Other")];

function ClientFinder({
  clients,
  onAdd,
}: {
  clients: Client[];
  onAdd: (c: Client) => void;
}) {
  const [industry, setIndustry] = useState("Surprise Me");
  const [notes, setNotes] = useState("");
  const [leads, setLeads] = useState<BizLead[] | null>(null);
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [busy, setBusy] = useState(false);
  const [digging, setDigging] = useState(""); // lead name being researched
  const [err, setErr] = useState("");

  const research = async () => {
    setErr("");
    setBusy(true);
    setProspect(null);
    setLeads(null);
    try {
      const d = await post<{ leads: BizLead[] }>("/api/prospects", {
        industry,
        notes,
        previous: clients.map((c) => `${c.name} (${c.industry})`),
      });
      setLeads(d.leads);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deepDive = async (lead: BizLead) => {
    setErr("");
    setDigging(lead.name);
    try {
      const p = await post<Prospect>("/api/discover", {
        industry,
        notes,
        business: lead,
      });
      setProspect(p);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setDigging("");
    }
  };

  const addProspect = () => {
    if (!prospect) return;
    const p = prospect;
    setProspect(null); // back to the lead list next time home is shown
    onAdd({
      id: uid(),
      name: p.businessName,
      industry: p.industry,
      size: p.size,
      problems: p.problems,
      processes: p.processes,
      goals: p.goals,
      createdAt: Date.now(),
      analysis: {
        summary: p.summary,
        ideas: p.ideas.map((i) => ({ ...i, id: uid() })),
        generatedAt: Date.now(),
      },
      automations: [],
    });
  };

  return (
    <div className="mb-8 rounded-2xl border border-kwgold/40 bg-kwcard p-5">
      <div className="text-sm font-bold uppercase tracking-widest text-kwgold">
        🔎 AI Client Finder
      </div>
      <div className="mt-1 text-sm text-white/50">
        Pick a field and the AI finds 10 real businesses in it. Tap one and it researches that
        exact business — what it needs, the pitch, and build prompts written specifically for it.
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FINDER_INDUSTRIES.map((i) => (
          <button
            key={i}
            onClick={() => setIndustry(i)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
              industry === i
                ? "border-kwgold bg-kwgold text-kwblack"
                : "border-kwgold/25 text-kwgold/80 hover:border-kwgold/60"
            }`}
          >
            {i}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional direction, e.g. 'near Sacramento' or 'ones that still use paper'"
          className="min-w-60 flex-1 rounded-xl border border-kwgold/20 bg-black/40 px-3.5 py-2.5 text-sm outline-none placeholder:text-white/25 focus:border-kwgold/70"
        />
        {busy ? (
          <Spinner label="Finding 10 real businesses…" />
        ) : (
          <GoldButton onClick={research}>
            {leads || prospect ? "↻ Find 10 more" : "🔎 Find 10 businesses"}
          </GoldButton>
        )}
      </div>

      {err && <div className="mt-3 text-sm text-rose-300">⚠️ {err}</div>}

      {/* Stage 1: the 10 leads */}
      {leads && !prospect && !busy && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-widest text-kwgold/70">
              {leads.length} businesses found — tap one for its targeted automation plan
            </div>
            <div className="text-[10px] text-white/30">
              AI-suggested — confirm the business/location before pitching
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {leads.map((l, n) => (
              <button
                key={l.name + n}
                onClick={() => deepDive(l)}
                disabled={!!digging}
                className={`rounded-2xl border p-4 text-left transition disabled:opacity-40 ${
                  digging === l.name
                    ? "border-kwgold bg-kwgold/10"
                    : "border-kwgold/15 bg-black/30 hover:border-kwgold/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold">
                    <span className="mr-2 text-kwgold">{n + 1}.</span>
                    {l.name}
                  </div>
                  {digging === l.name ? (
                    <Spinner label="" />
                  ) : (
                    <span className="text-kwgold">→</span>
                  )}
                </div>
                <div className="mt-0.5 text-xs uppercase tracking-wider text-kwgold/60">
                  {l.descriptor}
                </div>
                <div className="mt-2 text-xs text-white/55">{l.signals}</div>
              </button>
            ))}
          </div>
          {digging && (
            <div className="mt-3 text-center text-sm text-kwgold">
              Researching {digging} — what they need, the pitch &amp; business-specific build
              prompts…
            </div>
          )}
        </div>
      )}

      {prospect && !busy && (
        <div className="mt-4">
          <button
            onClick={() => setProspect(null)}
            className="text-xs font-bold uppercase tracking-widest text-kwgold/70 hover:text-kwgold"
          >
            ← Back to the {leads?.length || 10} businesses
          </button>
        </div>
      )}

      {prospect && !busy && (
        <div className="mt-5 rounded-2xl border border-kwgold/25 bg-black/30 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-extrabold">{prospect.businessName}</div>
              <div className="mt-0.5 text-xs uppercase tracking-widest text-kwgold/70">
                {prospect.industry}
                {prospect.size ? ` · ${prospect.size}` : ""}
              </div>
            </div>
            <GoldButton onClick={addProspect}>➕ Add to my clients →</GoldButton>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-kwgold/10 p-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-kwgold">
                Why this business
              </div>
              <div className="text-white/75">{prospect.whyTarget}</div>
            </div>
            <div className="rounded-xl bg-kwgold/10 p-3">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-kwgold">
                How to get in
              </div>
              <div className="text-white/75">{prospect.howToFind}</div>
            </div>
          </div>

          <div className="mt-3 text-sm text-white/60">
            <span className="font-bold text-kwgold/80">Their pains: </span>
            {prospect.problems}
          </div>

          <div className="mt-3 text-xs font-bold uppercase tracking-widest text-kwgold/60">
            {prospect.ideas.length} automations they need (full build prompts included)
          </div>
          <ul className="mt-2 space-y-1.5 text-sm text-white/75">
            {prospect.ideas.map((i, n) => (
              <li key={n} className="flex items-center gap-2">
                <span className="text-kwgold">{n + 1}.</span> {i.title}
                <DiffBadge d={i.difficulty} />
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs text-white/35">
            Add it to your clients to see the full analysis, pitches and prompts — then build,
            simulate and generate the proposal.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Home: client list + new client ────────────
function HomeScreen({
  clients,
  onAdd,
  onOpen,
  onDelete,
}: {
  clients: Client[];
  onAdd: (c: Client) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [customIndustry, setCustomIndustry] = useState("");
  const [size, setSize] = useState("");
  const [problems, setProblems] = useState("");
  const [processes, setProcesses] = useState("");
  const [goals, setGoals] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      id: uid(),
      name: name.trim(),
      industry: industry === "Other" ? customIndustry.trim() || "Other" : industry,
      size: size.trim(),
      problems: problems.trim(),
      processes: processes.trim(),
      goals: goals.trim(),
      createdAt: Date.now(),
      automations: [],
    });
  };

  return (
    <div>
      <ClientFinder clients={clients} onAdd={onAdd} />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-bold">
          Client Businesses{" "}
          <span className="text-sm font-normal text-white/40">({clients.length})</span>
        </h1>
        <GoldButton ghost small onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Close" : "+ Add one manually"}
        </GoldButton>
      </div>

      {showForm && (
        <div className="mb-8 rounded-2xl border border-kwgold/25 bg-kwcard p-5">
          <div className="mb-4 text-sm font-bold uppercase tracking-widest text-kwgold">
            Define the client business
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name *" value={name} onChange={setName} placeholder="e.g. Vista Unified School District" />
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-kwgold/70">
                Industry
              </span>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-xl border border-kwgold/20 bg-black/40 px-3.5 py-2.5 text-sm outline-none focus:border-kwgold/70"
              >
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i} className="bg-kwblack">
                    {i}
                  </option>
                ))}
              </select>
            </label>
            {industry === "Other" && (
              <Field label="Custom industry" value={customIndustry} onChange={setCustomIndustry} placeholder="e.g. Dental Office" />
            )}
            <Field label="Size" value={size} onChange={setSize} placeholder="e.g. 12 staff, 2 locations, ~900 members" />
          </div>
          <div className="mt-4 grid gap-4">
            <Field area label="Core problems" value={problems} onChange={setProblems} placeholder="What's hurting them? Missed calls, no-shows, slow follow-up, drowning in paperwork…" />
            <Field area label="Current manual processes" value={processes} onChange={setProcesses} placeholder="What do they do by hand today? Typing bookings into a spreadsheet, replying to every review one by one…" />
            <Field area label="Goals" value={goals} onChange={setGoals} placeholder="What do they want? More bookings, faster response times, weekend hours covered…" />
          </div>
          <div className="mt-5 flex items-center gap-3">
            <GoldButton onClick={submit} disabled={!name.trim()}>
              Save Client →
            </GoldButton>
            {!name.trim() && (
              <span className="text-xs text-white/35">Business name is required.</span>
            )}
          </div>
        </div>
      )}

      {clients.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-kwgold/25 py-16 text-center text-white/40">
          No clients yet. Hit “🔎 Find 10 businesses” above and let the AI find your first one.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {clients.map((c) => (
            <div
              key={c.id}
              className="group cursor-pointer rounded-2xl border border-kwgold/15 bg-kwcard p-5 transition hover:border-kwgold/50"
              onClick={() => onOpen(c.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold">{c.name}</div>
                  <div className="mt-0.5 text-xs uppercase tracking-widest text-kwgold/70">
                    {c.industry}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                  className="rounded-lg px-2 py-1 text-xs text-white/25 opacity-0 transition hover:bg-rose-950/50 hover:text-rose-300 group-hover:opacity-100"
                  title="Delete client"
                >
                  Delete
                </button>
              </div>
              <div className="mt-3 line-clamp-2 text-xs text-white/45">
                {c.problems || c.goals || "No details yet."}
              </div>
              <div className="mt-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider">
                <span className={c.analysis ? "text-emerald-300" : "text-white/30"}>
                  {c.analysis ? "✓ Analyzed" : "Not analyzed"}
                </span>
                <span className="text-kwgold">
                  {c.automations.length} automation{c.automations.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Client detail: profile + analysis + automations ──
function ClientScreen({
  client,
  update,
  openAuto,
  back,
  setError,
}: {
  client: Client;
  update: (fn: (c: Client) => Client) => void;
  openAuto: (autoId: string) => void;
  back: () => void;
  setError: (e: string) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [buildingIdea, setBuildingIdea] = useState("");
  const [editProfile, setEditProfile] = useState(false);

  const runAnalysis = async () => {
    setError("");
    setAnalyzing(true);
    try {
      const data = await post<{ summary: string; ideas: any[] }>("/api/analyze", {
        client,
      });
      const analysis: Analysis = {
        summary: data.summary,
        ideas: data.ideas.map((i) => ({ ...i, id: uid() })),
        generatedAt: Date.now(),
      };
      update((c) => ({ ...c, analysis }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const buildFromIdea = async (idea: AutomationIdea) => {
    setError("");
    setBuildingIdea(idea.id);
    try {
      const bp = await post<any>("/api/blueprint", { client, idea });
      const now = Date.now();
      const a: Automation = {
        id: uid(),
        name: bp.name,
        goal: bp.goal,
        trigger: bp.trigger,
        steps: bp.steps.map((s: any) => ({ ...s, id: uid() })),
        outcome: bp.outcome,
        createdAt: now,
        updatedAt: now,
      };
      update((c) => ({ ...c, automations: [a, ...c.automations] }));
      openAuto(a.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBuildingIdea("");
    }
  };

  const addBlank = () => {
    const a = blankAutomation();
    update((c) => ({ ...c, automations: [a, ...c.automations] }));
    openAuto(a.id);
  };

  const set = (patch: Partial<Client>) => update((c) => ({ ...c, ...patch }));

  return (
    <div>
      <button onClick={back} className="mb-4 text-xs font-bold uppercase tracking-widest text-kwgold/70 hover:text-kwgold">
        ← All clients
      </button>

      {/* Profile */}
      <div className="rounded-2xl border border-kwgold/25 bg-kwcard p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold">{client.name}</h1>
            <div className="mt-0.5 text-xs uppercase tracking-widest text-kwgold/70">
              {client.industry}
              {client.size ? ` · ${client.size}` : ""}
            </div>
          </div>
          <GoldButton small ghost onClick={() => setEditProfile((e) => !e)}>
            {editProfile ? "Done" : "Edit details"}
          </GoldButton>
        </div>

        {editProfile ? (
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Business name" value={client.name} onChange={(v) => set({ name: v })} />
              <Field label="Industry" value={client.industry} onChange={(v) => set({ industry: v })} />
              <Field label="Size" value={client.size} onChange={(v) => set({ size: v })} />
            </div>
            <Field area label="Core problems" value={client.problems} onChange={(v) => set({ problems: v })} />
            <Field area label="Current manual processes" value={client.processes} onChange={(v) => set({ processes: v })} />
            <Field area label="Goals" value={client.goals} onChange={(v) => set({ goals: v })} />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            {[
              ["Problems", client.problems],
              ["Manual processes", client.processes],
              ["Goals", client.goals],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-black/30 p-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-kwgold/60">
                  {label}
                </div>
                <div className="text-white/70">{val || <span className="text-white/25">Not filled in</span>}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Analysis */}
      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-kwgold">
            AI Needs Analysis
          </h2>
          {analyzing ? (
            <Spinner label="Researching this business type…" />
          ) : (
            <GoldButton onClick={runAnalysis}>
              {client.analysis ? "↻ Re-run Analysis" : "✨ Run AI Needs Analysis"}
            </GoldButton>
          )}
        </div>

        {!client.analysis && !analyzing && (
          <div className="mt-3 rounded-2xl border border-dashed border-kwgold/25 p-5 text-sm text-white/40">
            The AI will study what {client.industry ? `${client.industry.toLowerCase()}s` : "businesses like this"} struggle
            with, combine it with this client&apos;s details, and pitch 3-5 high-impact automations you can build and sell.
          </div>
        )}

        {client.analysis && (
          <>
            <div className="mt-3 rounded-2xl border border-kwgold/20 bg-kwcard p-5 text-sm leading-relaxed text-white/80">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-kwgold/60">
                What businesses like this struggle with
              </div>
              {client.analysis.summary}
            </div>
            <div className="mt-4 grid gap-4">
              {client.analysis.ideas.map((idea, n) => (
                <div key={idea.id} className="rounded-2xl border border-kwgold/15 bg-kwcard p-5 transition hover:border-kwgold/40">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kwgold/15 text-sm font-extrabold text-kwgold">
                        {n + 1}
                      </span>
                      <div className="font-bold">{idea.title}</div>
                    </div>
                    <DiffBadge d={idea.difficulty} />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-white/70">
                    <div>
                      <span className="font-bold text-kwgold/80">Pain point: </span>
                      {idea.painPoint}
                    </div>
                    <div>{idea.description}</div>
                    <div className="text-emerald-300/90">
                      <span className="font-bold">Impact: </span>
                      {idea.impact}
                    </div>
                    {idea.pitch && (
                      <div className="rounded-xl border border-kwgold/20 bg-kwgold/5 px-3 py-2 italic text-kwgoldlight">
                        “{idea.pitch}”
                      </div>
                    )}
                  </div>
                  {idea.prompt && <PromptBlock prompt={idea.prompt} />}
                  <div className="mt-4">
                    {buildingIdea === idea.id ? (
                      <Spinner label="Drafting the automation blueprint…" />
                    ) : (
                      <GoldButton small onClick={() => buildFromIdea(idea)} disabled={!!buildingIdea}>
                        Build this automation →
                      </GoldButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Automations */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-kwgold">
            Automations ({client.automations.length})
          </h2>
          <GoldButton small ghost onClick={addBlank}>
            + Blank automation
          </GoldButton>
        </div>
        {client.automations.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-kwgold/25 p-5 text-sm text-white/40">
            Nothing built yet — run the analysis above and hit “Build this automation”.
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {client.automations.map((a) => (
              <div
                key={a.id}
                className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-kwgold/15 bg-kwcard px-5 py-4 transition hover:border-kwgold/50"
                onClick={() => openAuto(a.id)}
              >
                <div>
                  <div className="font-bold">{a.name}</div>
                  <div className="mt-0.5 text-xs text-white/45">
                    {a.steps.length} step{a.steps.length === 1 ? "" : "s"}
                    {a.plan ? " · 📄 plan ready" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete automation "${a.name}"?`))
                        update((c) => ({
                          ...c,
                          automations: c.automations.filter((x) => x.id !== a.id),
                        }));
                    }}
                    className="rounded-lg px-2 py-1 text-xs text-white/25 opacity-0 transition hover:bg-rose-950/50 hover:text-rose-300 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                  <span className="text-kwgold">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Automation workspace: build / simulate / plan ──
function AutoScreen({
  client,
  auto,
  tab,
  setTab,
  update,
  back,
  setError,
}: {
  client: Client;
  auto: Automation;
  tab: AutoTab;
  setTab: (t: AutoTab) => void;
  update: (fn: (a: Automation) => Automation) => void;
  back: () => void;
  setError: (e: string) => void;
}) {
  return (
    <div>
      <button onClick={back} className="mb-4 text-xs font-bold uppercase tracking-widest text-kwgold/70 hover:text-kwgold">
        ← {client.name}
      </button>

      <div className="rounded-2xl border border-kwgold/25 bg-kwcard p-5">
        <input
          value={auto.name}
          onChange={(e) => update((a) => ({ ...a, name: e.target.value }))}
          className="w-full bg-transparent text-xl font-extrabold outline-none placeholder:text-white/25"
          placeholder="Automation name…"
        />
        <input
          value={auto.goal}
          onChange={(e) => update((a) => ({ ...a, goal: e.target.value }))}
          className="mt-1 w-full bg-transparent text-sm text-white/60 outline-none placeholder:text-white/25"
          placeholder="One line: what does this automation achieve for the client?"
        />
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-2">
        {(
          [
            ["build", "🛠 Build"],
            ["simulate", "▶ Simulate"],
            ["plan", "📄 Business Plan"],
          ] as [AutoTab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              tab === t
                ? "bg-kwgold text-kwblack"
                : "border border-kwgold/25 text-kwgold/80 hover:border-kwgold/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "build" && <Builder auto={auto} update={update} />}
        {tab === "simulate" && <Simulator auto={auto} />}
        {tab === "plan" && (
          <PlanTab client={client} auto={auto} update={update} setError={setError} />
        )}
      </div>
    </div>
  );
}

// ── Builder ───────────────────────────────────
function NodeShell({
  badge,
  badgeClass,
  children,
}: {
  badge: string;
  badgeClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-2xl border border-kwgold/20 bg-kwcard p-4 pl-5">
      <span
        className={`absolute -top-2.5 left-4 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${badgeClass}`}
      >
        {badge}
      </span>
      {children}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center py-1">
      <div className="h-6 w-px bg-gradient-to-b from-kwgold/50 to-kwgold/15" />
    </div>
  );
}

function Builder({
  auto,
  update,
}: {
  auto: Automation;
  update: (fn: (a: Automation) => Automation) => void;
}) {
  const setStep = (id: string, patch: Partial<Step>) =>
    update((a) => ({
      ...a,
      steps: a.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  const move = (idx: number, dir: -1 | 1) =>
    update((a) => {
      const steps = [...a.steps];
      const j = idx + dir;
      if (j < 0 || j >= steps.length) return a;
      [steps[idx], steps[j]] = [steps[j], steps[idx]];
      return { ...a, steps };
    });
  const remove = (id: string) =>
    update((a) => ({ ...a, steps: a.steps.filter((s) => s.id !== id) }));
  const insertAt = (idx: number) =>
    update((a) => {
      const steps = [...a.steps];
      steps.splice(idx, 0, blankStep());
      return { ...a, steps };
    });

  const inputCls =
    "rounded-lg border border-transparent bg-black/30 px-2.5 py-1.5 text-sm outline-none transition placeholder:text-white/25 focus:border-kwgold/50";

  return (
    <div>
      <div className="mb-4 text-xs text-white/40">
        Everything below is editable — click any text to change it. Use ↑ ↓ to reorder steps.
        Changes save automatically.
      </div>

      {/* Trigger */}
      <NodeShell badge="⚡ Trigger" badgeClass="bg-kwgold text-kwblack">
        <input
          value={auto.trigger.title}
          onChange={(e) =>
            update((a) => ({ ...a, trigger: { ...a.trigger, title: e.target.value } }))
          }
          placeholder="What starts it? e.g. New form submission comes in"
          className={`${inputCls} mt-1 w-full font-bold`}
        />
        <textarea
          value={auto.trigger.detail}
          onChange={(e) =>
            update((a) => ({ ...a, trigger: { ...a.trigger, detail: e.target.value } }))
          }
          placeholder="Details of the trigger…"
          rows={2}
          className={`${inputCls} mt-2 w-full resize-y text-white/70`}
        />
      </NodeShell>

      <Connector />
      <AddBetween onClick={() => insertAt(0)} />

      {/* Steps */}
      {auto.steps.map((s, i) => {
        const meta = stepMeta(s.type);
        return (
          <div key={s.id}>
            {i > 0 && (
              <>
                <Connector />
                <AddBetween onClick={() => insertAt(i)} />
              </>
            )}
            <Connector />
            <NodeShell badge={`${meta.icon} Step ${i + 1}`} badgeClass="bg-white/10 text-kwgold">
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <select
                  value={s.type}
                  onChange={(e) => setStep(s.id, { type: e.target.value as StepType })}
                  className="rounded-lg border border-kwgold/25 bg-black/40 px-2 py-1.5 text-xs font-bold text-kwgold outline-none"
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t.value} value={t.value} className="bg-kwblack">
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
                <input
                  value={s.title}
                  onChange={(e) => setStep(s.id, { title: e.target.value })}
                  placeholder="Step name…"
                  className={`${inputCls} min-w-40 flex-1 font-bold`}
                />
                <input
                  value={s.tool}
                  onChange={(e) => setStep(s.id, { tool: e.target.value })}
                  placeholder="Tool (Email, Sheets…)"
                  className={`${inputCls} w-44 text-xs text-kwgold/90`}
                />
                <div className="ml-auto flex gap-1">
                  <IconBtn label="↑" title="Move up" onClick={() => move(i, -1)} disabled={i === 0} />
                  <IconBtn label="↓" title="Move down" onClick={() => move(i, 1)} disabled={i === auto.steps.length - 1} />
                  <IconBtn label="✕" title="Delete step" danger onClick={() => remove(s.id)} />
                </div>
              </div>
              <textarea
                value={s.detail}
                onChange={(e) => setStep(s.id, { detail: e.target.value })}
                placeholder="What happens in this step?"
                rows={2}
                className={`${inputCls} mt-2 w-full resize-y text-white/70`}
              />
              <input
                value={s.sample}
                onChange={(e) => setStep(s.id, { sample: e.target.value })}
                placeholder="Example output for the simulation, e.g. 'Text sent: Hi Maria, thanks for booking…'"
                className={`${inputCls} mt-2 w-full text-xs italic text-emerald-200/80`}
              />
            </NodeShell>
          </div>
        );
      })}

      <Connector />
      <AddBetween onClick={() => insertAt(auto.steps.length)} label="+ Add step" />
      <Connector />

      {/* Outcome */}
      <NodeShell badge="🏁 Outcome" badgeClass="bg-emerald-400/90 text-kwblack">
        <input
          value={auto.outcome.title}
          onChange={(e) =>
            update((a) => ({ ...a, outcome: { ...a.outcome, title: e.target.value } }))
          }
          placeholder="End result, e.g. Lead booked & logged automatically"
          className={`${inputCls} mt-1 w-full font-bold`}
        />
        <textarea
          value={auto.outcome.detail}
          onChange={(e) =>
            update((a) => ({ ...a, outcome: { ...a.outcome, detail: e.target.value } }))
          }
          placeholder="What the client sees at the end…"
          rows={2}
          className={`${inputCls} mt-2 w-full resize-y text-white/70`}
        />
      </NodeShell>
    </div>
  );
}

function IconBtn({
  label,
  title,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`h-7 w-7 rounded-lg border text-xs font-bold transition disabled:opacity-20 ${
        danger
          ? "border-rose-400/30 text-rose-300 hover:bg-rose-950/50"
          : "border-kwgold/25 text-kwgold hover:bg-kwgold/10"
      }`}
    >
      {label}
    </button>
  );
}

function AddBetween({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <div className="flex justify-center">
      <button
        onClick={onClick}
        className="rounded-full border border-dashed border-kwgold/30 px-3 py-0.5 text-[11px] font-bold text-kwgold/60 transition hover:border-kwgold hover:text-kwgold"
      >
        {label || "+ insert step"}
      </button>
    </div>
  );
}

// ── Simulator ─────────────────────────────────
function Simulator({ auto }: { auto: Automation }) {
  // Node list: trigger, steps…, outcome
  const total = auto.steps.length + 2;
  const [progress, setProgress] = useState(-1); // index of last completed node
  const [running, setRunning] = useState(false);
  const runId = useRef(0);

  const run = async () => {
    const id = ++runId.current;
    setRunning(true);
    setProgress(-1);
    for (let i = 0; i < total; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 400 : 1000));
      if (runId.current !== id) return;
      setProgress(i);
    }
    setRunning(false);
  };
  const reset = () => {
    runId.current++;
    setRunning(false);
    setProgress(-1);
  };

  const done = progress >= total - 1;

  const Node = ({
    idx,
    badge,
    title,
    detail,
    sample,
    accent,
  }: {
    idx: number;
    badge: string;
    title: string;
    detail: string;
    sample?: string;
    accent?: "gold" | "green";
  }) => {
    const state = progress >= idx ? "done" : running && progress === idx - 1 ? "running" : "idle";
    return (
      <div
        className={`rounded-2xl border p-4 transition-all duration-500 ${
          state === "done"
            ? accent === "green"
              ? "border-emerald-400/70 bg-emerald-950/30"
              : "border-kwgold bg-kwgold/10"
            : state === "running"
            ? "border-kwgold/60 bg-kwcard"
            : "border-white/10 bg-kwcard opacity-50"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-kwgold/80">
            {badge}
          </div>
          <div className="text-xs">
            {state === "done" ? (
              <span className={accent === "green" ? "text-emerald-300" : "text-kwgold"}>✓ done</span>
            ) : state === "running" ? (
              <Spinner label="running…" />
            ) : (
              <span className="text-white/25">waiting</span>
            )}
          </div>
        </div>
        <div className="mt-1 font-bold">{title || "Untitled"}</div>
        {detail && <div className="mt-1 text-sm text-white/60">{detail}</div>}
        {sample && state === "done" && (
          <div className="mt-2 rounded-lg border border-emerald-400/20 bg-black/40 px-3 py-2 text-xs italic text-emerald-200/90">
            {sample}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-kwgold/25 bg-kwcard px-5 py-4">
        <div className="text-sm text-white/60">
          Watch the automation run end-to-end — perfect for showing a client exactly what they&apos;re buying.
        </div>
        <div className="flex gap-2">
          <GoldButton onClick={run} disabled={running}>
            {running ? "Running…" : done ? "▶ Run again" : "▶ Run simulation"}
          </GoldButton>
          {(running || progress >= 0) && (
            <GoldButton ghost onClick={reset}>
              Reset
            </GoldButton>
          )}
        </div>
      </div>

      <Node idx={0} badge="⚡ Trigger" title={auto.trigger.title} detail={auto.trigger.detail} accent="gold" />
      {auto.steps.map((s, i) => {
        const meta = stepMeta(s.type);
        return (
          <div key={s.id}>
            <Connector />
            <Node
              idx={i + 1}
              badge={`${meta.icon} Step ${i + 1} · ${meta.label}${s.tool ? ` · ${s.tool}` : ""}`}
              title={s.title}
              detail={s.detail}
              sample={s.sample}
            />
          </div>
        );
      })}
      <Connector />
      <Node
        idx={total - 1}
        badge="🏁 Outcome"
        title={auto.outcome.title}
        detail={auto.outcome.detail}
        accent="green"
      />

      {done && !running && (
        <div className="mt-5 rounded-2xl border border-emerald-400/40 bg-emerald-950/30 px-5 py-4 text-center text-sm font-bold text-emerald-300">
          ✓ Simulation complete — {auto.steps.length} steps ran hands-free.
        </div>
      )}
    </div>
  );
}

// ── Business plan tab ─────────────────────────
function PlanTab({
  client,
  auto,
  update,
  setError,
}: {
  client: Client;
  auto: Automation;
  update: (fn: (a: Automation) => Automation) => void;
  setError: (e: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [saveInfo, setSaveInfo] = useState<{ saved: boolean; path?: string; reason?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const saveToT9 = async (markdown?: string) => {
    const md = markdown ?? auto.plan?.markdown;
    if (!md) return;
    setSaving(true);
    try {
      const d = await post<{ saved: boolean; path?: string; reason?: string }>("/api/save", {
        clientName: client.name,
        automationName: auto.name,
        markdown: md,
      });
      setSaveInfo(d);
    } catch (e: any) {
      setSaveInfo({ saved: false, reason: e.message });
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    setError("");
    setGenerating(true);
    try {
      const data = await post<{ markdown: string }>("/api/plan", { client, automation: auto });
      update((a) => ({ ...a, plan: { markdown: data.markdown, generatedAt: Date.now() } }));
      saveToT9(data.markdown); // auto-file it on the T9 drive when available
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const download = () => {
    if (!auto.plan) return;
    const blob = new Blob([auto.plan.markdown], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${auto.name.replace(/[^\w\d]+/g, "-").replace(/^-|-$/g, "") || "automation"}-proposal.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-kwgold/25 bg-kwcard px-5 py-4">
        <div className="text-sm text-white/60">
          {auto.plan
            ? `Generated ${new Date(auto.plan.generatedAt).toLocaleString()}`
            : "Turn this automation into a client-ready proposal: problem, solution, benefits, timeline, investment, next step."}
        </div>
        <div className="flex flex-wrap gap-2">
          {generating ? (
            <Spinner label="Writing the proposal…" />
          ) : (
            <GoldButton onClick={generate}>
              {auto.plan ? "↻ Regenerate" : "📄 Generate Business Plan"}
            </GoldButton>
          )}
          {auto.plan && !generating && (
            <>
              <CopyButton text={auto.plan.markdown} label="Copy Markdown" />
              <GoldButton small ghost onClick={download}>
                ⬇ Download .md
              </GoldButton>
              <GoldButton small ghost onClick={() => saveToT9()} disabled={saving}>
                {saving ? "Saving…" : "💾 Save to T9"}
              </GoldButton>
              <GoldButton small ghost onClick={() => window.print()}>
                🖨 Print / Save PDF
              </GoldButton>
            </>
          )}
        </div>
      </div>

      {saveInfo && (
        <div
          className={`mb-4 rounded-xl border px-4 py-2.5 text-xs ${
            saveInfo.saved
              ? "border-emerald-400/40 bg-emerald-950/30 text-emerald-300"
              : "border-kwgold/25 bg-kwcard text-white/50"
          }`}
        >
          {saveInfo.saved
            ? `💾 Filed on T9 → ${saveInfo.path}`
            : `T9 save skipped: ${saveInfo.reason}`}
        </div>
      )}

      {auto.plan ? (
        <div className="rounded-2xl border border-kwgold/20 bg-kwcard p-6 sm:p-8">
          <Markdown text={auto.plan.markdown} />
        </div>
      ) : (
        !generating && (
          <div className="rounded-2xl border border-dashed border-kwgold/25 py-14 text-center text-sm text-white/40">
            No plan yet. Build the automation first, then generate — the AI uses the client profile
            and every step of the flow.
          </div>
        )
      )}
    </div>
  );
}
