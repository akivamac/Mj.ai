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

## Generator (v46, Phase 5 — polish)
Joe can produce new text and continue stories across multiple turns. Templates use `{POS:theme}` slots filled from the dictionary. Within one template, repeated `{NOUN:...}` slots bind to the same word.

- **Tone matching** (Phase 2): mood keywords (`silly | spooky | adventure | cozy | magical | bedtime`) filter templates and prefer tone-tagged words. See `detectStoryTone` in `brain.js`.
- **Fact-weaving** (Phase 3): when the prompt names a known subject (`story about elephants`, `story about javascript`), Joe weaves the matching fact from `knowledge.json` / `coding.json` into a `factStories` template. Subject is locked into `{NOUN:character}` when it's also a known dictionary noun.
- **Story sessions** (Phase 4): after generating any story, Joe stores `{character, place, tone, chapter}` in `_storySession`. Follow-ups like `continue`, `keep going`, `what happens next`, `tell me more` use the `continuations` template array with the saved character/place — protagonist and setting persist. Reset phrases (`end the story`, `new story`) clear the session. Chapter mode prefixes `**Chapter N**` headers and auto-increments on continuations.
- **Polish** (Phase 5): a/an grammar fix as a post-processing step in the generator. Empty-pool guard — if a slot's theme has no matching words, falls back to any word of that pos. Removed the one template that placed a past-tense verb after `could`.

Templates: 51 regular + 6 fact-weavers + 15 continuations in `brain/templates.json`.
Dictionary: ~470 words in `brain/dictionary.json` (pos + themes + tone).

**Backside note:** `templates.json` and `dictionary.json` are static assets fetched directly by the browser. They do NOT need to be uploaded via `upload_brain.py` — that script only mirrors facts (`knowledge.json`, `coding.json`) to the Backside API.

## Brain versioning
Bump `BRAIN_VERSION` in `brain.js` whenever any brain JSON file changes.
Currently: `'46'`

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
