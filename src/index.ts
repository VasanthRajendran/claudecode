import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { writeFileSync } from "fs";
import { generatePlan, fixPlan, type PlanInputs } from "./planner.js";
import { validatePlan, type LearningPlan } from "./schema.js";

// ── CLI helpers ───────────────────────────────────────────────────────────────

async function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function askNumber(
  rl: ReturnType<typeof createInterface>,
  question: string
): Promise<number> {
  while (true) {
    const raw = await ask(rl, question);
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 0) return num;
    console.log("  ⚠  Please enter a positive number.");
  }
}

// ── Output ────────────────────────────────────────────────────────────────────

function printPlan(plan: LearningPlan): void {
  const line = "─".repeat(62);
  console.log("\n" + line);
  console.log(`  LEARNING PLAN: ${plan.topic.toUpperCase()}`);
  console.log(line);
  console.log(`  Level          : ${plan.level}`);
  console.log(`  Goal           : ${plan.goal}`);
  console.log(`  Duration       : ${plan.weeks} weeks`);
  console.log(`  Hours / week   : ${plan.hours_per_week}`);

  for (const week of plan.plan) {
    console.log(`\n  Week ${week.week} — ${week.focus}  (${week.hours}h)`);
    for (const task of week.tasks) {
      console.log(`    • ${task.title}  [${task.effort_hours}h]`);
      console.log(`      Deliverable: ${task.deliverable}`);
    }
    console.log(`    ✓ Checkpoint: ${week.checkpoint}`);
  }

  console.log("\n" + line + "\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rl = createInterface({ input, output });

  console.log("\n" + "═".repeat(62));
  console.log("  LearnPlan — AI-powered personalized learning planner");
  console.log("═".repeat(62) + "\n");

  // ── Collect inputs ──────────────────────────────────────────────
  const topic = await ask(rl, "Topic to learn: ");
  const level = await ask(rl, "Skill level (beginner / intermediate / advanced): ");
  const goal = await ask(rl, "Learning goal: ");
  const weeks = await askNumber(rl, "Number of weeks: ");
  const hours_per_week = await askNumber(rl, "Hours per week: ");
  const constraints = await ask(
    rl,
    "Constraints or notes (press Enter to skip): "
  );

  rl.close();

  const inputs: PlanInputs = {
    topic,
    level,
    goal,
    weeks,
    hours_per_week,
    constraints,
  };

  // ── First attempt ────────────────────────────────────────────────
  console.log("\nGenerating your learning plan…");

  let result: { plan: LearningPlan; rawJson: string } | null = null;
  let firstErrors: string[] = [];

  try {
    result = generatePlan(inputs);
    const validationErrors = validatePlan(result.plan);
    if (validationErrors.length > 0) {
      firstErrors = validationErrors.map((e) => e.message);
    }
  } catch (err) {
    firstErrors = [err instanceof Error ? err.message : String(err)];
  }

  // ── Retry once if needed ─────────────────────────────────────────
  if (firstErrors.length > 0) {
    console.log("\n⚠️  Issues with first attempt:");
    firstErrors.forEach((e) => console.log(`   • ${e}`));
    console.log("\nRetrying with corrected logic…");

    try {
      result = fixPlan(inputs, firstErrors);

      const remainingErrors = validatePlan(result.plan);
      if (remainingErrors.length > 0) {
        console.log("\n⚠️  Some issues remain after retry:");
        remainingErrors.forEach((e) => console.log(`   • ${e.message}`));
        console.log("Saving the best available plan.");
      } else {
        console.log("✅ Plan fixed and validated!");
      }
    } catch (retryErr) {
      if (!result) {
        console.error("\n❌ Could not generate a valid plan after two attempts.");
        console.error(retryErr instanceof Error ? retryErr.message : retryErr);
        process.exit(1);
      }
      console.log("\n⚠️  Retry failed. Saving original plan (may have minor issues).");
    }
  } else if (result) {
    console.log("✅ Plan validated!");
  }

  // ── Save and display ─────────────────────────────────────────────
  // At this point result is guaranteed non-null (or we exited above)
  const finalPlan = result!.plan;

  writeFileSync("plan.json", JSON.stringify(finalPlan, null, 2), "utf-8");
  console.log("\n📄 Plan saved to plan.json");

  printPlan(finalPlan);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
