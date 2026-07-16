// ── Shared data model (client + server) ──────

export type StepType = "action" | "ai" | "condition" | "notify" | "wait";

export type Step = {
  id: string;
  type: StepType;
  title: string;
  detail: string;
  tool: string;
  sample: string; // example output shown during simulation
};

export type Automation = {
  id: string;
  name: string;
  goal: string;
  trigger: { title: string; detail: string };
  steps: Step[];
  outcome: { title: string; detail: string };
  plan?: { markdown: string; generatedAt: number };
  createdAt: number;
  updatedAt: number;
};

export type AutomationIdea = {
  id: string;
  title: string;
  painPoint: string;
  description: string;
  impact: string;
  difficulty: string;
  pitch?: string; // one-line sell Keith says to the business
  prompt?: string; // full copy-paste Claude build prompt
};

// A business the AI researched and suggests Keith go sell to.
export type Prospect = {
  businessName: string;
  industry: string;
  size: string;
  problems: string;
  processes: string;
  goals: string;
  whyTarget: string;
  howToFind: string;
  summary: string;
  ideas: Omit<AutomationIdea, "id">[];
};

export type Analysis = {
  summary: string;
  ideas: AutomationIdea[];
  generatedAt: number;
};

export type Client = {
  id: string;
  name: string;
  industry: string;
  size: string;
  problems: string;
  processes: string;
  goals: string;
  createdAt: number;
  analysis?: Analysis;
  automations: Automation[];
};

export const STEP_TYPES: { value: StepType; label: string; icon: string }[] = [
  { value: "action", label: "Action", icon: "⚙️" },
  { value: "ai", label: "AI Task", icon: "✨" },
  { value: "condition", label: "Decision", icon: "🔀" },
  { value: "notify", label: "Notify", icon: "📣" },
  { value: "wait", label: "Wait", icon: "⏳" },
];

export const INDUSTRIES = [
  "School District",
  "Restaurant",
  "Gym / Fitness Studio",
  "Real Estate",
  "Med Spa",
  "Winery",
  "City / Municipality",
  "Hotel",
  "Wedding Venue",
  "Chamber of Commerce",
  "Other",
];

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}
