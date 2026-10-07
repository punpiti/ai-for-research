#!/usr/bin/env python3
"""Prepare a machine-local research runtime under the normal user's account."""
import argparse
from datetime import datetime, timezone
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

_tracked_paths = []


def diagnostic(message):
    filename = os.environ.get('AI_RESEARCH_TRACE_FILE')
    if filename:
        with Path(filename).with_suffix('.log').open('a', encoding='utf-8') as stream:
            stream.write(str(message) + '\n')


def trace(action, kind, target, status, details=''):
    filename = os.environ.get('AI_RESEARCH_TRACE_FILE')
    if not filename:
        return
    event = {'schema': 1, 'at': datetime.now(timezone.utc).isoformat(), 'phase': 'runtime',
             'action': action, 'kind': kind, 'target': str(target), 'status': status, 'details': details}
    with Path(filename).open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(event, ensure_ascii=False) + '\n')


def trace_path(path, stage):
    path = Path(path)
    state = 'missing'
    if path.is_symlink():
        state = 'symlink:' + os.readlink(path)
    elif path.is_file():
        state = 'file:' + hashlib.sha256(path.read_bytes()).hexdigest()
    elif path.is_dir():
        state = 'directory'
    trace('snapshot', 'path', path, stage, state)


def log(message):
    trace('message', 'installer', 'runtime', 'observed', message)
    diagnostic(message)
    if not os.environ.get('AI_RESEARCH_TRACE_FILE') or message.startswith(('PYTHON_ENV_READY', 'RUNTIME_READY', 'FINAL_RESULT', 'SETUP_FAILED')):
        print(f'[AI for Research] {message}', flush=True)


def run(*args, **kwargs):
    # Trace the executable/action, never stdout, environment values or arbitrary
    # argument contents (which can contain user data or credentials).
    target = str(args[0])
    operation = str(args[1]) if len(args) > 1 else ''
    trace('command', 'process', target, 'started', operation)
    # TeX Live's Windows entry points are .bat files; list2cmdline quotes paths.
    if os.name == 'nt' and str(args[0]).lower().endswith(('.bat', '.cmd')):
        args = ('cmd.exe', '/d', '/c', subprocess.list2cmdline(list(map(str, args))))
    if not kwargs.get('capture_output'):
        kwargs.setdefault('stdout', subprocess.PIPE)
        kwargs.setdefault('stderr', subprocess.PIPE)
        kwargs.setdefault('text', True)
    try:
        result = subprocess.run(list(map(str, args)), check=True, **kwargs)
    except (OSError, subprocess.CalledProcessError) as error:
        diagnostic(getattr(error, 'stdout', '') or '')
        diagnostic(getattr(error, 'stderr', '') or '')
        trace('command', 'process', target, 'failed', str(getattr(error, 'returncode', type(error).__name__)))
        raise
    diagnostic(result.stdout or '')
    diagnostic(result.stderr or '')
    trace('command', 'process', target, 'completed', operation)
    return result


def write_new(path, content):
    trace_path(path, 'before')
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        log(f'REUSE_CONFIG {path}; check its permissions/environment if downloads are blocked.')
    else:
        path.write_text(content, encoding='utf-8')
    trace_path(path, 'after')


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
    trace('install', 'component', 'Node', 'completed')
    return binary


def install_tex(root):
    tex = root / 'TinyTeX'
    database = tex / 'tlpkg' / 'texlive.tlpdb'
    def package_names():
        return [line[5:] for line in database.read_text(encoding='utf-8').splitlines() if line.startswith('name ')] if database.exists() else None
    previous_packages = package_names()
    if previous_packages is not None:
        trace('snapshot', 'tex-packages', tex, 'before', json.dumps(previous_packages))
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
        'fancyvrb', 'framed', 'booktabs', 'upquote', 'etoolbox', 'float', 'tools', 'caption', 'soul',
        'setspace', 'parskip', 'lm', 'amsmath', 'amsfonts', 'iftex', 'microtype', 'xurl', 'fontsize')
    kpsewhich = bin_dir / ('kpsewhich.exe' if os.name == 'nt' else 'kpsewhich')
    for name in ('setspace.sty', 'parskip.sty', 'unicode-math.sty', 'bookmark.sty', 'fontsize.sty'):
        run(kpsewhich, name, stdout=subprocess.DEVNULL)
    current_packages = package_names()
    if current_packages is not None:
        trace('snapshot', 'tex-packages', tex, 'after', json.dumps(current_packages))
    return bin_dir


def verify_python_runtime(uv, environment):
    python = environment / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    before_probe = ('import json\nfrom importlib.metadata import version,PackageNotFoundError\n'
                    'try:\n value=version("packaging")\nexcept PackageNotFoundError:\n value=None\n'
                    'print(json.dumps({"packaging":value}))')
    previous = run(python, '-I', '-c', before_probe, capture_output=True, text=True)
    trace('snapshot', 'python-packages', environment, 'before', previous.stdout.strip())
    # A small useful dependency exercises package installation and imports in
    # the exact interpreter the AI will use; do not install into system Python.
    run(uv, 'pip', 'install', '--python', python, 'packaging>=24')
    probe = (
        'import json,sys,platform; from importlib.metadata import version; '
        'from packaging.version import Version; '
        'assert Version("3.12") <= Version(platform.python_version()) < Version("3.13"); '
        'print(json.dumps({"executable":sys.executable,"prefix":sys.prefix,'
        '"base_prefix":sys.base_prefix,"version":platform.python_version(),'
        '"packages":{"packaging":version("packaging")}}))'
    )
    result = run(python, '-I', '-c', probe, capture_output=True, text=True)
    receipt = json.loads(result.stdout)
    if Path(receipt['prefix']).resolve() != environment.resolve() or receipt['prefix'] == receipt['base_prefix']:
        raise RuntimeError('Python environment check failed: interpreter is not using the course venv.')
    log(f'PYTHON_ENV_READY Python {receipt["version"]}; package install/import verified in {environment}')
    return receipt


def configure(workspace, agent, root, env, python_receipt=None):
    tools = workspace / 'tools'
    tools.mkdir(parents=True, exist_ok=True)
    receipt = {'tool_root': str(root), 'env': env}
    if os.environ.get('AI_RESEARCH_TRACE_FILE'):
        receipt['install_trace'] = os.environ['AI_RESEARCH_TRACE_FILE']
    if python_receipt:
        receipt['python'] = python_receipt
    (tools / 'runtime-env.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    (tools / 'runtime-env.sh').write_text('\n'.join(f'export {k}={shlex.quote(v)}' for k, v in env.items()) + '\n', encoding='utf-8')
    ps = '\n'.join("$env:" + k + " = '" + v.replace("'", "''") + "'" for k, v in env.items())
    (tools / 'runtime-env.ps1').write_text(ps + '\n', encoding='utf-8')
    # Configure only this workspace. Existing user configuration always wins.
    settings = {f'terminal.integrated.env.{p}': env for p in ('windows', 'osx', 'linux')}
    if python_receipt:
        settings['python.defaultInterpreterPath'] = python_receipt['executable']
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
        write_new(
            workspace / 'CLAUDE.md',
            '# AI for Research workspace\n\n'
            'Read and follow `AGENTS.md`. Start with `.ai/PROJECT_STATE.md` and '
            '`.ai/agent-project-kit/STARTUP.md`; load only task-relevant context.\n',
        )
        config = {'env': env, 'permissions': {'allow': [
            'Bash(uv:*)', 'Bash(tlmgr:*)', 'Bash(pandoc:*)', 'Bash(xelatex:*)',
            'Bash(bibtex:*)', 'Bash(biber:*)', 'Bash(latexmk:*)', 'Bash(latexdiff:*)']}}
        write_new(workspace / '.claude' / 'settings.local.json', json.dumps(config, indent=2) + '\n')
        ignore = workspace / '.gitignore'
        existing = ignore.read_text(encoding='utf-8') if ignore.exists() else ''
        if '.claude/settings.local.json' not in existing:
            ignore.write_text(existing.rstrip() + '\n.claude/settings.local.json\n', encoding='utf-8')
        log('CLAUDE_PERMISSIONS_READY document/Python course tools allowed; accept workspace trust once. Other commands may require IDE approval.')
    elif agent == 'openrouter':
        source = workspace / 'AGENTS.md'
        if source.exists():
            write_new(workspace / '.clinerules' / 'course.md', source.read_text(encoding='utf-8'))
        log('CLINE_READY Configure OpenRouter/key and Auto Approve in the Cline panel once; environment is ready for user-owned package installs.')
    else:
        log('ANTIGRAVITY_PERMISSIONS Configure terminal execution/download approval once in the IDE; the installer does not change IDE-wide policy.')
    log(f'RUNTIME_ROOT {root}')


def traced_main():
    trace('phase', 'installer', 'runtime', 'started')
    try:
        main()
    except Exception as error:
        trace('phase', 'installer', 'runtime', 'failed', type(error).__name__)
        raise
    finally:
        for path in _tracked_paths:
            trace_path(path, 'after')
    trace('phase', 'installer', 'runtime', 'completed')


def main():
    global _tracked_paths
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--agent', choices=['codex', 'claude', 'openrouter', 'antigravity'], required=True)
    args = parser.parse_args()
    workspace = args.workspace.expanduser().resolve()
    root = tool_root().resolve()
    # Standalone runtime calls also retain a journal. Entry installers pass the
    # same journal through system/user/runtime phases, including failed runs.
    if not os.environ.get('AI_RESEARCH_TRACE_FILE'):
        folder = root / 'install-traces'
        folder.mkdir(parents=True, exist_ok=True)
        import uuid
        os.environ['AI_RESEARCH_TRACE_FILE'] = str(folder / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex + '.jsonl'))
        trace('phase', 'installer', 'runtime', 'started')
    trace_file = os.environ['AI_RESEARCH_TRACE_FILE']
    log(f'INSTALL_TRACE {trace_file}')
    tracked = [root / name for name in ('python', 'envs/research', 'envs/research/pyvenv.cfg', 'TinyTeX', 'TinyTeX/tlpkg/texlive.tlpdb', 'node', 'npm', 'uv-tools', 'bin', 'tessdata')]
    tracked += [workspace / name for name in ('tools/runtime-env.json', 'tools/runtime-env.sh', 'tools/runtime-env.ps1', '.vscode/settings.json', '.codex/config.toml', '.claude/settings.local.json', '.clinerules/course.md', 'CLAUDE.md', '.gitignore')]
    _tracked_paths = tracked
    for path in tracked:
        trace_path(path, 'before')
    root.mkdir(parents=True, exist_ok=True)
    env = {
        'UV_PYTHON_INSTALL_DIR': str(root / 'python'),
        'UV_CACHE_DIR': str(root / 'cache' / 'uv'),
        'UV_TOOL_DIR': str(root / 'uv-tools'),
        'UV_TOOL_BIN_DIR': str(root / 'bin'),
        'UV_PROJECT_ENVIRONMENT': str(root / 'envs' / 'research'),
        'VIRTUAL_ENV': str(root / 'envs' / 'research'),
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
    python_receipt = verify_python_runtime(uv, Path(env['UV_PROJECT_ENVIRONMENT']))
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
    configure(workspace, args.agent, root, env, python_receipt)
    for path in tracked:
        trace_path(path, 'after')
    trace('snapshot', 'python-packages', env['UV_PROJECT_ENVIRONMENT'], 'after', json.dumps(python_receipt['packages']))
    log('RUNTIME_READY Python 3.12 + XeLaTeX + Thai PDF verified; uv and tlmgr can add task packages without system elevation.')
    log('FINAL_RESULT PASS - Research runtime ready.')


if __name__ == '__main__':
    try:
        traced_main()
    except Exception as error:
        diagnostic(repr(error))
        filename = os.environ.get('AI_RESEARCH_TRACE_FILE')
        print('[AI for Research] SETUP_FAILED Research runtime setup did not finish.', flush=True)
        if filename:
            print(f'[AI for Research] Details: {Path(filename).with_suffix(".log")}', flush=True)
        raise SystemExit(1)
