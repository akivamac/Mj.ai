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

## Generator (v42, Phase 1)
Joe can produce new text on prompts like "tell me a story". Templates use `{POS:theme}` slots filled from the dictionary. Within one template, repeated `{NOUN:...}` slots bind to the same word (so characters/places stay consistent); adjectives/verbs/adverbs/connectors vary freely. Phase 1 ships ~20 templates and ~60 words.

## Brain versioning
Bump `BRAIN_VERSION` in `brain.js` whenever any brain JSON file changes.
Currently: `'42'`

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
