#!/usr/bin/env python3
"""One-time script to seed Backside with Joe's brain facts."""

import json
import os
import ssl
import time
import urllib.request
import urllib.error

BASE_URL = 'https://api.worktruck.app/api/v1'
TAG = 'monkey-joe-brain'
BRAIN_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'brain')


def get_backside_key():
    path = os.path.expanduser('~/.mj_backside')
    if os.path.exists(path):
        return open(path).read().strip()
    return None


def make_request(method, path, api_key, body=None):
    ctx = ssl.create_default_context()
    url = BASE_URL + path
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        method=method,
    )
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        return json.loads(resp.read())


def load_facts(filename):
    path = os.path.join(BRAIN_DIR, filename)
    try:
        with open(path) as f:
            data = json.load(f)
        facts = data.get('facts', []) if isinstance(data, dict) else data
        return [f for f in facts if f.get('keywords') and f.get('answer')]
    except Exception as e:
        print(f"  Warning: could not load {filename}: {e}")
        return []


def fetch_existing(api_key):
    try:
        data = make_request('GET', f'/notes?tag={TAG}&limit=1000', api_key)
        notes = data.get('notes', [])
        return {note['title'] for note in notes}
    except Exception as e:
        print(f"  Error fetching existing notes: {e}")
        return set()


def main():
    api_key = get_backside_key()
    if not api_key:
        print("Error: no Backside key found. Add it to ~/.mj_backside")
        return

    print("Reading brain files...")
    knowledge = load_facts('knowledge.json')
    coding = load_facts('coding.json')
    all_facts = knowledge + coding
    print(f"  knowledge.json: {len(knowledge)} facts")
    print(f"  coding.json: {len(coding)} facts")
    print(f"  Total: {len(all_facts)} facts")

    print("\nFetching existing Backside notes...")
    existing_titles = fetch_existing(api_key)
    print(f"  Found {len(existing_titles)} existing facts")

    print("\nUploading...")
    uploaded = 0
    skipped = 0
    failed = 0
    total = len(all_facts)

    for i, fact in enumerate(all_facts, 1):
        title = ', '.join(fact['keywords'])
        first_kw = fact['keywords'][0]
        label = first_kw[:40] + '…' if len(first_kw) > 40 else first_kw

        if title in existing_titles:
            print(f"  [{i:>{len(str(total))}}/{total}] {label} (skipped)")
            skipped += 1
            continue

        try:
            make_request('POST', '/notes', api_key, {
                'title': title,
                'body': fact['answer'],
                'tags': [TAG],
            })
            print(f"  [{i:>{len(str(total))}}/{total}] {label} ✓")
            uploaded += 1
        except Exception as e:
            print(f"  [{i:>{len(str(total))}}/{total}] {label} ✗ {e}")
            failed += 1

        time.sleep(0.1)

    print(f"\nDone! {uploaded} uploaded, {skipped} skipped, {failed} failed 🐒")


if __name__ == '__main__':
    main()
