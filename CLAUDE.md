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

## Brain versioning
Bump `BRAIN_VERSION` in `brain.js` whenever any brain JSON file changes.
Currently: `'50'`

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
