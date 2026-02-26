import { describe, it, expect } from "vitest";
import {
  TaskSchema,
  WeekSchema,
  LearningPlanSchema,
  validatePlan,
} from "../src/schema.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_TASK = {
  title: "Read chapter 1",
  effort_hours: 2,
  deliverable: "One-page summary",
};

const VALID_WEEK = {
  week: 1,
  focus: "Introduction to TypeScript",
  hours: 4,
  tasks: [
    { title: "Setup environment", effort_hours: 1, deliverable: "Working TS project" },
    { title: "Basic types", effort_hours: 3, deliverable: "Typed utility file" },
  ],
  checkpoint: "Can compile and run a TypeScript file",
};

const VALID_PLAN = {
  topic: "TypeScript",
  level: "beginner",
  goal: "Build a REST API",
  weeks: 2,
  hours_per_week: 10,
  plan: [
    {
      week: 1,
      focus: "Basics",
      hours: 8,
      tasks: [
        { title: "T1", effort_hours: 4, deliverable: "D1" },
        { title: "T2", effort_hours: 4, deliverable: "D2" },
      ],
      checkpoint: "Quiz on basics",
    },
    {
      week: 2,
      focus: "Advanced",
      hours: 6,
      tasks: [{ title: "T3", effort_hours: 6, deliverable: "D3" }],
      checkpoint: "Build a small project",
    },
  ],
};

// ── TaskSchema ────────────────────────────────────────────────────────────────

describe("TaskSchema", () => {
  it("accepts a valid task", () => {
    expect(() => TaskSchema.parse(VALID_TASK)).not.toThrow();
  });

  it("rejects a task with a missing title", () => {
    expect(() =>
      TaskSchema.parse({ effort_hours: 2, deliverable: "D" })
    ).toThrow();
  });

  it("rejects a task with zero effort_hours", () => {
    expect(() =>
      TaskSchema.parse({ ...VALID_TASK, effort_hours: 0 })
    ).toThrow();
  });

  it("rejects a task with negative effort_hours", () => {
    expect(() =>
      TaskSchema.parse({ ...VALID_TASK, effort_hours: -1 })
    ).toThrow();
  });

  it("rejects a task with a missing deliverable", () => {
    expect(() =>
      TaskSchema.parse({ title: "T", effort_hours: 2 })
    ).toThrow();
  });
});

// ── WeekSchema ────────────────────────────────────────────────────────────────

describe("WeekSchema", () => {
  it("accepts a valid week", () => {
    expect(() => WeekSchema.parse(VALID_WEEK)).not.toThrow();
  });

  it("rejects a week with an empty tasks array", () => {
    expect(() =>
      WeekSchema.parse({ ...VALID_WEEK, tasks: [] })
    ).toThrow();
  });

  it("rejects a week with a non-integer week number", () => {
    expect(() =>
      WeekSchema.parse({ ...VALID_WEEK, week: 1.5 })
    ).toThrow();
  });

  it("rejects a week with zero hours", () => {
    expect(() =>
      WeekSchema.parse({ ...VALID_WEEK, hours: 0 })
    ).toThrow();
  });
});

// ── LearningPlanSchema ────────────────────────────────────────────────────────

describe("LearningPlanSchema", () => {
  it("accepts a valid plan", () => {
    expect(() => LearningPlanSchema.parse(VALID_PLAN)).not.toThrow();
  });

  it("rejects a plan missing the topic field", () => {
    const { topic: _, ...rest } = VALID_PLAN;
    expect(() => LearningPlanSchema.parse(rest)).toThrow();
  });

  it("rejects a plan with an empty plan array", () => {
    expect(() =>
      LearningPlanSchema.parse({ ...VALID_PLAN, plan: [] })
    ).toThrow();
  });

  it("rejects a plan with non-positive weeks", () => {
    expect(() =>
      LearningPlanSchema.parse({ ...VALID_PLAN, weeks: 0 })
    ).toThrow();
  });
});

// ── validatePlan ──────────────────────────────────────────────────────────────

describe("validatePlan", () => {
  it("returns no errors for a perfectly valid plan", () => {
    const plan = LearningPlanSchema.parse(VALID_PLAN);
    expect(validatePlan(plan)).toHaveLength(0);
  });

  it("detects a weeks count mismatch", () => {
    // Plan has 2 week entries but weeks field says 3
    const plan = LearningPlanSchema.parse({ ...VALID_PLAN, weeks: 3 });
    const errors = validatePlan(plan);
    expect(errors.some((e) => e.type === "weeks_mismatch")).toBe(true);
  });

  it("detects when a week's hours don't match the task sum", () => {
    const plan = LearningPlanSchema.parse({
      ...VALID_PLAN,
      plan: [
        {
          // hours = 10 but tasks sum to 8
          week: 1,
          focus: "Basics",
          hours: 10,
          tasks: [
            { title: "T1", effort_hours: 4, deliverable: "D1" },
            { title: "T2", effort_hours: 4, deliverable: "D2" },
          ],
          checkpoint: "C1",
        },
        VALID_PLAN.plan[1],
      ],
    });
    const errors = validatePlan(plan);
    expect(errors.some((e) => e.type === "hours_mismatch")).toBe(true);
  });

  it("detects hours exceeding hours_per_week", () => {
    const plan = LearningPlanSchema.parse({
      ...VALID_PLAN,
      hours_per_week: 5, // tight budget
      // weeks 1 has 8h and week 2 has 6h — both exceed 5
    });
    const errors = validatePlan(plan);
    expect(errors.some((e) => e.type === "hours_exceeded")).toBe(true);
  });

  it("can return multiple errors at once", () => {
    // weeks mismatch + hours_exceeded
    const plan = LearningPlanSchema.parse({
      ...VALID_PLAN,
      weeks: 3, // mismatch: plan has only 2 entries
      hours_per_week: 5, // exceeded in both weeks
    });
    const errors = validatePlan(plan);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    const types = errors.map((e) => e.type);
    expect(types).toContain("weeks_mismatch");
    expect(types).toContain("hours_exceeded");
  });

  it("handles floating-point hour sums within tolerance", () => {
    // 1.1 + 1.1 + 1.8 = 4.000000000000001 in JS — should pass
    const plan = LearningPlanSchema.parse({
      topic: "Math",
      level: "beginner",
      goal: "Pass exam",
      weeks: 1,
      hours_per_week: 10,
      plan: [
        {
          week: 1,
          focus: "Basics",
          hours: 4,
          tasks: [
            { title: "A", effort_hours: 1.1, deliverable: "D1" },
            { title: "B", effort_hours: 1.1, deliverable: "D2" },
            { title: "C", effort_hours: 1.8, deliverable: "D3" },
          ],
          checkpoint: "Quiz",
        },
      ],
    });
    const errors = validatePlan(plan);
    expect(errors.filter((e) => e.type === "hours_mismatch")).toHaveLength(0);
  });
});
