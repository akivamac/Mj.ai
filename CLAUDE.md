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

## Knowledge base (v54 — Phase 4)
`brain/knowledge.json` holds 970 facts (Phase 4 added ~472). Coverage: marine biology, geology, physics, astronomy, biology (CRISPR, chameleon color, monarch navigation, octopus hearts), history (Mesopotamia, Silk Road, Mongol Yam, printing press, Maya/Inca/Byzantine/Ottoman), culture (etymologies, music genre origins, pigment history), psychology (cognitive biases with concrete examples, rubber-hand illusion, mirror neurons), tech history (microwave, post-it, ENIAC, transistor, WWW), geography surprise facts, ~80 animal record-holders and superpowers, mathematics (Banach-Tarski, Monty Hall, Gödel, infinities), plus food/drink/inventions/body bonus.

## Response flavoring (v53 — Phase 3)
Three mechanics make Joe feel less like a lookup table:

1. **Fact-answer flavoring**: 25% chance to wrap a knowledge response in a lead-in / sign-off / before-after-sandwich from `brain/responseFlavors.json` (40 leadIns + 40 signOffs + 20 responseWraps, slot-templated like `templates.json`). Drops to 5% if recently flavored. Skip-words (`just`, `quick`, `briefly`, `short`, `tldr`, `tl;dr`) turn it off. Never flavors IDK / search / file / push responses.
2. **Procedural personality beats**: 30% chance to prepend a one-sentence microStory to greetings, the IDK fallback, and ~26 of the conversational rules in `rules.json` marked with `procedural: true`. (Web-only for per-rule flag; the Python `mj` CLI doesn't iterate the rules array, so it gets the procedural treatment on greetings and IDK only.)
3. **Story-from-fact hook**: after a strong fact hit, 15% chance to append "Want a story about that? Just say 'tell me a story about it' 🐒". The hooked subject + keywords persist for 2 turns. A short affirmative ("yes", "sure", "tell me a story about it") within that window triggers a fact-woven story about the subject.

State is module-level (JS) / instance-level (Python): `_recentFlavorAge`, `_storyHookSubject`, `_storyHookKeywords`, `_storyHookAge`. Both tick at the top of every `respond()`.

## Brain versioning
Bump `BRAIN_VERSION` in `brain.js` whenever any brain JSON file changes.
Currently: `'54'`

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
