import { z } from "zod";

// ── Leaf schemas ──────────────────────────────────────────────────────────────

export const TaskSchema = z.object({
  title: z.string().describe("Short task title"),
  effort_hours: z.number().positive().describe("Hours required for this task"),
  deliverable: z.string().describe("Concrete, measurable output"),
});

export const WeekSchema = z.object({
  week: z.number().int().positive().describe("Week number (1-indexed)"),
  focus: z.string().describe("Central theme for the week"),
  hours: z
    .number()
    .positive()
    .describe("Total hours (must equal the sum of task effort_hours)"),
  tasks: z.array(TaskSchema).min(1).describe("At least one task per week"),
  checkpoint: z.string().describe("How to verify learning at week end"),
});

export const LearningPlanSchema = z.object({
  topic: z.string().describe("Subject being learned"),
  level: z.string().describe("Learner's current skill level"),
  goal: z.string().describe("Learning objective"),
  weeks: z.number().int().positive().describe("Total plan duration in weeks"),
  hours_per_week: z.number().positive().describe("Available hours per week"),
  plan: z.array(WeekSchema).min(1).describe("Week-by-week breakdown"),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type Task = z.infer<typeof TaskSchema>;
export type Week = z.infer<typeof WeekSchema>;
export type LearningPlan = z.infer<typeof LearningPlanSchema>;

// ── Business-logic validation ─────────────────────────────────────────────────

export type ValidationErrorType =
  | "weeks_mismatch"
  | "hours_mismatch"
  | "hours_exceeded";

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
}

/**
 * Validates constraints that Zod cannot express:
 *  1. plan.length === weeks
 *  2. week.hours === sum(task.effort_hours)   for every week
 *  3. week.hours <= hours_per_week             for every week
 */
export function validatePlan(plan: LearningPlan): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Correct number of weeks
  if (plan.plan.length !== plan.weeks) {
    errors.push({
      type: "weeks_mismatch",
      message: `plan array has ${plan.plan.length} entries but 'weeks' is ${plan.weeks}. They must match exactly.`,
    });
  }

  for (const week of plan.plan) {
    const taskSum = week.tasks.reduce((sum, t) => sum + t.effort_hours, 0);
    const roundedSum = Math.round(taskSum * 100) / 100;
    const roundedHours = Math.round(week.hours * 100) / 100;

    // 2. Week hours equals task sum
    if (Math.abs(roundedSum - roundedHours) > 0.01) {
      errors.push({
        type: "hours_mismatch",
        message: `Week ${week.week}: 'hours' is ${roundedHours} but task effort_hours sum to ${roundedSum}. They must be equal.`,
      });
    }

    // 3. Weekly hours within budget
    if (roundedHours > plan.hours_per_week) {
      errors.push({
        type: "hours_exceeded",
        message: `Week ${week.week}: ${roundedHours}h exceeds the hours_per_week limit of ${plan.hours_per_week}h.`,
      });
    }
  }

  return errors;
}
