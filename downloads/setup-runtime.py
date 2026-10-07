#!/usr/bin/env python3
"""Prepare a machine-local research runtime under the normal user's account."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shlex
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
import zipfile


def log(message):
    print(f'[ai-grad] {message}', flush=True)


def run(*args, **kwargs):
    # TeX Live's Windows entry points are .bat files; list2cmdline quotes paths.
    if os.name == 'nt' and str(args[0]).lower().endswith(('.bat', '.cmd')):
        args = ('cmd.exe', '/d', '/c', subprocess.list2cmdline(list(map(str, args))))
    return subprocess.run(list(map(str, args)), check=True, **kwargs)


def write_new(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        log(f'REUSE_CONFIG {path}; check its permissions/environment if downloads are blocked.')
    else:
        path.write_text(content, encoding='utf-8')


def tool_root():
    if os.name == 'nt':
        return Path(os.environ['LOCALAPPDATA']) / 'ai-for-research'
    if platform.system() == 'Darwin':
        return Path.home() / 'Library' / 'Application Support' / 'ai-for-research'
    return Path.home() / '.local' / 'share' / 'ai-for-research'


def ensure_node(root, agent):
    minimum = 22 if agent == 'claude' else 16
    executable = 'node.exe' if os.name == 'nt' else 'node'
    candidates = list((root / 'node').glob(f'node-v*/{executable}'))
    candidates += list((root / 'node').glob(f'node-v*/bin/{executable}'))
    system_node = shutil.which('node')
    if system_node:
        candidates.append(Path(system_node))
    for candidate in candidates:
        try:
            version = run(candidate, '-p', 'process.versions.node', capture_output=True, text=True).stdout.strip()
            if int(version.split('.')[0]) >= minimum and shutil.which('npm'):
                log(f'REUSE Node {version} ({candidate}); no automatic update.')
                return candidate.parent
        except (OSError, ValueError, subprocess.CalledProcessError):
            continue
    # Install a compatible LTS in the course tool root; never replace system Node.
    system = platform.system()
    arch = {'x86_64': 'x64', 'amd64': 'x64', 'arm64': 'arm64', 'aarch64': 'arm64'}.get(platform.machine().lower())
    os_part = {'Linux': 'linux', 'Darwin': 'darwin', 'Windows': 'win'}.get(system)
    if not arch or not os_part:
        raise RuntimeError('No supported Node LTS binary for this platform.')
    extension = 'zip' if os.name == 'nt' else 'tar.xz'
    base_url = 'https://nodejs.org/dist/latest-v24.x/'
    with urllib.request.urlopen(base_url + 'SHASUMS256.txt') as response:
        checksums = response.read().decode('utf-8')
    matches = [line.split() for line in checksums.splitlines() if line.strip().endswith(f'-{os_part}-{arch}.{extension}')]
    if len(matches) != 1:
        raise RuntimeError('Node LTS release metadata is ambiguous.')
    digest, filename = matches[0]
    if '/' in filename or '\\' in filename:
        raise RuntimeError('Unexpected Node archive filename.')
    target = root / 'node'
    target.mkdir(parents=True, exist_ok=True)
    log(f'INSTALL compatible Node LTS {filename}; selected frontend requires Node >= {minimum}.')
    with tempfile.TemporaryDirectory(prefix='ai-research-node-') as scratch:
        archive = Path(scratch) / filename
        urllib.request.urlretrieve(base_url + filename, archive)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != digest:
            raise RuntimeError('Node archive checksum mismatch.')
        if os.name == 'nt':
            with zipfile.ZipFile(archive) as bundle:
                # Reject paths that could escape the extraction directory.
                for name in bundle.namelist():
                    resolved = (Path(scratch) / name).resolve()
                    if not resolved.is_relative_to(Path(scratch).resolve()):
                        raise RuntimeError('Unsafe Node archive path.')
                bundle.extractall(scratch)
        else:
            with tarfile.open(archive) as bundle:
                bundle.extractall(scratch, filter='data')
        unpacked = Path(scratch) / filename.removesuffix('.zip').removesuffix('.tar.xz')
        destination = target / unpacked.name
        if destination.exists():
            raise RuntimeError(f'Inspect incomplete Node installation: {destination}')
        shutil.move(str(unpacked), str(destination))
    binary = destination if os.name == 'nt' else destination / 'bin'
    run(binary / executable, '--version')
    return binary


def install_tex(root):
    tex = root / 'TinyTeX'
    # Never replace an existing distribution; incomplete installs need inspection.
    if not tex.exists():
        system = platform.system()
        arch = platform.machine().lower()
        suffix = {'Darwin': 'darwin', 'Windows': 'windows'}.get(system)
        if system == 'Linux':
            suffix = {'x86_64': 'linux-x86_64', 'aarch64': 'linux-arm64', 'arm64': 'linux-arm64'}.get(arch)
        if not suffix:
            raise RuntimeError(f'Unsupported TinyTeX platform: {system}/{arch}')
        extension = 'exe' if os.name == 'nt' else 'tar.xz'
        url = f'https://github.com/rstudio/tinytex-releases/releases/download/daily/TinyTeX-1-{suffix}.{extension}'
        log('INSTALL user-owned TinyTeX (LaTeX/XeLaTeX); existing system TeX is retained.')
        with tempfile.TemporaryDirectory(prefix='ai-research-tex-') as scratch:
            archive = Path(scratch) / f'TinyTeX.{extension}'
            urllib.request.urlretrieve(url, archive)
            if os.name == 'nt':
                run(archive, '-y', cwd=scratch)
            else:
                with tarfile.open(archive) as bundle:
                    bundle.extractall(scratch, filter='data')
            unpacked = Path(scratch) / ('TinyTeX' if os.name == 'nt' or system == 'Darwin' else '.TinyTeX')
            if not unpacked.is_dir():
                raise RuntimeError('TinyTeX bundle has an unexpected directory layout.')
            shutil.move(str(unpacked), str(tex))
    bins = [p for p in (tex / 'bin').glob('*') if p.is_dir()]
    if len(bins) != 1:
        raise RuntimeError(f'Incomplete TinyTeX installation: inspect {tex}')
    bin_dir = bins[0]
    tlmgr = bin_dir / ('tlmgr.bat' if os.name == 'nt' else 'tlmgr')
    if not tlmgr.exists() or not os.access(tex, os.W_OK):
        raise RuntimeError(f'TinyTeX is incomplete or not user-writable: {tex}')
    os.environ['PATH'] = str(bin_dir) + os.pathsep + os.environ['PATH']
    run(tlmgr, 'postaction', 'install', 'script', 'xetex')
    run(tlmgr, 'install', 'xetex', 'fontspec', 'unicode-math', 'xcolor', 'geometry', 'bookmark',
        'fancyvrb', 'framed', 'booktabs', 'upquote', 'etoolbox', 'float', 'tools', 'caption', 'soul')
    return bin_dir


def configure(workspace, agent, root, env):
    tools = workspace / 'tools'
    tools.mkdir(parents=True, exist_ok=True)
    (tools / 'runtime-env.json').write_text(json.dumps({'tool_root': str(root), 'env': env}, indent=2), encoding='utf-8')
    (tools / 'runtime-env.sh').write_text('\n'.join(f'export {k}={shlex.quote(v)}' for k, v in env.items()) + '\n', encoding='utf-8')
    ps = '\n'.join("$env:" + k + " = '" + v.replace("'", "''") + "'" for k, v in env.items())
    (tools / 'runtime-env.ps1').write_text(ps + '\n', encoding='utf-8')
    # Configure only this workspace. Existing user configuration always wins.
    settings = {f'terminal.integrated.env.{p}': env for p in ('windows', 'osx', 'linux')}
    write_new(workspace / '.vscode' / 'settings.json', json.dumps(settings, indent=2) + '\n')
    if agent == 'codex':
        config = 'approval_policy = "never"\nsandbox_mode = "workspace-write"\n\n'
        config += '[sandbox_workspace_write]\nnetwork_access = true\n'
        config += 'writable_roots = ' + json.dumps([str(root)], ensure_ascii=False) + '\n\n'
        config += '[shell_environment_policy.set]\n'
        config += '\n'.join(f'{k} = {json.dumps(v, ensure_ascii=False)}' for k, v in env.items()) + '\n'
        write_new(workspace / '.codex' / 'config.toml', config)
        log('CODEX_PERMISSIONS_READY workspace-write; course tool root writable; network enabled; approval never. Trust this workspace once, then start a new session.')
    elif agent == 'claude':
        config = {'env': env, 'permissions': {'allow': [
            'Bash(uv:*)', 'Bash(tlmgr:*)', 'Bash(pandoc:*)', 'Bash(xelatex:*)']}}
        write_new(workspace / '.claude' / 'settings.local.json', json.dumps(config, indent=2) + '\n')
        ignore = workspace / '.gitignore'
        existing = ignore.read_text(encoding='utf-8') if ignore.exists() else ''
        if '.claude/settings.local.json' not in existing:
            ignore.write_text(existing.rstrip() + '\n.claude/settings.local.json\n', encoding='utf-8')
        log('CLAUDE_PERMISSIONS_READY uv/tlmgr/pandoc/xelatex allowed; accept workspace trust once. Other commands may require IDE approval.')
    elif agent == 'openrouter':
        source = workspace / 'AGENTS.md'
        if source.exists():
            write_new(workspace / '.clinerules' / 'course.md', source.read_text(encoding='utf-8'))
        log('CLINE_READY Configure OpenRouter/key and Auto Approve in the Cline panel once; environment is ready for user-owned package installs.')
    else:
        log('ANTIGRAVITY_PERMISSIONS Configure terminal execution/download approval once in the IDE; the installer does not change IDE-wide policy.')
    log(f'RUNTIME_ROOT {root}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--agent', choices=['codex', 'claude', 'openrouter', 'antigravity'], required=True)
    args = parser.parse_args()
    workspace = args.workspace.expanduser().resolve()
    root = tool_root().resolve()
    root.mkdir(parents=True, exist_ok=True)
    env = {
        'UV_PYTHON_INSTALL_DIR': str(root / 'python'),
        'UV_CACHE_DIR': str(root / 'cache' / 'uv'),
        'UV_TOOL_DIR': str(root / 'uv-tools'),
        'UV_TOOL_BIN_DIR': str(root / 'bin'),
        'UV_PROJECT_ENVIRONMENT': str(root / 'envs' / 'research'),
        'TEXMFHOME': str(root / 'texmf'),
        'TEXMFVAR': str(root / 'cache' / 'texmf-var'),
        'TEXMFCONFIG': str(root / 'texmf-config'),
        'npm_config_prefix': str(root / 'npm'),
    }
    for value in env.values():
        Path(value).mkdir(parents=True, exist_ok=True)
    if platform.system() == 'Darwin':
        env['TESSDATA_PREFIX'] = str(root / 'tessdata')
        Path(env['TESSDATA_PREFIX']).mkdir(parents=True, exist_ok=True)
        for language in ('eng', 'tha'):
            data = Path(env['TESSDATA_PREFIX']) / f'{language}.traineddata'
            if not data.exists() or data.stat().st_size == 0:
                log(f'INSTALL OCR language {language}; only English/Thai data are downloaded.')
                urllib.request.urlretrieve(f'https://github.com/tesseract-ocr/tessdata_fast/raw/4.1.0/{language}.traineddata', data)
    os.environ.update(env)
    uv = shutil.which('uv')
    if not uv:
        raise RuntimeError('uv is missing. Rerun the main installer.')
    run(uv, 'python', 'install', '3.12')
    run(uv, 'venv', '--python', '3.12', env['UV_PROJECT_ENVIRONMENT'], '--allow-existing')
    node_bin = ensure_node(root, args.agent)
    tex_bin = install_tex(root)
    python_bin = Path(env['UV_PROJECT_ENVIRONMENT']) / ('Scripts' if os.name == 'nt' else 'bin')
    npm_bin = root / 'npm' if os.name == 'nt' else root / 'npm' / 'bin'
    npm_bin.mkdir(parents=True, exist_ok=True)
    env['PATH'] = os.pathsep.join(map(str, [tex_bin, python_bin, root / 'bin', npm_bin, node_bin, Path(uv).parent])) + os.pathsep + os.environ['PATH']
    os.environ.update(env)
    run(python_bin / ('python.exe' if os.name == 'nt' else 'python'), '--version')
    run(tex_bin / ('xelatex.exe' if os.name == 'nt' else 'xelatex'), '--version', stdout=subprocess.DEVNULL)
    # Exercise the actual course template and Thai fonts before reporting success.
    with tempfile.TemporaryDirectory(prefix='ai-research-pdf-') as scratch:
        source = Path(scratch) / 'check.md'
        pdf = Path(scratch) / 'check.pdf'
        source.write_text('# ทดสอบ Python และ LaTeX\n\nAI for Research พร้อมใช้งาน\n', encoding='utf-8')
        run('pandoc', source, '--defaults', 'templates/modern-thai.yaml', '-o', pdf, cwd=workspace)
        if not pdf.is_file() or pdf.stat().st_size == 0:
            raise RuntimeError('Thai PDF check did not produce a PDF.')
    configure(workspace, args.agent, root, env)
    log('RUNTIME_READY Python 3.12 + XeLaTeX + Thai PDF verified; uv and tlmgr can add packages as this user.')
    log('FINAL_RESULT PASS - Research runtime ready.')


if __name__ == '__main__':
    main()
