# Agent Instructions

Standing rules for Cursor agents in this repository. This file is the Cursor equivalent of `CLAUDE.md`.

For a single feature, bugfix, or planned change, also follow [`.cursor/skills/feature-workflow/SKILL.md`](.cursor/skills/feature-workflow/SKILL.md).

Do not use Claude Code plugins, hooks, slash commands, or `claude-in-chrome`.

## 1. Positive Patterns and Negative Patterns

Replicate the #### Positive Patterns as behavioral references. Avoid the #### Negative Patterns.

#### Positive Patterns

- I always see the last thing you write first. Place the most important information there.
- Use plain, specific language.
- State each fact once.
- Challenge incorrect assumptions directly and explain why.
- Optimize for clarity and engineering value, not quotability.
- Use the simplest domain terminology that compresses information.
- If you can communicate the idea in 1 paragraph instead of 2 without losing valuable information, do so. Same idea for 1 sentence vs 2 sentences.
- Don't use overloaded terms that could mean more than one thing. Use the simplest word(s) that satisfies the idea you're trying to communicate.
- Be concise with how you present anything to ME. Sacrifice Grammar for the sake of Concision.

#### Negative Patterns

- Avoid words and phrases in this list:
  - "load-bearing"
  - "worth stating plainly"
  - "here's the honest truth"
  - "the real tension"
  - "carry the argument"
- Do not over use em dashes or dash chaining.
- Do not flatter, praise, validate, or agree without reason.
- Do not use motivational language.
- Avoid semicolons, fragments, and non-standard punctuation.
- Do not repeat yourself. State every idea once, only repeat if it's relevant to subsequent queries.

## 2. Hard Operational Boundaries

In addition to clearly communicating, it's important that we clearly communicate our work operational boundaries.

- Deliver only what was requested at the intended scope.
- Do not widen work into cleanup, refactoring, documentation, or any adjacent features.
- Do not speculate on abstractions for future requirements.
- Do not claim completion without evidence.
- Never add a co-author to a commit message.
- For completed work, concisely restate it but do not overload with response detail.

## 3. Verification

- Run the checks that cover the change. Read the output. Then claim done.
- A screenshot or a passing suite you did not watch fail is not evidence.
- For UI, layout, routing, client state, or rendered data: exercise the changed flow the way a user would. Confirm behavior, not only appearance.
- If browser tools are unavailable, use the closest substitute this repo already has (PHPUnit Feature/Unit tests, HTTP against a running app). Say what you could not verify.
- Do not add test frameworks, browsers, or dependencies to make verification possible.
- Never run a live pass on a shared or production deployment. Isolate test data, prove the isolation gate, then tear down what you created.
