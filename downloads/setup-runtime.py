#!/usr/bin/env python3
"""Prepare a machine-local research runtime under the normal user's account."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
import re
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
COURSE_MATERIALS_MANIFEST_URL = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/course-materials.json'
COURSE_MATERIALS_URL_PREFIX = 'https://urban.cpe.ku.ac.th/ai-for-research/downloads/'


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


def console(message, end='\n'):
    """Write to the learner's terminal even though the installer captures stdout into the log."""
    try:
        with open('CONOUT$' if os.name == 'nt' else '/dev/tty', 'w', encoding='utf-8', errors='replace') as tty:
            tty.write(message + end)
            tty.flush()
    except OSError:
        pass


def step(message):
    """A visible progress line, so long silent phases show what is happening."""
    console(f'[AI for Research]   - {message}')


def download_progress(label):
    """urlretrieve hook: a 20-step bar with percent and MB."""
    state = {'last': -1}

    def hook(blocks, block_size, total):
        if total <= 0:
            return
        done = min(blocks * block_size, total)
        percent = done * 100 // total
        if percent == state['last'] or (percent % 5 and percent != 100):
            return
        state['last'] = percent
        bar = '#' * (percent // 5) + '.' * (20 - percent // 5)
        console(f'\r[AI for Research]     {label} [{bar}] {percent:3d}%  {done / 1e6:5.1f}/{total / 1e6:.1f} MB',
                end='\n' if percent >= 100 else '')
    return hook


def log(message):
    trace('message', 'installer', 'runtime', 'observed', message)
    diagnostic(message)
    if not os.environ.get('AI_RESEARCH_TRACE_FILE') or message.startswith(('PYTHON_ENV_READY', 'RUNTIME_READY', 'MODULE7_READY', 'MODULE7_SKIPPED', 'FINAL_RESULT', 'SETUP_FAILED')):
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


def _download_verified(url, target, expected_sha256, expected_bytes, allowed_url_prefix):
    if not isinstance(url, str) or not url.startswith(allowed_url_prefix):
        raise RuntimeError('Course-material URL is outside the approved download root.')
    if (not isinstance(expected_sha256, str) or len(expected_sha256) != 64
            or any(character not in '0123456789abcdef' for character in expected_sha256)):
        raise RuntimeError('Course-material SHA-256 is invalid.')
    if not isinstance(expected_bytes, int) or not 0 < expected_bytes <= 32 * 1024 * 1024:
        raise RuntimeError('Course-material size is invalid.')
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + '.download')
    digest = hashlib.sha256(); total = 0
    try:
        with urllib.request.urlopen(url, timeout=30) as response, temporary.open('wb') as stream:
            if not response.geturl().startswith(allowed_url_prefix):
                raise RuntimeError('Course-material download redirected outside the approved root.')
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > expected_bytes or total > 32 * 1024 * 1024:
                    raise RuntimeError('Course-material download exceeded its manifest size.')
                digest.update(chunk); stream.write(chunk)
        if total != expected_bytes or digest.hexdigest() != expected_sha256:
            raise RuntimeError('Course-material download failed its size/SHA-256 check.')
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()


def install_course_materials(workspace, manifest_url=COURSE_MATERIALS_MANIFEST_URL,
                             allowed_url_prefix=COURSE_MATERIALS_URL_PREFIX):
    workspace = Path(workspace).resolve()
    module_root = (workspace / 'course-materials/module-07').resolve()
    update_root = (workspace / '.course-updates/course-materials/module-07').resolve()
    if not isinstance(manifest_url, str) or not manifest_url.startswith(allowed_url_prefix):
        raise RuntimeError('Course-material manifest is outside the approved download root.')
    with urllib.request.urlopen(manifest_url, timeout=30) as response:
        if not response.geturl().startswith(allowed_url_prefix):
            raise RuntimeError('Course-material manifest redirected outside the approved root.')
        raw = response.read(128 * 1024 + 1)
    if len(raw) > 128 * 1024:
        raise RuntimeError('Course-material manifest is too large.')
    manifest = json.loads(raw.decode('utf-8'))
    if not isinstance(manifest, dict) or manifest.get('schema_version') != 'ai-for-research.course-materials.v1' or manifest.get('module_id') != 'module-07':
        raise RuntimeError('Course-material manifest is not supported.')
    files = manifest.get('files')
    if not isinstance(files, list) or not 1 <= len(files) <= 40:
        raise RuntimeError('Course-material manifest has an invalid file list.')
    if any(not isinstance(item, dict) or not isinstance(item.get('bytes'), int) for item in files):
        raise RuntimeError('Course-material manifest has an invalid size entry.')
    total_expected = sum(item['bytes'] for item in files)
    if total_expected > 64 * 1024 * 1024:
        raise RuntimeError('Course-material manifest exceeds the download limit.')

    installed = reused = updates = 0
    receipt_files = []
    destinations = set()
    for item in files:
        if not isinstance(item, dict) or set(item) != {'url', 'path', 'sha256', 'bytes'}:
            raise RuntimeError('Course-material manifest entry is invalid.')
        relative = Path(str(item['path']))
        if relative.is_absolute() or '..' in relative.parts:
            raise RuntimeError('Course-material destination is unsafe.')
        if relative in destinations:
            raise RuntimeError('Course-material manifest contains a duplicate destination.')
        destinations.add(relative)
        target = (workspace / relative).resolve()
        if target != module_root and module_root not in target.parents:
            raise RuntimeError('Course-material destination is outside Module 7.')
        current_sha = hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None
        if current_sha == item['sha256']:
            reused += 1; status = 'reused'; destination = target
        elif target.exists() and relative.as_posix() == AIRR_CLIENT:
            # The AIRR tool is a system file (learners never edit tools/): always
            # replace it so fixes reach existing workspaces on a rerun.
            _download_verified(item['url'], target, item['sha256'], item['bytes'], allowed_url_prefix)
            installed += 1; status = 'updated'; destination = target
        elif target.exists():
            update_target = (update_root / target.relative_to(module_root)).resolve()
            if update_root not in update_target.parents:
                raise RuntimeError('Course-material update destination is unsafe.')
            update_sha = hashlib.sha256(update_target.read_bytes()).hexdigest() if update_target.is_file() else None
            if update_sha != item['sha256']:
                _download_verified(item['url'], update_target, item['sha256'], item['bytes'], allowed_url_prefix)
            updates += 1; status = 'update_available'; destination = update_target
        else:
            _download_verified(item['url'], target, item['sha256'], item['bytes'], allowed_url_prefix)
            installed += 1; status = 'installed'; destination = target
        receipt_files.append({'path': str(relative), 'status': status, 'destination': str(destination), 'sha256': item['sha256']})

    module_root.mkdir(parents=True, exist_ok=True)
    receipt = {
        'schema_version': manifest['schema_version'], 'module_id': 'module-07',
        'installed': installed, 'reused': reused, 'updates_available': updates,
        'files': receipt_files,
    }
    receipt_path = module_root / 'install-receipt.json'
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    log(f'COURSE_MATERIALS_READY Module 7 installed={installed} reused={reused} updates={updates}; receipt={receipt_path}')
    return receipt


def write_new(path, content, encoding='utf-8'):
    trace_path(path, 'before')
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        log(f'REUSE_CONFIG {path}; check its permissions/environment if downloads are blocked.')
    else:
        # .ps1 files are written with encoding='utf-8-sig': Windows PowerShell 5.1
        # reads BOM-less scripts as ANSI and breaks on non-ASCII paths.
        path.write_text(content, encoding=encoding)
    trace_path(path, 'after')


AIRR_CLIENT = 'course-materials/module-07/tools/ai-for-research-course.py'


def setup_airr(workspace, python):
    """Create AIRR launchers and connect the workspace once, during Module 1.

    Never replaces existing launchers or an existing .airr/config.json (for
    example from an earlier Module 7 install), never fails the installer, and
    never writes the key to logs or traces.
    """
    key = os.environ.pop('AI_RESEARCH_AIRR_KEY', '').strip()
    client = workspace / AIRR_CLIENT
    if not client.is_file():
        log('AIRR_SKIPPED AIRR client is missing; rerun the installer later.')
        return
    quote_ps = lambda value: "'" + str(value).replace("'", "''") + "'"
    write_new(workspace / 'tools' / 'airr.ps1',
              "$ErrorActionPreference = 'Stop'\n"
              f"& {quote_ps(python)} {quote_ps(client)} --workspace {quote_ps(workspace)} @args\n"
              "exit $LASTEXITCODE\n", encoding='utf-8-sig')
    shell = workspace / 'tools' / 'airr.sh'
    write_new(shell, '#!/usr/bin/env bash\nset -euo pipefail\n'
              f'exec {shlex.quote(str(python))} {shlex.quote(str(client))} --workspace {shlex.quote(str(workspace))} "$@"\n')
    shell.chmod(shell.stat().st_mode | 0o755)
    ignore = workspace / '.gitignore'
    existing = ignore.read_text(encoding='utf-8') if ignore.exists() else ''
    if '.airr/' not in {line.strip() for line in existing.splitlines()}:
        ignore.write_text(existing.rstrip() + '\n.airr/\n', encoding='utf-8')
    config = workspace / '.airr' / 'config.json'
    if config.exists():
        log('AIRR_REUSE This workspace is already connected to AIRR; kept the existing connection.')
        return
    if not key:
        log('AIRR_NOT_CONNECTED Create an AIRR Key on the Module 1 page, then run tools/airr login once.')
        return
    try:
        result = subprocess.run([str(python), str(client), '--workspace', str(workspace), 'login', '--key', key],
                                capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired) as error:
        log(f'AIRR_LOGIN_SKIPPED {type(error).__name__}; run tools/airr login later.')
        return
    if result.returncode == 0 and config.exists():
        log('AIRR_CONNECTED ' + ((result.stdout or '').strip().splitlines() or [''])[0])
    else:
        reason = ((result.stderr or result.stdout or '').strip().splitlines() or ['unknown error'])[-1]
        log(f'AIRR_LOGIN_SKIPPED {reason[:200]}; create a new key and run tools/airr login later.')


# owner 2026-11-19: Module 1 prepares every module of the class through the AIRR client,
# one module at a time: `airr init module-N` downloads the files all topics of that module
# use (course-materials/ and module-0N-work/) and creates its progress/evaluation form.
def class_modules(workspace, python, client):
    """module-1 plus every module in this class's syllabus (from `airr whoami`)."""
    modules = ['module-1']
    if not (workspace / '.airr' / 'config.json').exists():
        return modules
    try:
        result = subprocess.run([str(python), str(client), '--workspace', str(workspace), 'whoami'],
                                capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        return modules
    for line in (result.stdout or '').splitlines():
        name = line.split()[0] if line.startswith('module-') else ''
        if re.fullmatch(r'module-[1-9]', name) and name not in modules:
            modules.append(name)
    return modules


def init_class_modules(workspace, python):
    """Run `airr init` for each module of the class. Never fails Module 1.

    The client never overwrites learner files, so reruns keep learner work.
    Returns the modules after Module 1 whose files are ready.
    """
    client = workspace / AIRR_CLIENT
    if not client.is_file():
        log('PRACTICE_FILES_SKIPPED AIRR client is missing; rerun this installer later.')
        return []
    if not (workspace / '.airr' / 'config.json').exists():
        log('PRACTICE_FILES_SKIPPED AIRR is not connected yet; after connecting, ask the AI to run tools/airr init module-N for each module.')
    ready = []
    for module in class_modules(workspace, python, client):
        try:
            result = subprocess.run([str(python), str(client), '--workspace', str(workspace), 'init', module],
                                    capture_output=True, text=True, timeout=900)
        except (OSError, subprocess.TimeoutExpired) as error:
            log(f'PRACTICE_FILES_SKIPPED {module}: {type(error).__name__}; rerun this installer later.')
            continue
        if result.returncode == 0:
            summary = [line for line in (result.stdout or '').splitlines() if line.startswith('AIRR INIT PASS')]
            log('MODULE_INIT ' + (summary[-1] if summary else module))
            if summary and '· ข้าม' in summary[-1]:  # some files need AIRR (login-protected): not ready yet
                log(f'PRACTICE_FILES_SKIPPED {module}: some files need AIRR; after connecting, run tools/airr init {module}.')
            else:
                ready.append(module)
        else:
            reason = ((result.stderr or result.stdout or '').strip().splitlines() or ['unknown error'])[-1]
            log(f'PRACTICE_FILES_SKIPPED {module}: {reason[:200]}')
    later = [module for module in ready if module != 'module-1']
    if later:
        log('PRACTICE_FILES_READY ' + ', '.join(later)
            + ' (airr init per module: course-materials/ and module-0N-work/).')
    return later


def pdf_driver_diagnostics(tex_bin):
    """Record why XeLaTeX could not run its PDF driver (Error 32512 = exit 127)."""
    driver = Path(tex_bin) / ('xdvipdfmx.exe' if os.name == 'nt' else 'xdvipdfmx')
    lines = ['PDF_DRIVER_DIAGNOSTICS',
             f'which xelatex={shutil.which("xelatex")}', f'which xdvipdfmx={shutil.which("xdvipdfmx")}',
             f'driver={driver} exists={driver.exists()} is_symlink={driver.is_symlink()}',
             f'PATH head={os.environ.get("PATH", "").split(os.pathsep)[:4]}']
    if driver.is_symlink():
        lines.append(f'symlink target={os.readlink(driver)}')
    if driver.exists():
        lines.append(f'executable={os.access(driver, os.X_OK)} mode={oct(driver.stat().st_mode)}')
    probes = [[str(driver), '--version']]
    if platform.system() == 'Darwin':
        probes += [['xattr', '-l', str(driver)], ['file', str(driver.resolve())], ['sw_vers']]
    for command in probes:
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=20)
            output = (result.stdout + result.stderr).strip().splitlines()[:6]
            lines.append(f'$ {" ".join(command)} -> exit {result.returncode}: ' + ' | '.join(output))
        except Exception as error:
            lines.append(f'$ {" ".join(command)} -> {type(error).__name__}: {error}')
    for line in lines:
        diagnostic(line)
        print(f'[AI for Research] {line}', flush=True)


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
            bundled_npm = candidate.parent / ('npm.cmd' if os.name == 'nt' else 'npm')
            if int(version.split('.')[0]) >= minimum and (bundled_npm.is_file() or shutil.which('npm')):
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
        urllib.request.urlretrieve(base_url + filename, archive, download_progress('Node.js'))
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


def tex_root(root):
    """TinyTeX location. XeLaTeX runs its PDF driver by absolute path through
    the shell without quoting, so a path with spaces (macOS "Application
    Support") fails with Error 32512 / exit 127. Use a space-free folder then."""
    preferred = Path(root) / 'TinyTeX'
    if not any(ch.isspace() for ch in str(preferred)):
        return preferred
    fallback = Path.home() / '.ai-for-research' / 'TinyTeX'
    if any(ch.isspace() for ch in str(fallback)):
        raise RuntimeError('XeLaTeX needs a folder path without spaces for TinyTeX; the home folder path contains spaces.')
    return fallback


def install_tex(root):
    tex = tex_root(root)
    legacy = Path(root) / 'TinyTeX'
    if tex != legacy and legacy.is_dir() and not tex.exists():
        # TinyTeX is relocatable: move an earlier install instead of downloading again.
        tex.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(legacy), str(tex))
        log(f'MOVED TinyTeX to a path without spaces: {tex}')
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
            urllib.request.urlretrieve(url, archive, download_progress('TinyTeX'))
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
    driver = bin_dir / ('xdvipdfmx.exe' if os.name == 'nt' else 'xdvipdfmx')
    kpsewhich = bin_dir / ('kpsewhich.exe' if os.name == 'nt' else 'kpsewhich')
    required_styles = ('setspace.sty', 'parskip.sty', 'unicode-math.sty', 'bookmark.sty', 'fontsize.sty')

    def tex_ready():
        if not driver.exists() or not kpsewhich.exists():
            return False
        try:
            for name in required_styles:
                run(kpsewhich, name, stdout=subprocess.DEVNULL)
        except Exception:
            return False
        return True

    # A rerun on a machine that already has everything must not need tlmgr: an older
    # tlmgr refuses to work once the repository moves on ("tlmgr itself needs to be updated").
    if tex_ready():
        log('REUSE TinyTeX Thai/XeLaTeX packages already present; tlmgr not needed.')
    else:
        step('TinyTeX: adding Thai/XeLaTeX packages')
        # Bring tlmgr up to date first so the install step is accepted by the current repository.
        run(tlmgr, 'update', '--self')
        run(tlmgr, 'postaction', 'install', 'script', 'xetex')
        # dvipdfmx provides xdvipdfmx, the driver XeLaTeX calls to write the PDF;
        # the macOS TinyTeX bundle does not always include it (driver exit 127).
        run(tlmgr, 'install', 'xetex', 'dvipdfmx', 'fontspec', 'unicode-math', 'xcolor', 'geometry', 'bookmark',
            'fancyvrb', 'framed', 'booktabs', 'upquote', 'etoolbox', 'float', 'tools', 'caption', 'soul',
            'setspace', 'parskip', 'lm', 'amsmath', 'amsfonts', 'iftex', 'microtype', 'xurl', 'fontsize')
    if not driver.exists():
        raise RuntimeError(f'XeLaTeX PDF driver xdvipdfmx is missing in {bin_dir}; rerun the installer or run tlmgr install dvipdfmx.')
    for name in required_styles:
        run(kpsewhich, name, stdout=subprocess.DEVNULL)
    current_packages = package_names()
    if current_packages is not None:
        trace('snapshot', 'tex-packages', tex, 'after', json.dumps(current_packages))
    return bin_dir


MODULE7_NOTEBOOK_PACKAGES = (
    'jupyterlab>=4,<5', 'ipykernel>=6,<8', 'nbformat>=5.9,<6', 'nbclient>=0.10,<0.12', 'nbconvert>=7.16,<8',
)
MODULE7_NOTEBOOK = 'course-materials/module-07/notebooks/module-07-data-visualization.ipynb'


def prepare_module07_work_area(workspace):
    """Create module-07-work/ starters; never overwrite learner files."""
    work = workspace / 'module-07-work'
    (work / 'figures').mkdir(parents=True, exist_ok=True)
    highlights = work / 'module-07-highlights.md'
    if not highlights.exists():
        highlights.write_text(
            '# Module 7 — Data Exploration Highlights\n\n## คำถามที่สำรวจ\n\n## Highlights\n\n'
            '- \n- \n- \n\n## กราฟที่เลือก\n\n## ข้อสรุป\n\n## ข้อจำกัดและสิ่งที่ยังสรุปไม่ได้\n',
            encoding='utf-8')
    audit = work / 'module-07-figure-audit.md'
    template = workspace / 'course-materials/module-07/examples/figure-consistency/figure-consistency-audit-template.md'
    if not audit.exists() and template.is_file():
        shutil.copy2(template, audit)
    return work


def setup_module07(workspace, uv):
    """Install the Module 7 notebook environment during Module 1.

    Same layout as setup-module-07.py (.venv-module07, kernel, start launchers),
    so a later Module 7 run only reuses it. Never fails the Module 1 install.
    """
    requirements = workspace / 'course-materials/module-07/notebooks/module-07-requirements.txt'
    if not requirements.is_file() or not (workspace / MODULE7_NOTEBOOK).is_file():
        log('MODULE7_SKIPPED Module 7 notebook files are missing; rerun this installer later.')
        return False
    environment = workspace / '.venv-module07'
    python = environment / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    try:
        prepare_module07_work_area(workspace)
        run(uv, 'venv', '--python', '3.12', '--allow-existing', environment)
        run(uv, 'pip', 'install', '--python', python, '-r', requirements, *MODULE7_NOTEBOOK_PACKAGES)
        run(python, '-m', 'ipykernel', 'install', '--user', '--name', 'ai-for-research-module07',
            '--display-name', 'Python (AI for Research M07)')
        run(python, '-c', 'import altair, jupyterlab, matplotlib, numpy, pandas, plotly, seaborn')
    except (OSError, subprocess.CalledProcessError) as error:
        log(f'MODULE7_SKIPPED Notebook environment did not finish ({type(error).__name__}); '
            'Module 7 page installer can retry later.')
        return False
    tools = workspace / 'tools'
    tools.mkdir(parents=True, exist_ok=True)
    notebook = workspace / MODULE7_NOTEBOOK
    shell = tools / 'start-module-07.sh'
    shell.write_text('#!/usr/bin/env bash\nset -euo pipefail\n'
                     f'exec {shlex.quote(str(python))} -m jupyter lab {shlex.quote(str(notebook))}\n', encoding='utf-8')
    shell.chmod(shell.stat().st_mode | 0o755)
    quote_ps = lambda value: "'" + str(value).replace("'", "''") + "'"
    (tools / 'start-module-07.ps1').write_text(
        "$ErrorActionPreference = 'Stop'\n"
        f"& {quote_ps(python)} -m jupyter lab {quote_ps(notebook)}\n", encoding='utf-8-sig')
    log('MODULE7_READY Jupyter + data/plot libraries installed in .venv-module07; '
        'start with tools/start-module-07 (no separate Module 7 install needed).')
    return True


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
    receipt = {'tool_root': str(root), 'env': env, 'agent': agent}
    if os.environ.get('AI_RESEARCH_TRACE_FILE'):
        receipt['install_trace'] = os.environ['AI_RESEARCH_TRACE_FILE']
    if python_receipt:
        receipt['python'] = python_receipt
    (tools / 'runtime-env.json').write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    (tools / 'runtime-env.sh').write_text('\n'.join(f'export {k}={shlex.quote(v)}' for k, v in env.items()) + '\n', encoding='utf-8')
    ps = '\n'.join("$env:" + k + " = '" + v.replace("'", "''") + "'" for k, v in env.items())
    (tools / 'runtime-env.ps1').write_text(ps + '\n', encoding='utf-8-sig')
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
        log('CLINE_READY Paste the class OpenRouter key (see AI_KEY_READY) and set Auto Approve in the Cline panel once; environment is ready for user-owned package installs.')
    else:
        log('ANTIGRAVITY_PERMISSIONS Configure terminal execution/download approval once in the IDE; the installer does not change IDE-wide policy.')
    log(f'RUNTIME_ROOT {root}')


def fetch_ai_key(workspace, python):
    """OpenRouter learners: fetch the class-issued key into ~/.airr/ai-key.txt.

    The key is never printed or logged; the learner pastes it into Cline and
    then deletes the file (tools/airr ai-key --clear). Never fails Module 1.
    """
    client = workspace / AIRR_CLIENT
    if not (workspace / '.airr' / 'config.json').exists() or not client.is_file():
        log('AI_KEY_SKIPPED AIRR is not connected yet; after connecting, ask for tools/airr ai-key.')
        return
    try:
        result = subprocess.run([str(python), str(client), '--workspace', str(workspace), 'ai-key'],
                                capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired) as error:
        log(f'AI_KEY_SKIPPED {type(error).__name__}; run tools/airr ai-key later.')
        return
    lines = (result.stdout or '').strip().splitlines()
    if result.returncode == 0 and lines:
        path = next((line[5:] for line in lines if line.startswith('file=')), '~/.airr/ai-key.txt')
        log(f'AI_KEY_READY {lines[0]} -> {path}; open it in VS Code, paste line 1 into Cline, then run tools/airr ai-key --clear.')
    else:
        reason = ((result.stderr or result.stdout or '').strip().splitlines() or ['unknown error'])[-1]
        log(f'AI_KEY_SKIPPED {reason[:200]}')


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
    tracked = [root / name for name in ('python', 'envs/research', 'envs/research/pyvenv.cfg', 'node', 'npm', 'uv-tools', 'bin', 'tessdata')]
    tracked += [tex_root(root), tex_root(root) / 'tlpkg' / 'texlive.tlpdb']
    tracked += [workspace / name for name in ('tools/runtime-env.json', 'tools/runtime-env.sh', 'tools/runtime-env.ps1', '.vscode/settings.json', '.codex/config.toml', '.claude/settings.local.json', '.clinerules/course.md', 'CLAUDE.md', '.gitignore', 'tools/airr.ps1', 'tools/airr.sh', '.airr/config.json')]
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
                step(f'Downloading OCR language data ({language})')
                urllib.request.urlretrieve(f'https://github.com/tesseract-ocr/tessdata_fast/raw/4.1.0/{language}.traineddata', data,
                                           download_progress(f'OCR {language}'))
    os.environ.update(env)
    uv = shutil.which('uv')
    if not uv:
        raise RuntimeError('uv is missing. Rerun the main installer.')
    step('Python 3.12 (download about 30 MB on first run)')
    run(uv, 'python', 'install', '3.12')
    run(uv, 'venv', '--python', '3.12', env['UV_PROJECT_ENVIRONMENT'], '--allow-existing')
    python_receipt = verify_python_runtime(uv, Path(env['UV_PROJECT_ENVIRONMENT']))
    step('Node.js for the AI extensions')
    node_bin = ensure_node(root, args.agent)
    step('TinyTeX for PDF output (download about 120 MB and several packages on first run)')
    tex_bin = install_tex(root)
    python_bin = Path(env['UV_PROJECT_ENVIRONMENT']) / ('Scripts' if os.name == 'nt' else 'bin')
    npm_bin = root / 'npm' if os.name == 'nt' else root / 'npm' / 'bin'
    npm_bin.mkdir(parents=True, exist_ok=True)
    env['PATH'] = os.pathsep.join(map(str, [tex_bin, python_bin, root / 'bin', npm_bin, node_bin, Path(uv).parent])) + os.pathsep + os.environ['PATH']
    os.environ.update(env)
    run(python_bin / ('python.exe' if os.name == 'nt' else 'python'), '--version')
    run(tex_bin / ('xelatex.exe' if os.name == 'nt' else 'xelatex'), '--version', stdout=subprocess.DEVNULL)
    step('Testing a Thai PDF (the first run builds a font cache and can take a few minutes)')
    # Exercise the actual course template and Thai fonts before reporting success.
    with tempfile.TemporaryDirectory(prefix='ai-research-pdf-') as scratch:
        source = Path(scratch) / 'check.md'
        pdf = Path(scratch) / 'check.pdf'
        source.write_text('# ทดสอบ Python และ LaTeX\n\nAI for Research พร้อมใช้งาน\n', encoding='utf-8')
        try:
            run('pandoc', source, '--defaults', 'templates/modern-thai.yaml', '-o', pdf, cwd=workspace)
        except subprocess.CalledProcessError:
            pdf_driver_diagnostics(tex_bin)
            raise
        if not pdf.is_file() or pdf.stat().st_size == 0:
            raise RuntimeError('Thai PDF check did not produce a PDF.')
    step('Course files for the modules')
    install_course_materials(workspace)
    step('Module 7 notebook packages: pandas, matplotlib, JupyterLab ... (about 200 MB on first run)')
    module7_ready = setup_module07(workspace, uv)
    configure(workspace, args.agent, root, env, python_receipt)
    step('Connecting AIRR to your class and preparing practice files')
    setup_airr(workspace, python_bin / ('python.exe' if os.name == 'nt' else 'python'))
    practice_ready = init_class_modules(workspace, python_bin / ('python.exe' if os.name == 'nt' else 'python'))
    if args.agent == 'openrouter':
        fetch_ai_key(workspace, python_bin / ('python.exe' if os.name == 'nt' else 'python'))
    for path in tracked:
        trace_path(path, 'after')
    trace('snapshot', 'python-packages', env['UV_PROJECT_ENVIRONMENT'], 'after', json.dumps(python_receipt['packages']))
    log('RUNTIME_READY Python 3.12 + XeLaTeX + Thai PDF verified'
        + ('; Module 7 notebook environment ready' if module7_ready else '')
        + ('; practice files for ' + ', '.join(practice_ready) if practice_ready else '')
        + '; uv and tlmgr can add task packages without system elevation.')
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
