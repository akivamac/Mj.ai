"""
Train JoeBrain on the prepared text data.
Saves model weights + tokenizer as JSON (ready for browser inference).

Usage:
  python3 train.py
  python3 train.py --steps 2000 --lr 0.003
"""

import numpy as np
import json
import os
import sys
import argparse
import time

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


def train(steps=1000, lr=0.005, seq_len=64, batch_size=4,
          embed_dim=64, n_heads=4, n_layers=2, log_every=100, resume=False):

    # Load data
    with open(DATA) as f:
        raw = f.read()
    print(f"Training text: {len(raw):,} characters")

    # Tokenizer
    tok = Tokenizer()
    tok_path = os.path.join(OUT_DIR, 'tokenizer.json')
    model_path = os.path.join(OUT_DIR, 'model.json')

    if resume and os.path.exists(tok_path) and os.path.exists(model_path):
        tok.load(tok_path)
        data = np.array(tok.encode(raw), dtype=np.int32)
        model = JoeBrain.load(model_path)
        print(f"Resumed from saved model (vocab {tok.size})")
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
    print(f"Training for {steps} steps...\n")

    losses = []
    start = time.time()

    for step in range(1, steps + 1):
        model.zero_grad()

        # Mini-batch: average gradients over batch_size sequences
        batch_loss = 0.0
        for _ in range(batch_size):
            idx = np.random.randint(0, len(data) - seq_len - 1)
            x = data[idx:idx + seq_len]
            y = data[idx + 1:idx + seq_len + 1]
            logits, cache = model.forward(x)
            loss, dlogits = model.loss(logits, y)
            model.backward(dlogits, cache)
            batch_loss += loss

        # Average gradients
        for k in model.g:
            model.g[k] /= batch_size

        # Learning rate warmup
        warmup = 200
        eff_lr = lr * min(1.0, step / warmup)
        model.step(eff_lr)

        batch_loss /= batch_size
        losses.append(batch_loss)

        if step % log_every == 0:
            avg = np.mean(losses[-log_every:])
            elapsed = time.time() - start
            print(f"step {step:4d}/{steps} | loss {avg:.4f} | {elapsed:.0f}s elapsed")
            # Quick sample
            sample = model.generate(tok, '\n', max_new=60, temperature=0.9)
            print(f"  Sample: {repr(sample[:80])}\n")

    # Save
    model.save(os.path.join(OUT_DIR, 'model.json'))
    tok.save(os.path.join(OUT_DIR, 'tokenizer.json'))
    print("\nDone. Files saved to data/")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--steps', type=int, default=1000)
    parser.add_argument('--lr', type=float, default=0.005)
    parser.add_argument('--seq_len', type=int, default=64)
    parser.add_argument('--batch', type=int, default=4)
    parser.add_argument('--dim', type=int, default=64)
    parser.add_argument('--heads', type=int, default=4)
    parser.add_argument('--layers', type=int, default=2)
    parser.add_argument('--log', type=int, default=100)
    parser.add_argument('--resume', action='store_true', help='Continue from saved model')
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
    )
