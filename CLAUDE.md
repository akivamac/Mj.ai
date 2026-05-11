# Mj.ai — Claude Notes

## Project
Browser-based AI chat app ("Monkey Joe"). Pure vanilla JS, no backend framework.
Served as static files. Auth gate with invite codes, login, signup.

## Key files
- `index.html` — main app + auth gate UI and logic
- `js/brain.js` — all response logic (greetings, identity, knowledge lookup, search)
- `js/chat.js` — chat rendering and history
- `js/app.js` — entry point, wires up UI events
- `brain/knowledge.json` — facts Joe knows
- `brain/rules.json` — greetings, emotions, rules
- `brain/terminal.json` — terminal command knowledge
- `config.js` — admin password and config (not committed)
- `settings.html` — settings page

## Brain versioning
Bump `BRAIN_VERSION` in `brain.js` whenever any brain JSON file changes.
Currently: `'33'`

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
