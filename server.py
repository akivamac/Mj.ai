"""
Joe Brain local server.
Runs the model in Python and serves the chat UI on localhost:8080.

Usage:
  python3 server.py
"""

import json
import os
import sys
import numpy as np
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'training'))
from tokenizer import Tokenizer
from model import JoeBrain

DATA = os.path.join(os.path.dirname(__file__), 'data')
PORT = 8080

# ── Load model ────────────────────────────────────────────────────────────────

print("Loading model...")
tok = Tokenizer()
tok.load(os.path.join(DATA, 'tokenizer.json'))
_npz = os.path.join(DATA, 'model.npz')
_json = os.path.join(DATA, 'model.json')
model = JoeBrain.load(_npz if os.path.exists(_npz) else _json)
print(f"Model ready. Vocab={tok.size}, params={sum(v.size for v in model.p.values()):,}")

# Ban non-ASCII token IDs
BANNED = set(i for ch, i in tok.char_to_id.items() if ord(ch) > 127)

def build_prompt(history, msg):
    """
    Build a prompt from conversation history + new message.
    Sliding window: trim oldest turns if prompt exceeds seq_len tokens.
    history: list of [role, text] pairs (role = 'user' or 'joe')
    """
    seq_len = model.T
    # Reserve tokens for the new message + "Joe:" suffix + some headroom
    new_turn = f"User: {msg}\nJoe:"
    new_ids = tok.encode(new_turn)
    budget = seq_len - len(new_ids) - 2  # tokens available for history

    # Build history lines newest-first, then reverse
    lines = []
    for role, text in history:
        prefix = "User" if role == "user" else "Joe"
        lines.append(f"{prefix}: {text}")

    # Greedily include as many recent history lines as fit
    included = []
    used = 0
    for line in reversed(lines):
        cost = len(tok.encode(line + "\n"))
        if used + cost > budget:
            break
        included.append(line)
        used += cost

    included.reverse()
    history_text = "\n".join(included)
    if history_text:
        return history_text + "\n" + new_turn
    return new_turn


def sample_logits(logits, ids, top_k, temperature):
    logits = np.array(logits)

    # Ban non-ASCII
    for bid in BANNED:
        if bid < len(logits):
            logits[bid] = -1e9

    # Ban tokens seen 3+ times in last 10
    recent = ids[-10:]
    counts = {}
    for rid in recent:
        counts[rid] = counts.get(rid, 0) + 1
    for rid, cnt in counts.items():
        if cnt >= 3:
            logits[rid] = -1e9

    # Top-k
    if top_k > 0:
        top_k_idx = np.argpartition(logits, -top_k)[-top_k:]
        mask = np.full_like(logits, -1e9)
        mask[top_k_idx] = logits[top_k_idx]
        logits = mask

    logits = logits - logits.max()
    probs = np.exp(logits / temperature)
    probs /= probs.sum()
    return int(np.random.choice(len(probs), p=probs))


def generate_stream(prompt, max_new=120, temperature=0.9, top_k=40):
    """Yields one character at a time using KV cache for speed."""
    ids = tok.encode(prompt)
    seq_len = model.T

    # Use natural prompt length (no padding) so new tokens get fresh positions
    prompt_ids = ids[-seq_len:]
    prompt_len = len(prompt_ids)

    # Prefill: run full prompt, get KV cache + logits for last position
    ctx = np.array(prompt_ids, dtype=np.int32)
    logits, kv_cache = model.prefill(ctx)

    generated = 0
    position = prompt_len  # next generated token goes at this position

    for _ in range(max_new):
        next_id = sample_logits(logits, ids, top_k, temperature)
        ids.append(next_id)

        ch = tok.id_to_char.get(next_id, '')
        if ch == '\n' and generated > 5:
            break
        if ord(ch) <= 127:
            yield ch
            generated += 1

        if position < seq_len:
            # KV cached single-token forward
            logits, kv_cache = model.forward_one(next_id, position, kv_cache)
            position += 1
        else:
            # Exceeded seq_len, fall back to full forward (no cache)
            ctx = np.array(ids[-seq_len:], dtype=np.int32)
            full_logits, _ = model.forward(ctx)
            logits = np.array(full_logits[-1])


# ── HTTP handler ──────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # silence access log

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/chat':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
            except Exception:
                self._json({'error': 'invalid json'}, 400)
                return
            msg = (data.get('msg') or '').strip()
            if not msg:
                self._json({'error': 'no message'}, 400)
                return
            history = data.get('history', [])
            temperature = float(data.get('temperature', 0.9))
            max_new = int(data.get('max_new', 120))
            top_k = int(data.get('top_k', 40))
            prompt = build_prompt(history, msg)

            # Stream response as SSE
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            reply = ''
            try:
                for ch in generate_stream(prompt, max_new=max_new,
                                          temperature=temperature, top_k=top_k):
                    reply += ch
                    msg_data = json.dumps({'char': ch})
                    self.wfile.write(f'data: {msg_data}\n\n'.encode())
                    self.wfile.flush()
                # Send done event with full reply
                done_data = json.dumps({'done': True, 'reply': reply.strip()})
                self.wfile.write(f'data: {done_data}\n\n'.encode())
                self.wfile.flush()
            except Exception:
                pass
            return
        self._json({'error': 'not found'}, 404)

    def do_GET(self):
        parsed = urlparse(self.path)

        # Health check
        if parsed.path == '/ping':
            self._json({'ok': True})
            return

        # Legacy API: /chat?msg=hello (no history)
        if parsed.path == '/chat':
            qs = parse_qs(parsed.query)
            msg = qs.get('msg', [''])[0].strip()
            if not msg:
                self._json({'error': 'no message'}, 400)
                return
            prompt = build_prompt([], msg)
            reply = ''.join(generate_stream(prompt))
            self._json({'reply': reply})
            return

        # Serve static files
        path = parsed.path.lstrip('/')
        if path == '':
            path = 'index.html'

        filepath = os.path.join(os.path.dirname(__file__), path)
        if not os.path.exists(filepath) or not os.path.isfile(filepath):
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not found')
            return

        ext = os.path.splitext(filepath)[1]
        types = {'.html': 'text/html', '.js': 'application/javascript',
                 '.css': 'text/css', '.json': 'application/json'}
        ctype = types.get(ext, 'application/octet-stream')

        with open(filepath, 'rb') as f:
            data = f.read()
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', len(data))
        self.end_headers()
        self.wfile.write(data)

    def _json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(data))
        self.end_headers()
        self.wfile.write(data)


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import socket
    HTTPServer.allow_reuse_address = True
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    print(f"Joe Brain running at http://localhost:{PORT}")
    print("Open that URL in your browser. Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
