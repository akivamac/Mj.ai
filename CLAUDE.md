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

## Generator (v44, Phase 3)
Joe can produce new text on prompts like "tell me a story", "tell me a silly story", "tell me a story about elephants". Templates use `{POS:theme}` slots filled from the dictionary. Within one template, repeated `{NOUN:...}` slots bind to the same word (so characters/places stay consistent); other parts of speech pick freshly.

- **Tone matching** (Phase 2): when the user asks for a `silly | spooky | adventure | cozy | magical` story, Joe filters templates to that tone and prefers tone-tagged words. See `detectStoryTone` in `brain.js`.
- **Fact-weaving** (Phase 3): when the prompt names a subject Joe knows (e.g. "story about an elephant"), Joe pulls the matching fact from `knowledge.json` / `coding.json` and uses a fact-weaver template (the `factStories` array) that includes a `{FACT}` slot. If the subject is also a known dictionary noun (e.g. "elephant"), it's locked into `{NOUN:character}` so the protagonist matches. Subject extraction handles "story about X" and "an X story". Unknown subjects → regular toned story, no fact.

Templates: 51 regular + 6 fact-weavers in `brain/templates.json`.
Dictionary: ~470 words in `brain/dictionary.json` (pos + themes + tone).

## Brain versioning
Bump `BRAIN_VERSION` in `brain.js` whenever any brain JSON file changes.
Currently: `'44'`

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
