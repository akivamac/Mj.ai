# Mj.ai — Claude Notes

## Project
Browser-based AI chat app ("Monkey Joe"). Pure vanilla JS, no backend framework.
Served as static files. Auth gate with invite codes, login, signup.

## Key files
- `index.html` — main app + auth gate UI and logic
- `js/brain.js` — all response logic (greetings, identity, knowledge lookup, search, story-intent routing)
- `js/generator.js` — slot-filler text generator (stories — Phase 1 of v42 build)
- `js/chat.js` — chat rendering and history
- `js/app.js` — entry point, wires up UI events
- `brain/knowledge.json` — facts Joe knows
- `brain/rules.json` — greetings, emotions, rules
- `brain/terminal.json` — terminal command knowledge
- `brain/coding.json` — programming/coding facts
- `brain/templates.json` — sentence-skeleton templates for generator
- `brain/dictionary.json` — tagged vocabulary (pos + themes + tone) for generator
- `brain/responseFlavors.json` — leadIns / signOffs / responseWraps for fact flavoring
- `brain/mathTutorials.json` — 156 math concept explainers + walker bindings
- `brain/mathFlavors.json` — one-line garnishes for math compute answers
- `brain/scienceTutorials.json` — 173 science concept explainers, 27 with formula computers
- `brain/scienceFlavors.json` — one-line garnishes for science answers
- `js/math.js` — math engine (evaluator, equations, stats, prime, calculus, matrices)
- `js/mathWalkers.js` — 12 step-walker pure functions for showing math work
- `js/memory.js` — cross-session memory (usage + facts split, see below)
- `js/drawAnalyzer.js` — quantitative pixel analysis for drawings (browser only)
- `config.js` — admin password and config (not committed)
- `settings.html` — settings page

## Generator (v54 — Phase 1/2 mega upgrade)
Joe procedurally generates stories. Templates use `{POS:theme}` slots filled from the dictionary. Within one template, repeated `{NOUN:theme}` slots bind to the same word.

- **Vocabulary (v54)**: ~2756 words in `brain/dictionary.json`. Themes: `character`, `animal`, `place`, `object`, `food`, `plant`, `sky`, `profession`, `vehicle`, `structure`, `mythical_creature`, `mineral`, `time`, `weather`, `sea_creature`, `forest`, `season`, `jungle`, `meadow`, `body_of_water`, `time_period`, `weather_event`, `celestial`, `sound`, `smell`, `texture`, `appearance`, `quality`, `personality`, `mood`, `size`, `age`, `color`, plus verb themes (`action`, `movement`, `sound`, `feeling_verb`).
- **Tone matching**: mood keywords filter templates and prefer tone-tagged words. Tones: `silly | spooky | adventure | cozy | magical | bittersweet | triumphant | mysterious | whimsical | wistful` (+ `bedtime` keyword alias for cozy). See `detectStoryTone` in `brain.js` and `_detect_story_tone` in `mj`.
- **Fact-weaving**: when the prompt names a known subject (`story about elephants`), Joe weaves the matching fact into a `factStories` template. When the user asks for a toned story without a subject, `pickToneAwareFact` scores facts by keyword overlap so spooky fact-stories pull wolf/cave/midnight facts, not capital cities.
- **Story sessions**: `_storySession` (JS) / `self.story_session` (Python) persists `{tone, subject, character, place, chapter, chapterMode, mode}`. Continuations / `chapter N` / `another` re-use it. Reset phrases (`end the story`, `new story`) clear it.
- **Beat-chain mode (v54)**: `brain/storyBeats.json` holds 270 beats across 9 types (opening/discovery/encounter/conflict/twist/resolution/closing + `atmosphere` + `voice`). `generateBeatStory()` walks the graph for 4–6 hops, locking character/place across beats. In-chain `usedBeatIds` plus a 20-deep `recentBeatIds` ring buffer prevent beat repetition. Triggered by "longer story", "weave me a tale", "epic adventure".
- **Micro mode**: `templates.microStories` holds 60 single-sentence stories. Triggered by "short(er) story", "just one line", "micro story".
- **Closers (v54)**: 50 tone-tagged story-ending phrases in `templates.closers`. Appended ~40% of regular stories and always at the end of beat chains. Now run through `fillTemplate` so slot syntax in closers is rendered. Dedup: 5-deep stem-set ring (drops closers sharing a 5+-char content word with recent ones) + verbatim-text ring (catches all-short-word closers the stem check misses).
- **Pacing beats**: 25 short connectors in `templates.pacingBeats`. Coin-flip inserted between beats in beat-chain mode.
- **De-repetition**: per-slot 30-word recent-list in the generator avoids successive picks of the same word for the same slot.
- **Pluralization (v51 fix)**: `irregularPlurals` map (jellyfish, octopus, wolf, mouse, etc.) + general rules (`-y→ies`, `-s/x/z/ch/sh→es`, `-f/fe→ves` with exceptions). Applied when a `NOUN` slot is followed by a trailing `s` in the template (the regex captures `}s\b` and routes through `pluralize()`).
- **Fact truncation (v51 fix)**: `factSnippet()` strips parentheticals containing digits, takes only the first sentence, and caps at 120 chars on a word boundary.
- **Public slot-fill API (v53)**: `Generator.fillSlots(text, opts)` renders a single template string for callers like the response-flavoring system that don't want to invoke the full story-picking pipeline. Python mirror: just call `_fill_template` directly.
- **Trigger expansion**: `tell|make|share|spin|weave a {story|tale|adventure|book|fable|legend|yarn|bedtime story}`, `another` / `one more`, `tell me about a {ADJ} {NOUN}` (micro), `longer/shorter` modifiers, `chapter N`.

Pools (v54): 550 stories + 80 factStories + 100 continuations + 60 microStories + 50 closers + 25 pacingBeats + 270 beats.

**Backside note:** `templates.json`, `dictionary.json`, `storyBeats.json` are static assets fetched directly by the browser. They do NOT need to be uploaded via `upload_brain.py` — that script only mirrors facts (`knowledge.json`, `coding.json`) to the Backside API.

**CLI parity:** The Python `mj` CLI now ports the full story generator. `update_brain()` fetches templates/dictionary/storyBeats on auto-update alongside the older brain files.

## Coding helper (v51 — error/recipe/debug/code-paste dispatch)
Joe now handles four coding-related input types BEFORE the generic knowledge lookup, both in the web `respond()` and the CLI `respond()`. Order: error > code-paste > debugging walkthrough > recipe.

- **`brain/errors.json`** (409 patterns): error-string matchers. Each entry has a JS regex (`match`), `title`, `diagnosis`, `fixes[]`, optional `example_fix`. `{1}`/`{2}` placeholders substitute regex capture groups so the diagnosis names the actual variable/path/module from the user's error.
- **`brain/recipes.json`** (307 recipes): "how do I X in Y" snippets. Each has `triggers[]` (lowercase phrasings), `title`, `code`, `notes`. Matched via the `findByTriggers` scorer.
- **`brain/debugging.json`** (134 guides): procedural walkthroughs. Each has `triggers[]`, `title`, `steps[]`, `tips[]`.
- **`brain/coding.json`** (909 facts, v54): the existing fact-keyword lookup — still the final coding fallback. Phase 4 added ~218 entries covering modern tooling (Bun, Deno 2, Biome, Oxlint, Turbopack, uv, Ruff, Mise, pnpm, esbuild, Rspack, Vite, Vitest, Astro, Tauri, +more), AI/ML engineering (transformer mechanics, attention, backprop, GPUs vs CPUs, quantization, LoRA, RAG, embeddings, BPE, sampling, KV cache, flash attention, MoE), systems & networking (CFS scheduling, context switches, TCP congestion control, DNS / TLS step-by-step, HTTP/2 vs /3, epoll/io_uring, cgroups/namespaces, OCI), databases (B-tree, MVCC, WAL, PgBouncer, VACUUM, WiredTiger, LSM, sharding, replication, CTEs, jsonb), architecture patterns (strangler fig, CQRS, event sourcing, outbox, saga, BFF, circuit breaker, service mesh), security (SQL injection mechanics, timing attacks, bcrypt cost factor, OAuth PKCE, CORS, CSRF, XSS, Diffie-Hellman), and bonus topics (WebSockets, SSE, gRPC, WASM, git internals, Kubernetes, eBPF, observability).

The `findByTriggers` scorer: substring-match of a multi-word trigger = 3, single-word substring = 2, all-words-of-2+-word-trigger present = 1. Recipes fire at minScore 1; debug walkthroughs require minScore 2 (avoids false-positive walls of text).

`looksLikeCode` triggers on ```` ``` ```` fences, 3+ lines with code-token indicators, or a single line with strong-bash signals (`$(...)` + `do/done/then/fi/...` or shebang). `detectLanguage` scores against signature regexes for 10 languages. `critiqueCode` runs generic bracket-balance + per-language pattern checks (Py: mixed indent / missing colon / Py2 print / bare except. JS: == vs ===, var, await without async, stale-closure setState. Bash: unquoted `$X` in `[`, backticks, missing `set -e`, `for x in $(ls)`).

## Cross-session memory (v57 — hybrid with the split)
Joe remembers across sessions. Two stores in one localStorage key (`mj_memory`) / `~/.mj_memory.json`:

- **`facts`** — what the user explicitly told Joe via `remember that my X is Y` / `remember that I love X` / `remember this for later: X`. Set / get / forget commands. PII rejected by regex.
- **`usage`** — anonymous behavior counts: `session_count`, `topic_counts`, `tone_counts`, `dispatcher_counts`, `recent_subjects` (10-slot ring), `last_story` snapshot.

**The split is the design**: implicit data only describes the conversation ("we did wolves last time"), never the user ("you like wolves"). Welcome-back greetings cite `last_story` or `recent_subjects`; fact recall always sources the user ("you told me your cat is Felix"). That line never gets crossed.

Memory commands (handled at the top of `respond()` so they always win):
- `remember that my X is Y` → setFact
- `remember that I love X` → about_me list (comma-appended)
- `remember this for later: X` → timed note
- `do you remember my X` / `what's my X` → getFact
- `what do you remember` / `what do you know about me` → summary (lists everything Joe stores)
- `forget about my X` → forgetFact
- `forget everything` → asks for `yes` confirmation, then wipes both stores

Implicit hooks: `Brain.load()` calls `Memory.tickSession()`. The knowledge-fact path calls `Memory.recordTopic(bestFact.keywords[0])`. The greeting handler swaps to `Memory.formatWelcomeBack()` when `session_count > 1` and `last_session > 24h` ago. Welcome hint shows exactly once (`welcome_hint_shown` flag).

Privacy: `PII_REJECT_RE` blocks password/ssn/credit-card/address inputs from facts. No network. 365-day inactivity TTL. Caps on counts and map sizes.

## Drawing analysis (v58 — quantitative + conversational + story payoff)
`js/drawAnalyzer.js` does single-pass O(n) pixel analysis on the canvas: top colors (kid-friendly HSL bucketing), coverage, color temperature (warm/cool/mixed), position label, busiest 3x3 zone, vertical symmetry score, intensity (tiny/sparse/medium/busy), and mood (cozy/mysterious/spooky/adventure — derived from temp + darkness + busyness). Plus stroke stats (count + duration) tracked via pointer-event hooks in `js/draw.js`.

Three-turn flow at the TOP of `respond()` (drawing wins over everything):

1. **Turn 1**: `Chat.processResponse('__DRAWING__:' + JSON)` lands → analysis decoded → `_drawingContext` set with `awaitingDescription=true` → Joe returns warm observation framed as friendly language (NOT numbers), ending with "What is it? 🐒".
2. **Turn 2**: user describes → `_drawingExtractNoun` strips "it's a/my/the" lead-ins → enthusiastic react + follow-up question ("dog! Want me to spin a tiny story about it?").
3. **Turn 3**: user says yes / sure / tell me a story → `Generator.generateStory({subject: noun, mode:'micro', tone: analysis.mood})` returns a micro-story payoff. Drawing context graduates into a `_storySession` so "another" / "longer story" continue with the same subject.

5-minute context timeout; "i don't know" graceful release; empty-canvas branch.

**Both image buttons share this flow (v59).** The ✏️ pad (`draw.js`) and the 📷 "Examine a photo" button (`photo.js`) both run `DrawAnalyzer.analyze` and send the `__DRAWING__:` envelope. The photo modal also has a description field; when the user types one, it rides along as `analysis.describedAs`, and turn 1 collapses 1+2 — Joe observes the drawing AND reacts to the description AND offers a story in one reply (skips "what is it?"). Description-only (no canvas marks) → `{empty:true, describedAs}` → react + offer with no observation. `_drawingReact` drops drawing-presuming openers ("fits the colors perfectly") when the analysis is empty.

Browser-only — `mj` CLI has no canvas, so no Python mirror.

## Science system (v56 — FREAKY good at science)
Mirrors the v55 math system architecture: 3-intent dispatcher (SCIENCE_TEACH | SCIENCE_DEFINE | SCIENCE_FORMULA), tutorial bank, formula compute, voice layer. Slot order in `respond()`: greetings/story/coding/math/**science**/terminal/knowledge.

- **SCIENCE_TEACH/DEFINE**: routes to `brain/scienceTutorials.json` (173 entries — physics 58, chemistry 26, biology 43, astronomy 24, earth 14, scientific method 5, medicine 3). Triggered by "how does X work" / "explain X" / "what is X" + a science keyword from a ~120-item curated list (force, mass, photon, cell, DNA, planet, etc.).
- **SCIENCE_FORMULA**: 27 of the tutorials carry a `formula` block with a `compute` string + typed `variables` (name + label + unit) + `result_label` + `result_unit`. Triggered by formula-shorthand like `F=ma with m=5 a=3` or `kinetic energy with m=2 v=10`. `_extractNamedNumbers` maps user-supplied values to variable names, substitutes into the compute string, evaluates via `MathEngine.evaluateExpression`. Formulas covered: F=ma, KE, PE, momentum, work, power, centripetal, pendulum, Coulomb's law, Ohm's law, P=I²R, v=fλ, PV=nRT, Q=mcΔT, E=hf, λ=h/p, E=mc², Schwarzschild radius, pH/pOH, molarity, dilution, half-life, Hubble's law, pressure, density.
- **Voice layer**: `brain/scienceFlavors.json` — 58 garnishes (15 physics, 10 chem, 10 bio, 10 astro, 5 earth, 5 generic, 3 bonus). Same match-type machinery as math flavors. 20% fire rate on SCIENCE_FORMULA responses; teach/define already end on their tryIt prompt.

`findByTriggers` / `_find_by_triggers` fix (also v56): trigger matching now uses word-boundary checks (`_wordContains` / `_word_contains`) so short triggers like `ph` no longer match inside longer words like `photosynthesis`. Fixes a real false-positive caught during science smoke testing.

## Knowledge base (v56)
`brain/knowledge.json` holds 1486 facts (v56 added ~516 across science). Coverage: marine biology, geology, physics, astronomy, biology (CRISPR, chameleon color, monarch navigation, octopus hearts), history (Mesopotamia, Silk Road, Maya/Inca/Byzantine/Ottoman), culture (etymologies, music genre origins, pigment history), psychology (cognitive biases, mirror neurons), tech history (microwave, post-it, ENIAC, transistor, WWW), geography surprise facts, ~80 animal record-holders and superpowers, mathematics (Banach-Tarski, Monty Hall, Gödel, infinities), full-stack physics + chemistry + biology + astronomy + earth science added in v56.

## Knowledge base (v54 — Phase 4)
`brain/knowledge.json` holds 970 facts (Phase 4 added ~472). Coverage: marine biology, geology, physics, astronomy, biology (CRISPR, chameleon color, monarch navigation, octopus hearts), history (Mesopotamia, Silk Road, Mongol Yam, printing press, Maya/Inca/Byzantine/Ottoman), culture (etymologies, music genre origins, pigment history), psychology (cognitive biases with concrete examples, rubber-hand illusion, mirror neurons), tech history (microwave, post-it, ENIAC, transistor, WWW), geography surprise facts, ~80 animal record-holders and superpowers, mathematics (Banach-Tarski, Monty Hall, Gödel, infinities), plus food/drink/inventions/body bonus.

## Math system (v55 — FREAKY good at math)
Joe gets a 4-intent math dispatcher slotted between coding and knowledge in `respond()`:

- **COMPUTE**: bare expression → answer. `25% of 80 → 20`. Uses `MathEngine.evaluateExpression` (recursive-descent Pratt parser, no eval, degree-aware trig, factorial, percentages, NL preprocessing, π/e), `convertUnit` (7 categories), and helpers for stats / prime / factor / equation.
- **WORKED**: same compute + step-by-step work shown. Triggered by "show your work", "step by step", "show me", "with steps". Equations *always* show work.
- **TEACH**: concept explainer from `brain/mathTutorials.json` (156 entries). Triggered by "explain X", "how do X work", "i don't get X", "confused about X". If user supplied numbers, the tutorial's `walker` runs them through `js/mathWalkers.js`.
- **DEFINE**: short one-paragraph definition. Triggered by "what is/define X". Also catches bare math-noun phrases ("pythagorean theorem", "quadratic formula").

Math engines:
- `js/math.js` — JS engine. `MathEngine.{evaluateExpression, convertUnit, solveEquation, summarize, isPrime, primeFactor, gcd, lcm, choose, permute, tip, discount, percentChange, polyDerivative, polyIntegral, Matrix2, solveLinearSystem2}`. Equation solving uses a 3-point sampling trick: evaluate `f(x) = LHS - RHS` at x = 0, 1, -1, back out (a, b, c) for `ax² + bx + c = 0`, dispatch on whether a is zero. Miller-Rabin primality test is deterministic for n < 3.3e14.
- `mj` Python: full mirror as a `MathEngine` class (stdlib only — math, statistics, re, fractions).

Step-walkers (`js/mathWalkers.js` + Python `MathWalkers` class) — 12 pure functions returning `{answer, steps: [{label, calc, result?}]}`:
- `walkArithmetic`, `walkPercent`, `walkLinearEq`, `walkQuadratic`, `walkFractionOp`, `walkPrimeFactor`, `walkLongDivision`, `walkUnitConvert` (kid-tier)
- `walkPolyDerivative`, `walkPolyIntegral`, `walkMatrix2x2`, `walkLinearSystem2` (adult-tier)

Voice layer:
- `brain/mathFlavors.json` — 49 one-line garnishes across four match types: `answer_equals` (specific values like 144 → "a gross"), `answer_contains` (irrational constants), `input_contains` (keywords like "25%", "sqrt"), `any` (generic asides). 20% chance per COMPUTE/WORKED response. Respects the existing SKIP_FLAVOR_WORDS gate so `just 25% of 80` doesn't get garnished.

Scope cuts (deliberate): no general CAS, no symbolic simplification past collecting like terms in {1, x, x²}, no calculus past polynomial differentiation/integration, no matrices past 2×2, no graphing, no word-problem NLP.

## Response flavoring (v53 — Phase 3)
Three mechanics make Joe feel less like a lookup table:

1. **Fact-answer flavoring**: 25% chance to wrap a knowledge response in a lead-in / sign-off / before-after-sandwich from `brain/responseFlavors.json` (40 leadIns + 40 signOffs + 20 responseWraps, slot-templated like `templates.json`). Drops to 5% if recently flavored. Skip-words (`just`, `quick`, `briefly`, `short`, `tldr`, `tl;dr`) turn it off. Never flavors IDK / search / file / push responses.
2. **Procedural personality beats**: 30% chance to prepend a one-sentence microStory to greetings, the IDK fallback, and ~26 of the conversational rules in `rules.json` marked with `procedural: true`. (Web-only for per-rule flag; the Python `mj` CLI doesn't iterate the rules array, so it gets the procedural treatment on greetings and IDK only.)
3. **Story-from-fact hook**: after a strong fact hit, 15% chance to append "Want a story about that? Just say 'tell me a story about it' 🐒". The hooked subject + keywords persist for 2 turns. A short affirmative ("yes", "sure", "tell me a story about it") within that window triggers a fact-woven story about the subject.

State is module-level (JS) / instance-level (Python): `_recentFlavorAge`, `_storyHookSubject`, `_storyHookKeywords`, `_storyHookAge`. Both tick at the top of every `respond()`.

## Brain versioning
Bump `BRAIN_VERSION` in `brain.js` whenever any brain JSON file OR any local `js/*.js` changes (it doubles as the asset cache-bust version — see below).
Currently: `'100'`

## Dead-input failure class (recurred twice — don't reintroduce)
Symptom: send button does nothing, Enter inserts a newline. Cause is always
the same shape: something throws inside `app.js`'s DOMContentLoaded handler
*before* the input listeners attach. Triggers so far: (1) stale cached JS
from a missed `?v=` bump, (2) `QuotaExceededError` from `Storage.setBrain`
once the brain JSONs (>10MB) outgrew the ~5MB localStorage quota.
Guards now in place — keep both when editing:
- `js/app.js`: listener wiring comes FIRST, init chain is wrapped in
  try/catch. Never move listener setup after an `await`.
- `js/storage.js`: `setBrain` is best-effort (try/catch + evict-and-retry).
  localStorage caching of brain files is an optimization, never a
  correctness requirement — `Brain.load()` must work from fetch alone.

## Cache-busting (important)
`index.html` loads every local `js/*.js` with a `?v=NN` query string that
must match `BRAIN_VERSION`. GitHub Pages + browsers cache JS aggressively;
without the bump, users get **stale JavaScript** (e.g. a drawing falling
through to a random knowledge fact because the cached `brain.js` predates
the `__DRAWING__:` handler). When you bump `BRAIN_VERSION`, also bump every
`?v=` in `index.html` (one sed: `s/\.js?v=[0-9]*/.js?v=NN/`). Tell the user
to hard-refresh (Cmd/Ctrl+Shift+R) after a deploy if they see old behavior.

## Deploy workflow
```bash
git add <files>
git commit -m "type: description"
git push
cp ~/github-projects/Mj.ai/mj ~/bin/mj
```

## Termux notes
- `/tmp` does not exist — use tmux sessions to switch and run git/deploy commands
- Use `~/bin/mj` as the installed script location
