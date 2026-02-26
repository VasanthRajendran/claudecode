import Anthropic from "@anthropic-ai/sdk";
import { LearningPlanSchema, type LearningPlan } from "./schema.js";

const client = new Anthropic();

// ── Prompt templates ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert learning plan creator. Produce structured, realistic, actionable plans.

Return ONLY a valid JSON object — no markdown fences, no explanations, no surrounding text.
The JSON must exactly match this structure:

{
  "topic": "string",
  "level": "string",
  "goal": "string",
  "weeks": <integer>,
  "hours_per_week": <number>,
  "plan": [
    {
      "week": <integer, starts at 1>,
      "focus": "string",
      "hours": <number>,
      "tasks": [
        {
          "title": "string",
          "effort_hours": <positive number>,
          "deliverable": "string"
        }
      ],
      "checkpoint": "string"
    }
  ]
}

STRICT CONSTRAINTS — violations will fail automated validation:
1. plan array length MUST equal the 'weeks' value.
2. Each week's 'hours' MUST equal the exact sum of its tasks' 'effort_hours'.
3. No week's 'hours' may exceed 'hours_per_week'.
4. Week numbers must be sequential: 1, 2, 3 …`;

export interface PlanInputs {
  topic: string;
  level: string;
  goal: string;
  weeks: number;
  hours_per_week: number;
  constraints: string;
}

function buildUserPrompt(inputs: PlanInputs): string {
  return `Create a ${inputs.weeks}-week learning plan with these parameters:

Topic: ${inputs.topic}
Skill level: ${inputs.level}
Goal: ${inputs.goal}
Duration: ${inputs.weeks} weeks
Hours per week: ${inputs.hours_per_week}
Constraints / notes: ${inputs.constraints || "None"}

The plan MUST have exactly ${inputs.weeks} week entries. Each week's 'hours' must equal the sum of its tasks' 'effort_hours'. No week may exceed ${inputs.hours_per_week} hours.`;
}

// ── Core API call ─────────────────────────────────────────────────────────────

export interface PlanResult {
  plan: LearningPlan;
  rawJson: string;
}

async function callLLM(messages: Anthropic.MessageParam[]): Promise<PlanResult> {
  process.stdout.write("\nGenerating");

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      (event.delta.type === "text_delta" ||
        event.delta.type === "thinking_delta")
    ) {
      process.stdout.write(".");
    }
  }

  const finalMessage = await stream.finalMessage();
  process.stdout.write(" done!\n");

  // Extract the text block (thinking blocks are filtered out)
  const textBlock = finalMessage.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  if (!textBlock) {
    throw new Error("Claude returned no text content in response.");
  }

  // Strip any accidental markdown fences
  let rawJson = textBlock.text.trim();
  rawJson = rawJson
    .replace(/^```(?:json)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "");

  // Parse and validate against Zod schema
  const parsed: unknown = JSON.parse(rawJson);
  const plan = LearningPlanSchema.parse(parsed);

  return { plan, rawJson };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** First-attempt plan generation. */
export async function generatePlan(inputs: PlanInputs): Promise<PlanResult> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserPrompt(inputs) },
  ];
  return callLLM(messages);
}

/**
 * Retry: feed the errors (and optionally the bad JSON) back to the model
 * so it can produce a corrected plan in a single new call.
 * Note: Opus 4.6 does not support assistant-turn prefills, so the
 * previous JSON is embedded in the user message instead.
 */
export async function fixPlan(
  inputs: PlanInputs,
  errors: string[],
  previousJson?: string
): Promise<PlanResult> {
  const errorSection = errors.length
    ? `\n\nThe previous attempt failed validation. Fix ALL of these issues:\n${errors
        .map((e) => `  • ${e}`)
        .join("\n")}`
    : "";

  const prevSection = previousJson
    ? `\n\nPrevious (invalid) JSON for reference:\n${previousJson}`
    : "";

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: buildUserPrompt(inputs) + errorSection + prevSection,
    },
  ];

  return callLLM(messages);
}
