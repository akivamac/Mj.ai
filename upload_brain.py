#!/usr/bin/env python3
"""One-time script to seed Backside with Joe's brain facts.

Usage:
  python3 upload_brain.py          # upload all facts
  python3 upload_brain.py --retry  # skip already-uploaded, only upload missing
  python3 upload_brain.py --test   # test one fact, print full response
"""

import json
import os
import ssl
import sys
import time
import urllib.request
import urllib.error

BASE_URL = 'https://api.worktruck.app/api/v1'
TAG = 'monkey-joe-brain'
BRAIN_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'brain')


def get_backside_key():
    path = os.path.expanduser('~/.mj_backside')
    if not os.path.exists(path):
        return None
    raw = open(path, 'rb').read()
    # Strip BOM and whitespace
    return raw.decode('utf-8-sig').strip()


def api_call(method, path, api_key, body=None, verbose=False):
    """Make an API call. Returns (status, response_dict_or_str).
    Never raises — always returns the status code and body for inspection.
    """
    ctx = ssl.create_default_context()
    url = BASE_URL + path
    data = json.dumps(body).encode('utf-8') if body is not None else None
    headers = {
        'Authorization': 'Bearer ' + api_key,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    if verbose:
        print(f"\n→ {method} {url}")
        for k, v in headers.items():
            display = v if k != 'Authorization' else v[:20] + '...'
            print(f"  {k}: {display}")
        if body:
            print(f"  Body: {json.dumps(body)[:200]}")

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            status = resp.status
            raw = resp.read()
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = raw.decode('utf-8', errors='replace')
            if verbose:
                print(f"\n← {status} OK")
                print(f"  Response: {json.dumps(parsed)[:500] if isinstance(parsed, (dict, list)) else parsed[:500]}")
            return status, parsed
    except urllib.error.HTTPError as e:
        status = e.code
        try:
            raw = e.read()
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = raw.decode('utf-8', errors='replace')
        except Exception:
            parsed = str(e)
        if verbose:
            print(f"\n← {status} ERROR")
            print(f"  Response: {json.dumps(parsed)[:500] if isinstance(parsed, (dict, list)) else str(parsed)[:500]}")
        return status, parsed
    except Exception as e:
        if verbose:
            print(f"\n← EXCEPTION: {e}")
        return 0, str(e)


def extract_notes(data):
    """Handle d.data || d.items || d.notes || d (mirrors backside.js)."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get('data') or data.get('items') or data.get('notes') or []
    return []


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


def run_test(api_key):
    """Upload one fact with full verbose output for debugging."""
    print("=== TEST MODE — one fact, full output ===\n")

    # Step 1: test GET
    print("Step 1: GET existing notes")
    status, data = api_call('GET', f'/notes?tag={TAG}&limit=1', api_key, verbose=True)
    if status != 200:
        print(f"\nGET failed ({status}). Check your key and network.")
        return

    # Step 2: POST one fact
    print("\nStep 2: POST one fact")
    fact = load_facts('knowledge.json')[0] if load_facts('knowledge.json') else None
    if not fact:
        print("No facts found to test with.")
        return

    title = ', '.join(fact['keywords'])
    body = {
        'title': title,
        'body': fact['answer'],
        'tags': [TAG],
    }
    status, data = api_call('POST', '/notes', api_key, body=body, verbose=True)
    if status in (200, 201):
        print(f"\n✓ Test POST succeeded ({status}). Safe to run without --test.")
    else:
        print(f"\n✗ Test POST failed ({status}). See response above.")


def post_with_retry(api_key, body, max_retries=3, retry_delay=2.0):
    """POST a note, retrying up to max_retries times on any error."""
    for attempt in range(max_retries):
        status, resp = api_call('POST', '/notes', api_key, body)
        if status in (200, 201):
            return status, resp
        if attempt < max_retries - 1:
            time.sleep(retry_delay)
    return status, resp


def run_upload(api_key, retry_mode=False):
    print("Reading brain files...")
    knowledge = load_facts('knowledge.json')
    coding = load_facts('coding.json')
    all_facts = knowledge + coding
    print(f"  knowledge.json: {len(knowledge)} facts")
    print(f"  coding.json: {len(coding)} facts")
    print(f"  Total: {len(all_facts)} facts")

    print("\nFetching existing Backside notes...")
    status, data = api_call('GET', f'/notes?tag={TAG}&limit=1000', api_key)
    if status != 200:
        print(f"  Error fetching existing notes (HTTP {status}): {data}")
        print("  Proceeding with 0 known existing notes (may create duplicates).")
        existing_titles = set()
    else:
        notes = extract_notes(data)
        existing_titles = {n['title'] for n in notes if isinstance(n, dict) and 'title' in n}
        print(f"  Found {len(existing_titles)} existing facts")

    if retry_mode:
        pending = [f for f in all_facts if ', '.join(f['keywords']) not in existing_titles]
        print(f"  Retry mode: {len(pending)} facts to upload, {len(all_facts) - len(pending)} already done")
    else:
        pending = all_facts

    print("\nUploading...")
    uploaded = 0
    skipped = 0
    failed = 0
    total = len(all_facts)
    width = len(str(total))
    # Counter tracks position in the full list for display
    pos = 0

    for fact in all_facts:
        pos += 1
        title = ', '.join(fact['keywords'])
        first_kw = fact['keywords'][0]
        label = first_kw[:45] + '…' if len(first_kw) > 45 else first_kw

        if title in existing_titles:
            if not retry_mode:
                print(f"  [{pos:{width}}/{total}] {label} (skipped)")
            skipped += 1
            continue

        status, resp = post_with_retry(api_key, {
            'title': title,
            'body': fact['answer'],
            'tags': [TAG],
        })

        if status in (200, 201):
            print(f"  [{pos:{width}}/{total}] {label} ✓")
            uploaded += 1
        else:
            err = resp if isinstance(resp, str) else json.dumps(resp)
            print(f"  [{pos:{width}}/{total}] {label} ✗ HTTP {status}: {err[:80]}")
            failed += 1

        time.sleep(0.5)

    print(f"\nDone! {uploaded} uploaded, {skipped} skipped, {failed} failed 🐒")


def main():
    api_key = get_backside_key()
    if not api_key:
        print("Error: no Backside key found.")
        print("  echo 'bsk_live_...' > ~/.mj_backside && chmod 600 ~/.mj_backside")
        sys.exit(1)

    print(f"Key: {api_key[:12]}... ({len(api_key)} chars)\n")

    if '--test' in sys.argv:
        run_test(api_key)
    elif '--retry' in sys.argv:
        run_upload(api_key, retry_mode=True)
    else:
        run_upload(api_key)


if __name__ == '__main__':
    main()
