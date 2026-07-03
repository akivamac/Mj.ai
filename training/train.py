"""
Train JoeBrain on the prepared text data.
Saves model weights + tokenizer as JSON (ready for browser inference).

Usage:
  python3 train.py
  python3 train.py --steps 5000 --lr 3e-4
  python3 train.py --resume --steps 5000
"""

import numpy as np
import json
import os
import sys
import argparse
import time
import math

sys.path.insert(0, os.path.dirname(__file__))
from tokenizer import Tokenizer
from model import JoeBrain

DATA = os.path.expanduser('~/github-projects/joe-brain/data/train.txt')
OUT_DIR = os.path.expanduser('~/github-projects/joe-brain/data')


def get_batch(data, seq_len, batch_size):
    starts = np.random.randint(0, len(data) - seq_len - 1, size=batch_size)
    x = np.stack([data[s:s + seq_len] for s in starts])
    y = np.stack([data[s + 1:s + seq_len + 1] for s in starts])
    return x, y


def cosine_lr(step, total_steps, lr_max, lr_min=1e-5, warmup=200):
    if step < warmup:
        return lr_max * step / warmup
    progress = (step - warmup) / max(1, total_steps - warmup)
    return lr_min + 0.5 * (lr_max - lr_min) * (1 + math.cos(math.pi * progress))


def git_push(step):
    import subprocess
    try:
        repo = os.path.expanduser('~/github-projects/joe-brain')
        subprocess.run(['git', '-C', repo, 'add', 'data/model.npz', 'data/tokenizer.json'], check=True)
        subprocess.run(['git', '-C', repo, 'commit', '-m', f'chore: auto-save model at step {step}'], check=True)
        subprocess.run(['git', '-C', repo, 'push', 'origin', 'new-monkey'], check=True)
        print(f"  [pushed to github at step {step}]")
    except Exception as e:
        print(f"  [git push failed: {e}]")


def train(steps=5000, lr=3e-4, seq_len=128, batch_size=8,
          embed_dim=128, n_heads=4, n_layers=3, log_every=100, resume=False, push_every=0, sample_every=0):

    # Load data
    with open(DATA) as f:
        raw = f.read()
    print(f"Training text: {len(raw):,} characters")

    # Tokenizer
    tok = Tokenizer()
    tok_path = os.path.join(OUT_DIR, 'tokenizer.json')
    model_path = os.path.join(OUT_DIR, 'model.npz')
    model_path_legacy = os.path.join(OUT_DIR, 'model.json')

    if resume and os.path.exists(tok_path) and (os.path.exists(model_path) or os.path.exists(model_path_legacy)):
        if not os.path.exists(model_path) and os.path.exists(model_path_legacy):
            model_path = model_path_legacy
        tok.load(tok_path)
        data = np.array(tok.encode(raw), dtype=np.int32)
        model = JoeBrain.load(model_path)
        seq_len = model.T  # use the model's actual seq_len
        print(f"Resumed from saved model (vocab {tok.size}, Adam step {model.t})")
    else:
        tok.build(raw)
        data = np.array(tok.encode(raw), dtype=np.int32)
        model = JoeBrain(
            vocab_size=tok.size,
            embed_dim=embed_dim,
            n_heads=n_heads,
            n_layers=n_layers,
            seq_len=seq_len,
        )

    total_params = sum(v.size for v in model.p.values())
    print(f"Parameters: {total_params:,}")
    print(f"Training for {steps} steps | lr={lr} | seq={seq_len} | batch={batch_size}\n")

    losses = []
    start = time.time()
    last_log_time = start
    last_log_step = 0

    for step in range(1, steps + 1):
        model.zero_grad()

        # Mini-batch: accumulate gradients
        batch_loss = 0.0
        starts = np.random.randint(0, len(data) - seq_len - 1, size=batch_size)
        for idx in starts:
            x = data[idx:idx + seq_len]
            y = data[idx + 1:idx + seq_len + 1]
            logits, cache = model.forward(x)
            loss, dlogits = model.loss(logits, y)
            model.backward(dlogits, cache)
            batch_loss += loss

        # Average gradients over batch
        for k in model.g:
            model.g[k] /= batch_size

        eff_lr = cosine_lr(step, steps, lr)
        model.step(eff_lr)

        batch_loss /= batch_size
        losses.append(batch_loss)

        if step % log_every == 0:
            avg = np.mean(losses[-log_every:])
            now = time.time()
            sps = (step - last_log_step) / (now - last_log_time)
            last_log_time = now
            last_log_step = step
            print(f"step {step:5d}/{steps} | loss {avg:.4f} | lr {eff_lr:.2e} | {sps:.2f} steps/s")

        if sample_every and step % sample_every == 0:
            sample = model.generate(tok, '\n', max_new=80, temperature=0.8)
            print(f"  Sample: {repr(sample[:100])}\n")

        if push_every and step % push_every == 0:
            model.save(os.path.join(OUT_DIR, 'model.npz'))
            tok.save(os.path.join(OUT_DIR, 'tokenizer.json'))
            git_push(step)

    # Save
    model.save(os.path.join(OUT_DIR, 'model.npz'))
    tok.save(os.path.join(OUT_DIR, 'tokenizer.json'))
    print("\nDone. Files saved to data/")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--steps', type=int, default=5000)
    parser.add_argument('--lr', type=float, default=3e-4)
    parser.add_argument('--seq_len', type=int, default=128)
    parser.add_argument('--batch', type=int, default=8)
    parser.add_argument('--dim', type=int, default=128)
    parser.add_argument('--heads', type=int, default=4)
    parser.add_argument('--layers', type=int, default=3)
    parser.add_argument('--log', type=int, default=100)
    parser.add_argument('--resume', action='store_true', help='Continue from saved model')
    parser.add_argument('--push', type=int, default=0, help='Push to github every N steps')
    parser.add_argument('--sample', type=int, default=0, help='Print a sample every N steps (0=off)')
    args = parser.parse_args()

    train(
        steps=args.steps,
        lr=args.lr,
        seq_len=args.seq_len,
        batch_size=args.batch,
        embed_dim=args.dim,
        n_heads=args.heads,
        n_layers=args.layers,
        log_every=args.log,
        resume=args.resume,
        push_every=args.push,
        sample_every=args.sample,
    )
