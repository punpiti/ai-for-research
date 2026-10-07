#!/usr/bin/env python3
"""Summarize this installation's recorded facts; never change installed tools."""
import argparse
import json
from pathlib import Path

NAMES = {
    'code': 'VS Code', 'git': 'Git', 'pandoc': 'Pandoc', 'tesseract': 'Tesseract OCR',
    'pdftotext': 'PDF tools', 'uv': 'uv', 'codex': 'Codex', 'claude': 'Claude Code',
    'git.git': 'Git', 'johnmacfarlane.pandoc': 'Pandoc',
    'tesseract-ocr.tesseract': 'Tesseract OCR', 'oschwartz10612.poppler': 'PDF tools',
    'microsoft.visualstudiocode': 'VS Code', 'poppler': 'PDF tools',
    'poppler-utils': 'PDF tools', 'tesseract-ocr': 'Tesseract OCR',
    'tesseract-ocr-tha': 'Thai OCR data', 'visual-studio-code': 'VS Code',
    '@openai/codex': 'Codex', '@anthropic-ai/claude-code': 'Claude Code',
    'saoudrizwan.claude-dev': 'Cline', 'openai.chatgpt': 'Codex extension',
    'anthropic.claude-code': 'Claude Code extension', 'mathematic.vscode-pdf': 'PDF viewer',
    'mechatroner.rainbow-csv': 'CSV viewer', 'aykutsarac.jsoncrack-vscode': 'JSON viewer',
    'ganymede404.vscode-codex-usage': 'Codex usage status bar',
    'growthjack.claude-code-usage': 'Claude usage status bar',
    'thiagosantosdevbr.openrouter-ai-monitor': 'OpenRouter usage status bar',
    'sourabhr10122002.antigravity-quota-checker': 'Antigravity usage status bar',
}


def summarize(events):
    reused, added, prepared, confirmed_reuse, dependencies = set(), set(), set(), set(), set()
    before, after = {}, {}
    for event in events:
        kind, target = event.get('kind'), event.get('target', '')
        status, details = event.get('status'), event.get('details', '')
        if event.get('action') == 'snapshot':
            key = (kind, target.replace('\\', '/'))
            if status == 'before':
                before.setdefault(key, details)
            elif status == 'after':
                after[key] = details
            if kind == 'system-tool' and status == 'before' and details.startswith('present'):
                reused.add(NAMES.get(target.lower(), target))
        if event.get('action') == 'message':
            if details.startswith('REUSE '):
                name = details.split()[1]
                if name.lower() in NAMES or name == 'Node':
                    reused.add(NAMES.get(name.lower(), name))
                    if 'no applicable update' in details:
                        confirmed_reuse.add(NAMES.get(name.lower(), name))
        if event.get('action') == 'install' and status == 'completed':
            name = NAMES.get(target.lower(), target)
            if kind == 'system-package':
                if target.endswith('.deb'):
                    prepared.add('VS Code')
                elif target.lower() in NAMES:
                    prepared.add(name)  # Missing CLI does not prove the package was absent.
                else:
                    dependencies.add(target)
            elif kind in ('user-tool', 'component'):
                added.add(name)

    for (kind, target), current in after.items():
        previous = before.get((kind, target), 'unknown')
        if kind == 'path' and current.startswith('file:'):
            if target.lower().endswith('/envs/research/pyvenv.cfg'):
                name = 'Python 3.12 + venv'
            elif target.lower().endswith('/tinytex/tlpkg/texlive.tlpdb'):
                name = 'TinyTeX'
            else:
                continue
            (added if previous == 'missing' else reused if previous.startswith('file:') else prepared).add(name)
        elif kind in ('vscode-extension', 'antigravity-extension') and current.startswith('present'):
            name = NAMES.get(target.lower(), target)
            (added if previous.startswith('missing') else reused if previous.startswith('present') else prepared).add(name)
        elif kind == 'python-packages':
            old = json.loads(previous) if previous != 'unknown' else {}
            for name, version in json.loads(current).items():
                label = f'{name} (Python package)'
                if name not in old:
                    prepared.add(label)
                elif old[name] is None:
                    added.add(label)
                elif old[name] == version:
                    reused.add(label)
                else:
                    prepared.add(label)
        elif kind == 'tex-packages' and previous != 'unknown':
            new = set(json.loads(current)) - set(json.loads(previous))
            if new:
                added.add(f'LaTeX packages ({len(new)})')
    # A component upgraded or newly prepared must not also be called unchanged.
    if dependencies:
        prepared.add(f'System dependencies ({len(dependencies)})')
    prepared -= confirmed_reuse
    reused -= added | prepared
    prepared -= added
    return {'reused': sorted(reused), 'added': sorted(added), 'prepared': sorted(prepared)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--trace', type=Path, required=True)
    args = parser.parse_args()
    events = [json.loads(line) for line in args.trace.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
    result = summarize(events)
    print('[AI for Research] Reused (already present): ' + (', '.join(result['reused']) or 'none recorded'))
    print('[AI for Research] Added this run: ' + (', '.join(result['added']) or 'none'))
    if result['prepared']:
        print('[AI for Research] Prepared/updated: ' + ', '.join(result['prepared']))
    print(f'[AI for Research] Log: {args.trace.with_suffix(".log")}')
    print(f'[AI for Research] Trace: {args.trace}')


if __name__ == '__main__':
    main()
