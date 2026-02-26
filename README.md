# LearnPlan

AI-powered personalized learning plan generator — powered by Claude Opus 4.6.

## Prerequisites

- Node 20+
- An [Anthropic API key](https://console.anthropic.com)

## Setup

```bash
npm install
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Usage

```bash
npm start
```

You will be prompted for:

| Prompt | Example |
|--------|---------|
| Topic | `Rust programming` |
| Skill level | `beginner` |
| Learning goal | `Build a CLI tool from scratch` |
| Number of weeks | `8` |
| Hours per week | `10` |
| Constraints / notes | `No weekends, focus on systems concepts` |

The CLI calls Claude, validates the result, and writes `plan.json` to the
current directory while printing a readable outline to the terminal.

## Output

### Terminal

```
──────────────────────────────────────────────────────────────
  LEARNING PLAN: RUST PROGRAMMING
──────────────────────────────────────────────────────────────
  Level          : beginner
  Goal           : Build a CLI tool from scratch
  Duration       : 8 weeks
  Hours / week   : 10

  Week 1 — Ownership & Borrowing  (8h)
    • Read The Book chapters 1–4  [4h]
      Deliverable: Personal summary notes
    • Complete rustlings exercises  [4h]
      Deliverable: All exercises passing
    ✓ Checkpoint: Explain ownership without notes
```

### plan.json

```json
{
  "topic": "Rust programming",
  "level": "beginner",
  "goal": "Build a CLI tool from scratch",
  "weeks": 8,
  "hours_per_week": 10,
  "plan": [ ... ]
}
```

## Validation

LearnPlan checks every plan for three invariants:

1. `plan.length === weeks`
2. For every week: `week.hours === sum(task.effort_hours)`
3. For every week: `week.hours <= hours_per_week`

If any invariant fails, Claude is asked once more to produce a corrected plan.

## Project Structure

```
src/
  index.ts   CLI entry point — prompts, orchestration, output
  llm.ts     Claude API calls (streaming, adaptive thinking, retry)
  schema.ts  Zod schemas + business-logic validation
tests/
  schema.test.ts  Unit tests for schema & validatePlan
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run the CLI |
| `npm run typecheck` | TypeScript type-check (no emit) |
| `npm test` | Run the Vitest test suite |
| `npm run build` | Compile to `dist/` |
