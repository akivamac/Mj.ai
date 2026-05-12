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

## Generator (v43, Phase 2)
Joe can produce new text on prompts like "tell me a story", "tell me a silly story", "tell me a spooky bedtime story", etc. Templates use `{POS:theme}` slots filled from the dictionary. Within one template, repeated `{NOUN:...}` slots bind to the same word (so characters/places stay consistent); other parts of speech pick freshly.

**Tone matching** (Phase 2): when the user asks for a `silly | spooky | adventure | cozy | magical` story, Joe filters templates to that tone and prefers tone-tagged words for adjectives/verbs/adverbs. Falls back gracefully if no match. Tone keywords detected in `detectStoryTone` in `brain.js`.

Templates: 51 entries in `brain/templates.json` (object form: `{ text, tone }`).
Dictionary: ~470 words in `brain/dictionary.json`, tagged with pos + themes + tone.

## Brain versioning
Bump `BRAIN_VERSION` in `brain.js` whenever any brain JSON file changes.
Currently: `'43'`

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
