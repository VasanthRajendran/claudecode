/**
 * planner.ts — local, deterministic learning-plan generator.
 *
 * Claude Code acts as the reasoning engine here: the heuristics, phase
 * structure, and task templates below encode the same kind of thinking that
 * would previously have been delegated to a live Claude API call.  The result
 * is instant, offline, and needs no API key.
 */

import { type LearningPlan, type Week, type Task } from "./schema.js";

// ── Public surface (same shape as the old llm.ts) ────────────────────────────

export interface PlanInputs {
  topic: string;
  level: string;
  goal: string;
  weeks: number;
  hours_per_week: number;
  constraints: string;
}

export interface PlanResult {
  plan: LearningPlan;
  rawJson: string;
}

// ── Phase logic ───────────────────────────────────────────────────────────────

type Phase = "foundation" | "development" | "application";

/**
 * Map each week number to one of three learning phases.
 *
 * 1 week  → application only (crash course)
 * 2 weeks → foundation → application
 * 3+      → first third foundation, middle third development, last third application
 */
function phaseOf(week: number, total: number): Phase {
  if (total === 1) return "application";
  if (total === 2) return week === 1 ? "foundation" : "application";
  const ratio = week / total;
  if (ratio <= 1 / 3) return "foundation";
  if (ratio <= 2 / 3) return "development";
  return "application";
}

// ── Hour distribution ─────────────────────────────────────────────────────────

/** How many tasks to create per week based on available hours. */
function tasksPerWeek(hoursPerWeek: number): number {
  if (hoursPerWeek <= 4) return 2;
  if (hoursPerWeek <= 14) return 3;
  return 4;
}

/**
 * Split `total` hours into `count` buckets that sum to *exactly* `total`.
 * Values are rounded to one decimal place; the last bucket absorbs rounding
 * drift so the arithmetic invariant is always satisfied.
 */
function distributeHours(total: number, count: number): number[] {
  const unit = Math.round((total / count) * 10) / 10;
  const hours: number[] = Array(count).fill(unit);
  // Recompute last slot from remainder to avoid floating-point drift
  const rest = Math.round((total - unit * (count - 1)) * 100) / 100;
  hours[count - 1] = rest;
  return hours;
}

// ── Task-template banks ───────────────────────────────────────────────────────

interface Tpl {
  title: string;
  deliverable: string;
}

/** Two banks of foundation tasks; rotate by phase index so repeat weeks vary. */
function foundationBank(topic: string, idx: number): Tpl[] {
  const banks: Tpl[][] = [
    [
      {
        title: `Set up ${topic} development environment and toolchain`,
        deliverable: "Working local environment verified with a hello-world program",
      },
      {
        title: `Study ${topic} core concepts and mental model`,
        deliverable: "Written notes covering the 5 most important concepts",
      },
      {
        title: `Complete beginner ${topic} exercises`,
        deliverable: "3+ exercises solved and committed to a repo",
      },
      {
        title: `Build a minimal demo project in ${topic}`,
        deliverable: "Runnable project with a short README",
      },
    ],
    [
      {
        title: `Read the official ${topic} getting-started guide`,
        deliverable: "Annotated notes and working code samples from the guide",
      },
      {
        title: `Explore ${topic} syntax and common idioms through examples`,
        deliverable: "Personal cheat-sheet of the most common patterns",
      },
      {
        title: `Reproduce 3 programs from the ${topic} documentation`,
        deliverable: "3 working programs with comments explaining each line",
      },
      {
        title: `Identify and fill 3 knowledge gaps from this week`,
        deliverable: "Gap list with links to resources and notes for each",
      },
    ],
  ];
  return banks[idx % banks.length];
}

/** Three rotating banks of development tasks. */
function developmentBank(topic: string, idx: number): Tpl[] {
  const banks: Tpl[][] = [
    [
      {
        title: `Study ${topic} data structures and common design patterns`,
        deliverable: "Notes plus at least 2 implemented examples",
      },
      {
        title: `Build a feature-complete module using ${topic}`,
        deliverable: "Tested module with passing unit tests",
      },
      {
        title: `Refactor previous code applying ${topic} best practices`,
        deliverable: "Pull request or commit documenting every improvement",
      },
      {
        title: `Read and analyse a popular open-source ${topic} project`,
        deliverable: "Summary of 3 patterns or techniques discovered",
      },
    ],
    [
      {
        title: `Study ${topic} error handling and edge-case strategies`,
        deliverable: "Error-handling guide with annotated code examples",
      },
      {
        title: `Explore the ${topic} standard library and ecosystem`,
        deliverable: "Curated list of 5 useful libraries with usage notes",
      },
      {
        title: `Write tests for the module built last week`,
        deliverable: "Test suite achieving >80% coverage",
      },
      {
        title: `Solve 5 intermediate ${topic} exercises`,
        deliverable: "Solutions with written explanation of each approach",
      },
    ],
    [
      {
        title: `Study ${topic} performance patterns and profiling tools`,
        deliverable: "Benchmark comparing two implementations with analysis",
      },
      {
        title: `Build a CLI utility in ${topic}`,
        deliverable: "Usable CLI with help text, flags, and error handling",
      },
      {
        title: `Peer-review or self-review an earlier project`,
        deliverable: "Code-review checklist with all action items resolved",
      },
      {
        title: `Document a ${topic} mini-library with a public API`,
        deliverable: "Library with README, usage examples, and passing tests",
      },
    ],
  ];
  return banks[idx % banks.length];
}

/** Application tasks: design → build → integrate → ship. */
function applicationBank(topic: string, goal: string, idx: number, totalAppWeeks: number): Tpl[] {
  const isFirst = idx === 0;
  const isLast = idx === totalAppWeeks - 1;

  if (isFirst) {
    return [
      {
        title: `Design the capstone project architecture for goal: "${goal}"`,
        deliverable: "Architecture diagram, feature list, and tech-decision log",
      },
      {
        title: `Implement the core skeleton of the capstone project`,
        deliverable: "Bootstrapped repo with main modules stubbed out",
      },
      {
        title: `Identify ${topic} skills still needed for the capstone`,
        deliverable: "Skills-gap list with a targeted study plan per gap",
      },
      {
        title: `Set up CI and project tooling`,
        deliverable: "Automated tests running on every push",
      },
    ];
  }

  if (isLast) {
    return [
      {
        title: `Complete and polish the capstone project`,
        deliverable: "Deployed or packaged project with full documentation",
      },
      {
        title: `Write a project retrospective: what you learned and what's next`,
        deliverable: "Published blog post or README retrospective section",
      },
      {
        title: `Share the project and collect feedback`,
        deliverable: "Feedback collected from ≥2 peers or community members",
      },
      {
        title: `Create a personal roadmap for continued growth`,
        deliverable: "Next-steps document listing 3 concrete future goals",
      },
    ];
  }

  // Middle application weeks
  return [
    {
      title: `Implement the next planned feature set`,
      deliverable: "Feature complete, tested, and merged to main branch",
    },
    {
      title: `Integrate ${topic} advanced techniques from the development phase`,
      deliverable: "Refactored capstone section with integration documented",
    },
    {
      title: `Write integration tests and fix any regressions`,
      deliverable: "Full test suite green with no known open bugs",
    },
    {
      title: `Update project documentation and README`,
      deliverable: "Clear README with usage instructions, examples, and screenshots",
    },
  ];
}

// ── Focus line and checkpoint text ────────────────────────────────────────────

function focusLine(phase: Phase, idx: number, topic: string, goal: string): string {
  if (phase === "foundation") {
    return idx === 0
      ? `Introduction & Setup — ${topic}`
      : `${topic} Fundamentals — Part ${idx + 1}`;
  }
  if (phase === "development") {
    const labels = [
      `Core Patterns — ${topic}`,
      `Error Handling & Testing — ${topic}`,
      `Ecosystem & Performance — ${topic}`,
      `Advanced Techniques — ${topic}`,
    ];
    return labels[idx % labels.length];
  }
  const labels = [
    "Project Design & Kickoff",
    "Core Feature Implementation",
    "Integration & Quality",
    "Final Polish & Portfolio",
  ];
  return labels[Math.min(idx, labels.length - 1)];
}

function checkpoint(phase: Phase, idx: number, topic: string, goal: string): string {
  if (phase === "foundation") {
    return idx === 0
      ? `Can explain what ${topic} is used for and run a simple program without help`
      : `Can write a basic ${topic} program independently without consulting notes`;
  }
  if (phase === "development") {
    const checks = [
      `Can apply ${topic} patterns to a new problem without referring to notes`,
      `Can handle errors and write tests for ${topic} code confidently`,
      `Can choose the right ${topic} library for a given requirement`,
      `Can optimise and document ${topic} code to a production standard`,
    ];
    return checks[idx % checks.length];
  }
  return `Capstone progress demonstrates ability to: ${goal}`;
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generatePlan(inputs: PlanInputs): PlanResult {
  const { topic, level, goal, weeks, hours_per_week } = inputs;
  const nTasks = tasksPerWeek(hours_per_week);

  // Pre-count how many application weeks there are (needed for isLast logic)
  const appWeekCount = Array.from({ length: weeks }, (_, i) => i + 1).filter(
    (w) => phaseOf(w, weeks) === "application"
  ).length;

  const phaseIdx: Record<Phase, number> = { foundation: 0, development: 0, application: 0 };
  const plan: Week[] = [];

  for (let w = 1; w <= weeks; w++) {
    const phase = phaseOf(w, weeks);
    const idx = phaseIdx[phase]++;

    // Select task templates for this phase + index
    let templates: Tpl[];
    if (phase === "foundation") {
      templates = foundationBank(topic, idx);
    } else if (phase === "development") {
      templates = developmentBank(topic, idx);
    } else {
      templates = applicationBank(topic, goal, idx, appWeekCount);
    }

    // Trim to the number of tasks that fit this week's hours
    const selected = templates.slice(0, nTasks);

    // Distribute hours so they sum to exactly hours_per_week
    const hrs = distributeHours(hours_per_week, selected.length);
    const tasks: Task[] = selected.map((t, i) => ({
      title: t.title,
      effort_hours: hrs[i],
      deliverable: t.deliverable,
    }));

    // Compute week.hours as the actual sum (guards against any residual drift)
    const weekHours =
      Math.round(tasks.reduce((s, t) => s + t.effort_hours, 0) * 100) / 100;

    plan.push({
      week: w,
      focus: focusLine(phase, idx, topic, goal),
      hours: weekHours,
      tasks,
      checkpoint: checkpoint(phase, idx, topic, goal),
    });
  }

  const result: LearningPlan = { topic, level, goal, weeks, hours_per_week, plan };
  return { plan: result, rawJson: JSON.stringify(result, null, 2) };
}

/**
 * The deterministic planner is always structurally valid, so "fixing" simply
 * means re-generating.  The error messages are logged by the caller for
 * transparency but don't change the output strategy.
 */
export function fixPlan(inputs: PlanInputs, _errors: string[]): PlanResult {
  return generatePlan(inputs);
}
