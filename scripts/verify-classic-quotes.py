#!/usr/bin/env python3
"""Verify imported quotations against pinned editions, without guessing authors."""
import argparse
import hashlib
import json
import re
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def normalize(text):
    text = text.lower().replace('œ', 'oe')
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return re.sub('[^a-z0-9]', '', text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    editions = json.loads((ROOT / 'public/quote-sources/editions.json').read_text())
    library = (ROOT / 'public/quote-library.js').read_text()
    quotes = json.loads(library.split('export const quotes = ', 1)[1].rsplit(';', 1)[0])
    args.source_dir.mkdir(parents=True, exist_ok=True)
    sources = {}
    for key, edition in editions.items():
        path = args.source_dir / edition['file']
        if args.download:
            # urllib's default HTTPS context preserves certificate verification.
            with urllib.request.urlopen(edition['downloadUrl'], timeout=60) as response:
                raw = response.read()
            if hashlib.sha256(raw).hexdigest() != edition['sha256']:
                raise ValueError(f'Checksum mismatch for {key}')
            path.write_bytes(raw)
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != edition['sha256']:
            raise ValueError(f'Checksum mismatch for {key}')
        sources[key] = raw.decode(edition['encoding']).splitlines()
    checked = 0
    for quote in quotes:
        key = quote.get('sourceId')
        if not key:
            continue
        edition = editions[key]
        if quote['author'] != edition['author']:
            raise ValueError(f'Author mismatch: {quote["text"]}')
        expected = f'{edition["repository"]}/blob/{edition["commit"]}/{edition["file"]}#L'
        if not quote['sourceUrl'].startswith(expected):
            raise ValueError(f'Source revision mismatch: {quote["text"]}')
        line = int(quote['sourceUrl'][len(expected):])
        passage = '\n'.join(sources[key][line - 1:line + 150])
        if normalize(quote['text']) not in normalize(passage):
            raise ValueError(f'Quotation absent from linked passage: {quote["text"]}')
        checked += 1
    if checked != 980:
        raise ValueError(f'Expected 980 newly sourced quotations, found {checked}')
    print(f'Verified {checked} quotations against five pinned editions and SHA-256 hashes.')


if __name__ == '__main__':
    main()
