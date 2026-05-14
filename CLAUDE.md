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
- `config.js` — admin password and config (not committed)
- `settings.html` — settings page

## Generator (v50 — massive expansion)
Joe procedurally generates stories. Templates use `{POS:theme}` slots filled from the dictionary. Within one template, repeated `{NOUN:theme}` slots bind to the same word.

- **Vocabulary (v50)**: ~1940 words in `brain/dictionary.json`. New themes alongside the originals: `profession`, `sound`, `texture`, `smell`, `vehicle`, `structure`, `mythical_creature`, `plant`, `mineral`, `celestial`.
- **Tone matching**: mood keywords filter templates and prefer tone-tagged words. Tones: `silly | spooky | adventure | cozy | magical | bittersweet | triumphant | mysterious | whimsical | wistful` (+ `bedtime` keyword alias for cozy). See `detectStoryTone` in `brain.js` and `_detect_story_tone` in `mj`.
- **Fact-weaving**: when the prompt names a known subject (`story about elephants`), Joe weaves the matching fact into a `factStories` template. When the user asks for a toned story without a subject, `pickToneAwareFact` scores facts by keyword overlap so spooky fact-stories pull wolf/cave/midnight facts, not capital cities.
- **Story sessions**: `_storySession` (JS) / `self.story_session` (Python) persists `{tone, subject, character, place, chapter, chapterMode, mode}`. Continuations / `chapter N` / `another` re-use it. Reset phrases (`end the story`, `new story`) clear it.
- **Beat-chain mode (v50)**: `brain/storyBeats.json` holds 103 beats across 7 types (opening/discovery/encounter/conflict/twist/resolution/closing). `generateBeatStory()` walks the graph for 4–6 hops, locking character/place across beats. Triggered by "longer story", "weave me a tale", "epic adventure".
- **Micro mode (v50)**: `templates.microStories` holds 30 single-sentence stories. Triggered by "short(er) story", "just one line", "micro story".
- **Closers (v50)**: ~29 tone-tagged story-ending phrases in `templates.closers`. Appended ~40% of regular stories and always at the end of beat chains.
- **Pacing beats (v50)**: ~14 short connectors ("And then...", "Without warning...") in `templates.pacingBeats`. Coin-flip inserted between beats in beat-chain mode.
- **De-repetition (v50)**: per-slot 30-word recent-list in the generator avoids successive picks of the same word.
- **Trigger expansion**: `tell|make|share|spin|weave a {story|tale|adventure|book|fable|legend|yarn|bedtime story}`, `another` / `one more`, `tell me about a {ADJ} {NOUN}` (micro), `longer/shorter` modifiers, `chapter N`.

Pools: 305 stories + 42 factStories + 63 continuations + 30 microStories + 29 closers + 14 pacingBeats + 103 beats.

**Backside note:** `templates.json`, `dictionary.json`, `storyBeats.json` are static assets fetched directly by the browser. They do NOT need to be uploaded via `upload_brain.py` — that script only mirrors facts (`knowledge.json`, `coding.json`) to the Backside API.

**CLI parity:** The Python `mj` CLI now ports the full story generator. `update_brain()` fetches templates/dictionary/storyBeats on auto-update alongside the older brain files.

## Coding helper (v51 — error/recipe/debug/code-paste dispatch)
Joe now handles four coding-related input types BEFORE the generic knowledge lookup, both in the web `respond()` and the CLI `respond()`. Order: error > code-paste > debugging walkthrough > recipe.

- **`brain/errors.json`** (409 patterns): error-string matchers. Each entry has a JS regex (`match`), `title`, `diagnosis`, `fixes[]`, optional `example_fix`. `{1}`/`{2}` placeholders substitute regex capture groups so the diagnosis names the actual variable/path/module from the user's error.
- **`brain/recipes.json`** (307 recipes): "how do I X in Y" snippets. Each has `triggers[]` (lowercase phrasings), `title`, `code`, `notes`. Matched via the `findByTriggers` scorer.
- **`brain/debugging.json`** (134 guides): procedural walkthroughs. Each has `triggers[]`, `title`, `steps[]`, `tips[]`.
- **`brain/coding.json`** (691 facts): the existing fact-keyword lookup — still the final coding fallback. Expanded in v51 with Python typing/asyncio/pandas, JS event loop/streams, TS narrowing/utility types, bash strict mode, git internals, testing/CI/algorithms.

The `findByTriggers` scorer: substring-match of a multi-word trigger = 3, single-word substring = 2, all-words-of-2+-word-trigger present = 1. Recipes fire at minScore 1; debug walkthroughs require minScore 2 (avoids false-positive walls of text).

`looksLikeCode` triggers on ```` ``` ```` fences, 3+ lines with code-token indicators, or a single line with strong-bash signals (`$(...)` + `do/done/then/fi/...` or shebang). `detectLanguage` scores against signature regexes for 10 languages. `critiqueCode` runs generic bracket-balance + per-language pattern checks (Py: mixed indent / missing colon / Py2 print / bare except. JS: == vs ===, var, await without async, stale-closure setState. Bash: unquoted `$X` in `[`, backticks, missing `set -e`, `for x in $(ls)`).

## Brain versioning
Bump `BRAIN_VERSION` in `brain.js` whenever any brain JSON file changes.
Currently: `'51'`

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
