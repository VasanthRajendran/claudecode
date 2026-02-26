import { describe, it, expect } from "vitest";
import { generatePlan, fixPlan } from "../src/planner.js";
import { validatePlan } from "../src/schema.js";
import type { PlanInputs } from "../src/planner.js";

const base: PlanInputs = {
  topic: "TypeScript",
  level: "beginner",
  goal: "Build a REST API",
  weeks: 4,
  hours_per_week: 10,
  constraints: "",
};

describe("generatePlan", () => {
  it("returns the correct number of weeks", () => {
    const { plan } = generatePlan(base);
    expect(plan.plan).toHaveLength(base.weeks);
  });

  it("week numbers are sequential starting at 1", () => {
    const { plan } = generatePlan(base);
    plan.plan.forEach((w, i) => expect(w.week).toBe(i + 1));
  });

  it("every week has at least one task", () => {
    const { plan } = generatePlan(base);
    plan.plan.forEach((w) => expect(w.tasks.length).toBeGreaterThanOrEqual(1));
  });

  it("passes all three business-logic invariants", () => {
    const { plan } = generatePlan(base);
    expect(validatePlan(plan)).toHaveLength(0);
  });

  it("each week.hours equals the sum of its task effort_hours", () => {
    const { plan } = generatePlan(base);
    for (const week of plan.plan) {
      const sum =
        Math.round(
          week.tasks.reduce((s, t) => s + t.effort_hours, 0) * 100
        ) / 100;
      expect(sum).toBeCloseTo(week.hours, 1);
    }
  });

  it("no week exceeds hours_per_week", () => {
    const { plan } = generatePlan(base);
    plan.plan.forEach((w) =>
      expect(w.hours).toBeLessThanOrEqual(plan.hours_per_week)
    );
  });

  it("rawJson round-trips through JSON.parse correctly", () => {
    const { plan, rawJson } = generatePlan(base);
    expect(JSON.parse(rawJson)).toEqual(plan);
  });

  it("works for a single week", () => {
    const { plan } = generatePlan({ ...base, weeks: 1 });
    expect(plan.plan).toHaveLength(1);
    expect(validatePlan(plan)).toHaveLength(0);
  });

  it("works for a long plan (12 weeks)", () => {
    const { plan } = generatePlan({ ...base, weeks: 12 });
    expect(plan.plan).toHaveLength(12);
    expect(validatePlan(plan)).toHaveLength(0);
  });

  it("respects fractional hours_per_week", () => {
    const { plan } = generatePlan({ ...base, hours_per_week: 7.5 });
    expect(validatePlan(plan)).toHaveLength(0);
    plan.plan.forEach((w) => expect(w.hours).toBeLessThanOrEqual(7.5 + 0.01));
  });

  it("uses fewer tasks when hours_per_week is very low (≤4)", () => {
    const { plan } = generatePlan({ ...base, hours_per_week: 3 });
    plan.plan.forEach((w) => expect(w.tasks.length).toBe(2));
  });

  it("uses more tasks when hours_per_week is high (>14)", () => {
    const { plan } = generatePlan({ ...base, hours_per_week: 20 });
    plan.plan.forEach((w) => expect(w.tasks.length).toBe(4));
  });

  it("echoes back topic, level, goal, weeks, hours_per_week", () => {
    const { plan } = generatePlan(base);
    expect(plan.topic).toBe(base.topic);
    expect(plan.level).toBe(base.level);
    expect(plan.goal).toBe(base.goal);
    expect(plan.weeks).toBe(base.weeks);
    expect(plan.hours_per_week).toBe(base.hours_per_week);
  });
});

describe("fixPlan", () => {
  it("produces a valid plan (same as generatePlan)", () => {
    const { plan } = fixPlan(base, ["some error"]);
    expect(validatePlan(plan)).toHaveLength(0);
  });
});
