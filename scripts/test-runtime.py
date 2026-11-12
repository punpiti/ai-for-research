"""Runtime checks with no downloads and no changes to the real user's tools."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tarfile
import tempfile
import tomllib
import unittest
import hashlib
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('runtime', ROOT / 'downloads/setup-runtime.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)
summary_spec = importlib.util.spec_from_file_location('summary', ROOT / 'downloads/setup-summary.py')
summary = importlib.util.module_from_spec(summary_spec)
summary_spec.loader.exec_module(summary)


class AirrSetupTests(unittest.TestCase):
    """Module 1 connects AIRR once; it never overwrites an earlier install."""

    FAKE_CLIENT = (
        "import json, pathlib, sys\n"
        "args = sys.argv[1:]\n"
        "ws = pathlib.Path(args[args.index('--workspace') + 1])\n"
        "(ws / 'client-args.json').write_text(json.dumps(args))\n"
        "if 'login' not in args: sys.exit(0)\n"
        "key = args[args.index('--key') + 1]\n"
        "if key == 'airr_bad': print('AIRR Key is invalid', file=sys.stderr); sys.exit(1)\n"
        "(ws / '.airr').mkdir(exist_ok=True)\n"
        "(ws / '.airr' / 'config.json').write_text(json.dumps({'api_key': key}))\n"
        "print('AIRR CONNECTED \u00b7 Pilot (pilot-01)')\n"
    )

    def workspace(self, folder):
        ws = Path(folder) / 'ผู้ใช้ ทดสอบ' / 'ai-for-research-workspace'
        client = ws / runtime.AIRR_CLIENT
        client.parent.mkdir(parents=True)
        client.write_text(self.FAKE_CLIENT, encoding='utf-8')
        return ws

    def setup(self, ws, key=None):
        out = io.StringIO()
        env = {k: v for k, v in os.environ.items() if k not in ('AI_RESEARCH_AIRR_KEY', 'AI_RESEARCH_TRACE_FILE')}
        if key:
            env['AI_RESEARCH_AIRR_KEY'] = key
        with patch.dict(os.environ, env, clear=True), contextlib.redirect_stdout(out):
            runtime.setup_airr(ws, Path(sys.executable))
            self.assertNotIn('AI_RESEARCH_AIRR_KEY', os.environ)
        return out.getvalue()

    def test_without_key_creates_launchers_only(self):
        with tempfile.TemporaryDirectory() as folder:
            ws = self.workspace(folder)
            log = self.setup(ws)
            self.assertIn('AIRR_NOT_CONNECTED', log)
            self.assertTrue((ws / 'tools/airr.ps1').read_bytes().startswith(b'\xef\xbb\xbf'))
            self.assertTrue(os.access(ws / 'tools/airr.sh', os.X_OK))
            self.assertIn('.airr/', (ws / '.gitignore').read_text(encoding='utf-8').splitlines())
            self.assertFalse((ws / '.airr/config.json').exists())

    def test_key_connects_once_and_is_never_logged(self):
        with tempfile.TemporaryDirectory() as folder:
            ws = self.workspace(folder)
            log = self.setup(ws, 'airr_secret_value')
            self.assertIn('AIRR_CONNECTED', log)
            self.assertNotIn('airr_secret_value', log)
            self.assertEqual(json.loads((ws / 'client-args.json').read_text())[-3:], ['login', '--key', 'airr_secret_value'])
            launcher = subprocess.run(['bash', str(ws / 'tools/airr.sh'), 'whoami'], capture_output=True, text=True)
            self.assertEqual(launcher.returncode, 0, launcher.stderr)
            self.assertEqual(json.loads((ws / 'client-args.json').read_text())[-1], 'whoami')

    def test_bad_key_never_fails_install(self):
        with tempfile.TemporaryDirectory() as folder:
            ws = self.workspace(folder)
            log = self.setup(ws, 'airr_bad')
            self.assertIn('AIRR_LOGIN_SKIPPED', log)
            self.assertFalse((ws / '.airr/config.json').exists())

    def test_existing_install_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            ws = self.workspace(folder)
            (ws / 'tools').mkdir()
            (ws / 'tools/airr.ps1').write_text('# from module 7\n', encoding='utf-8')
            (ws / 'tools/airr.sh').write_text('# from module 7\n', encoding='utf-8')
            (ws / '.airr').mkdir()
            (ws / '.airr/config.json').write_text('{"api_key": "airr_existing"}', encoding='utf-8')
            log = self.setup(ws, 'airr_new_key')
            self.assertIn('AIRR_REUSE', log)
            self.assertEqual((ws / 'tools/airr.ps1').read_text(encoding='utf-8'), '# from module 7\n')
            self.assertEqual((ws / 'tools/airr.sh').read_text(encoding='utf-8'), '# from module 7\n')
            self.assertIn('airr_existing', (ws / '.airr/config.json').read_text(encoding='utf-8'))
            self.assertFalse((ws / 'client-args.json').exists())


class RuntimeTests(unittest.TestCase):
    def test_module7_material_installer_verifies_hashes_and_preserves_edits(self):
        with tempfile.TemporaryDirectory(prefix='module7 materials ') as scratch:
            root = Path(scratch); web = root / 'web'; workspace = root / 'workspace'
            web.mkdir(); workspace.mkdir()
            first = web / 'part-a.ipynb'; first.write_bytes(b'notebook-v1')
            second = web / 'workbook.md'; second.write_bytes(b'workbook-v1')
            def item(source, destination):
                content = source.read_bytes()
                return {'url': source.as_uri(), 'path': destination,
                        'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)}
            manifest = {'schema_version':'ai-for-research.course-materials.v1', 'module_id':'module-07', 'files':[
                item(first, 'course-materials/module-07/notebooks/part-a.ipynb'),
                item(second, 'course-materials/module-07/templates/workbook.md'),
            ]}
            manifest_path = web / 'manifest.json'
            manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
            prefix = web.as_uri() + '/'
            result = runtime.install_course_materials(workspace, manifest_path.as_uri(), prefix)
            self.assertEqual((result['installed'], result['reused'], result['updates_available']), (2,0,0))
            learner_copy = workspace / 'course-materials/module-07/notebooks/part-a.ipynb'
            learner_copy.write_bytes(b'learner edit')
            first.write_bytes(b'notebook-v2')
            manifest['files'][0] = item(first, 'course-materials/module-07/notebooks/part-a.ipynb')
            manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
            result = runtime.install_course_materials(workspace, manifest_path.as_uri(), prefix)
            self.assertEqual((result['installed'], result['reused'], result['updates_available']), (0,1,1))
            self.assertEqual(learner_copy.read_bytes(), b'learner edit')
            update = workspace / '.course-updates/course-materials/module-07/notebooks/part-a.ipynb'
            self.assertEqual(update.read_bytes(), b'notebook-v2')

    def test_module7_material_installer_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory(prefix='module7 unsafe ') as scratch:
            root=Path(scratch); source=root/'file'; source.write_bytes(b'x')
            manifest=root/'manifest.json'
            manifest.write_text(json.dumps({'schema_version':'ai-for-research.course-materials.v1','module_id':'module-07','files':[{
                'url':source.as_uri(),'path':'../outside','sha256':hashlib.sha256(b'x').hexdigest(),'bytes':1
            }]}), encoding='utf-8')
            with self.assertRaises(RuntimeError):
                runtime.install_course_materials(root/'workspace', manifest.as_uri(), root.as_uri()+'/')

    def test_module7_material_installer_rejects_manifest_outside_download_root(self):
        with tempfile.TemporaryDirectory(prefix='module7 manifest root ') as scratch:
            root = Path(scratch)
            manifest = root / 'manifest.json'
            manifest.write_text('{}', encoding='utf-8')
            with self.assertRaisesRegex(RuntimeError, 'outside the approved download root'):
                runtime.install_course_materials(
                    root / 'workspace', manifest.as_uri(), (root / 'web').as_uri() + '/')

    def test_summary_distinguishes_reuse_additions_and_unconfirmed_attempts(self):
        def event(kind, target, status, details, action='snapshot'):
            return dict(kind=kind, target=target, status=status, details=details, action=action)
        events = [
            event('system-tool', 'git', 'before', 'present; source=git.exe'),
            event('path', 'C:/tools/envs/research/pyvenv.cfg', 'before', 'missing'),
            event('path', 'C:/tools/envs/research/pyvenv.cfg', 'before', 'file:later'),
            event('path', 'C:/tools/envs/research/pyvenv.cfg', 'after', 'file:later'),
            event('path', 'C:/tools/TinyTeX/tlpkg/texlive.tlpdb', 'before', 'file:old'),
            event('path', 'C:/tools/TinyTeX/tlpkg/texlive.tlpdb', 'after', 'file:new'),
            event('vscode-extension', 'saoudrizwan.claude-dev', 'before', 'present; profile=course'),
            event('vscode-extension', 'saoudrizwan.claude-dev', 'after', 'present; profile=course'),
            event('vscode-extension', 'mechatroner.rainbow-csv', 'before', 'missing; profile=course'),
            event('vscode-extension', 'mechatroner.rainbow-csv', 'after', 'present; profile=course'),
            event('vscode-extension', 'ThiagoSantosDevBR.openrouter-ai-monitor', 'before', 'missing; profile=course'),
            event('vscode-extension', 'ThiagoSantosDevBR.openrouter-ai-monitor', 'after', 'present; profile=course'),
            event('user-tool', 'uv', 'started', '', 'install'),
            event('python-packages', 'env', 'before', '{"packaging":null}'),
            event('python-packages', 'env', 'after', '{"packaging":"26.3"}'),
            event('tex-packages', 'tex', 'before', '["old"]'),
            event('tex-packages', 'tex', 'after', '["old","new"]'),
        ]
        result = summary.summarize(events)
        self.assertEqual(result['reused'], ['Cline', 'Git', 'TinyTeX'])
        self.assertEqual(result['added'], ['CSV viewer', 'LaTeX packages (1)', 'OpenRouter usage status bar', 'Python 3.12 + venv', 'packaging (Python package)'])
        self.assertNotIn('uv', result['added'])
        self.assertEqual(result['prepared'], [])

    def test_summary_of_unchanged_rerun_has_no_additions(self):
        events = [dict(action='snapshot', kind='python-packages', target='env', status=stage, details='{"packaging":"26.3"}') for stage in ('before', 'after')]
        self.assertEqual(summary.summarize(events), dict(reused=['packaging (Python package)'], added=[], prepared=[]))

    def test_shell_trace_json_escaping_and_quiet_exit_status(self):
        for platform in ('linux', 'macos'):
            with self.subTest(platform=platform), tempfile.TemporaryDirectory() as scratch:
                source = (ROOT / f'downloads/setup-{platform}.sh').read_text()
                helpers = source[source.index("trace_file=''\n"):source.index('log "SETUP_VERSION')]
                journal = Path(scratch) / 'trace.jsonl'
                script = 'mode=--check; dry_run=0; trace_platform=test; trace_root=/unused\n' + helpers
                script += '\ntrace_file=' + shlex.quote(str(journal)) + '\n'
                script += 'trace snapshot path ' + shlex.quote('path with "quotes" and \\slashes\nnext line') + ' before missing\n'
                script += 'quiet bash -c "echo hidden; echo diagnostic >&2"\n'
                script += 'if quiet bash -c "echo failed >&2; exit 7"; then exit 99; else result=$?; fi\n[[ "$result" == 7 ]]\n'
                result = subprocess.run(['bash'], input=script, text=True, capture_output=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertNotIn('hidden', result.stdout)
                events = [json.loads(line) for line in journal.read_text().splitlines()]
                self.assertEqual(events[0]['target'], 'path with "quotes" and \\slashes\nnext line')
                self.assertEqual(events[-1]['status'], 'failed')
                self.assertIn('diagnostic', journal.with_suffix('.log').read_text())

    def test_trace_snapshots_distinguish_missing_reused_and_modified_files(self):
        with tempfile.TemporaryDirectory() as scratch, patch.dict(os.environ):
            root = Path(scratch)
            journal = root / 'trace.jsonl'
            os.environ['AI_RESEARCH_TRACE_FILE'] = str(journal)
            target = root / 'file with spaces.txt'
            runtime.trace_path(target, 'before')
            target.write_text('first')
            runtime.trace_path(target, 'after')
            runtime.trace_path(target, 'before')
            target.write_text('user edit')
            runtime.trace_path(target, 'after')
            events = [json.loads(line) for line in journal.read_text().splitlines()]
            self.assertEqual(events[0]['details'], 'missing')
            self.assertEqual(events[1]['details'], events[2]['details'])
            self.assertNotEqual(events[2]['details'], events[3]['details'])

    def test_commands_are_quiet_and_failures_remain_in_diagnostics(self):
        with tempfile.TemporaryDirectory() as scratch, patch.dict(os.environ):
            journal = Path(scratch) / 'trace.jsonl'
            os.environ['AI_RESEARCH_TRACE_FILE'] = str(journal)
            runtime.run(sys.executable, '-c', 'print("tool detail")')
            with self.assertRaises(subprocess.CalledProcessError):
                runtime.run(sys.executable, '-c', 'import sys; print("missing package",file=sys.stderr); sys.exit(3)')
            events = [json.loads(line) for line in journal.read_text().splitlines()]
            self.assertEqual(events[-1]['status'], 'failed')
            self.assertEqual(events[-1]['details'], '3')
            self.assertNotIn('missing package', journal.read_text())
            self.assertIn('missing package', journal.with_suffix('.log').read_text())

    def test_config_scopes_downloads_and_preserves_existing_files(self):
        with tempfile.TemporaryDirectory(prefix='research config ') as scratch:
            workspace = Path(scratch) / 'workspace'; root = Path(scratch) / 'local tools'
            env = {'UV_CACHE_DIR': str(root / 'cache'), 'PATH': '/course/bin:/usr/bin'}
            runtime.configure(workspace, 'codex', root, env)
            config_path = workspace / '.codex/config.toml'
            config = tomllib.loads(config_path.read_text())
            self.assertEqual(config['approval_policy'], 'never')
            self.assertEqual(config['sandbox_mode'], 'workspace-write')
            self.assertEqual(config['sandbox_workspace_write'], {'network_access': True, 'writable_roots': [str(root)]})
            config_path.write_text('approval_policy = "on-request"\n')
            runtime.configure(workspace, 'codex', root, env)
            self.assertEqual(config_path.read_text(), 'approval_policy = "on-request"\n')
            self.assertFalse((workspace / '.venv').exists())

    def test_unix_bundle_and_reuse_do_not_touch_system_tex(self):
        for system, arch, folder, url_suffix in [('Linux','x86_64','.TinyTeX','linux-x86_64'), ('Linux','aarch64','.TinyTeX','linux-arm64'), ('Darwin','arm64','TinyTeX','darwin')]:
            with self.subTest(system=system, arch=arch), tempfile.TemporaryDirectory(prefix='research tex ') as scratch, patch.dict(os.environ):
                root = Path(scratch) / 'tools'; root.mkdir()
                calls = []
                def download(url, target):
                    calls.append(url)
                    self.assertIn(url_suffix, url)
                    with tarfile.open(target, 'w:xz') as bundle:
                        for name in ['tlmgr', 'xelatex', 'xdvipdfmx']:
                            info = tarfile.TarInfo(f'{folder}/bin/test-platform/{name}')
                            info.mode = 0o755; info.size = 1
                            bundle.addfile(info, io.BytesIO(b'x'))
                with patch.object(runtime.platform, 'system', return_value=system), patch.object(runtime.platform, 'machine', return_value=arch), patch.object(runtime.urllib.request, 'urlretrieve', side_effect=download), patch.object(runtime, 'run') as command:
                    binary = runtime.install_tex(root)
                    runtime.install_tex(root)
                self.assertEqual(len(calls), 1)
                self.assertEqual(binary, root / 'TinyTeX/bin/test-platform')
                self.assertTrue(all(str(c.args[0]).startswith(str(root)) for c in command.call_args_list))
                installs = [c.args for c in command.call_args_list if c.args[1] == 'install']
                self.assertTrue(all('setspace' in args and 'parskip' in args and 'fontsize' in args for args in installs))
                self.assertTrue(all('dvipdfmx' in args for args in installs))
                self.assertTrue(any(c.args[1] == 'setspace.sty' for c in command.call_args_list))
                self.assertTrue(any(c.args[1] == 'fontsize.sty' for c in command.call_args_list))

    def test_missing_xdvipdfmx_driver_fails_with_clear_message(self):
        with tempfile.TemporaryDirectory() as scratch:
            bin_dir = Path(scratch) / 'TinyTeX/bin/universal-darwin'; bin_dir.mkdir(parents=True)
            for name in ('tlmgr', 'xelatex'):
                (bin_dir / name).write_text('x'); (bin_dir / name).chmod(0o755)
            with patch.object(runtime, 'run'):
                with self.assertRaisesRegex(RuntimeError, 'xdvipdfmx is missing'):
                    runtime.install_tex(Path(scratch))

    def test_compatible_node_is_reused_without_network(self):
        with tempfile.TemporaryDirectory() as scratch, patch.object(runtime.shutil, 'which', return_value='/usr/bin/node'), patch.object(runtime, 'run', return_value=subprocess.CompletedProcess([], 0, stdout='22.1.0')), patch.object(runtime.urllib.request, 'urlopen') as network:
            self.assertEqual(runtime.ensure_node(Path(scratch), 'claude'), Path('/usr/bin'))
            network.assert_not_called()

    def test_course_node_is_reused_when_its_npm_is_not_on_shell_path(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            binary = root / 'node/node-v24.21.0-linux-x64/bin'
            binary.mkdir(parents=True)
            (binary / 'node').touch()
            (binary / 'npm').touch()
            completed = subprocess.CompletedProcess([], 0, stdout='24.21.0')
            with patch.object(runtime.shutil, 'which', return_value=None), patch.object(runtime, 'run', return_value=completed), patch.object(runtime.urllib.request, 'urlopen') as network:
                self.assertEqual(runtime.ensure_node(root, 'openrouter'), binary)
                network.assert_not_called()

    def test_old_node_checksum_failure_keeps_system_node(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            filename = 'node-v24.1.0-linux-x64.tar.xz'
            response = io.BytesIO(('0' * 64 + '  ' + filename + '\n').encode())
            def download(url, target):
                Path(target).write_bytes(b'invalid archive')
            with patch.object(runtime.platform, 'system', return_value='Linux'), patch.object(runtime.platform, 'machine', return_value='x86_64'), patch.object(runtime.shutil, 'which', return_value='/usr/bin/node'), patch.object(runtime, 'run', return_value=subprocess.CompletedProcess([], 0, stdout='20.1.0')), patch.object(runtime.urllib.request, 'urlopen', return_value=response), patch.object(runtime.urllib.request, 'urlretrieve', side_effect=download):
                with self.assertRaisesRegex(RuntimeError, 'checksum mismatch'):
                    runtime.ensure_node(root, 'claude')
            self.assertFalse((root / 'node' / filename.removesuffix('.tar.xz')).exists())

    def test_cline_rules_use_course_environment_without_storing_a_key(self):
        with tempfile.TemporaryDirectory() as scratch:
            workspace = Path(scratch) / 'workspace'; workspace.mkdir()
            (workspace / 'AGENTS.md').write_text('Course rules')
            runtime.configure(workspace, 'openrouter', Path(scratch) / 'tools', {'PATH':'/course/bin:/usr/bin'})
            self.assertEqual((workspace / '.clinerules/course.md').read_text(), 'Course rules')
            self.assertFalse((workspace / '.codex/config.toml').exists())

    def test_claude_bootstrap_points_to_compact_workspace_rules_and_preserves_existing_file(self):
        with tempfile.TemporaryDirectory() as scratch:
            workspace = Path(scratch) / 'workspace'; workspace.mkdir()
            root = Path(scratch) / 'tools'
            runtime.configure(workspace, 'claude', root, {'PATH':'/course/bin:/usr/bin'})
            guide = workspace / 'CLAUDE.md'
            self.assertIn('AGENTS.md', guide.read_text())
            self.assertIn('.ai/PROJECT_STATE.md', guide.read_text())
            guide.write_text('Learner rules\n')
            runtime.configure(workspace, 'claude', root, {'PATH':'/course/bin:/usr/bin'})
            self.assertEqual(guide.read_text(), 'Learner rules\n')

    def test_bootstrap_pdf_failure_never_reports_ready(self):
        self.exercise_main(fail_pdf=True)

    def test_bootstrap_pdf_success_writes_receipt_and_config(self):
        self.exercise_main(fail_pdf=False)

    def test_package_install_failure_never_reports_ready(self):
        self.exercise_main(fail_pdf=False, python_failure='install')

    def test_package_import_failure_never_reports_ready(self):
        self.exercise_main(fail_pdf=False, python_failure='import')

    def test_wrong_python_environment_never_reports_ready(self):
        self.exercise_main(fail_pdf=False, python_failure='environment')

    def exercise_main(self, fail_pdf, python_failure=None):
        with tempfile.TemporaryDirectory(prefix='research runtime ') as scratch, patch.dict(os.environ):
            workspace = Path(scratch) / 'workspace'; workspace.mkdir()
            root = Path(scratch) / 'local tools'
            commands = []
            def command(*args, **kwargs):
                commands.append(tuple(map(str, args)))
                if 'pip' in args and python_failure == 'install':
                    raise subprocess.CalledProcessError(1, args)
                if '-c' in args:
                    if 'PackageNotFoundError' in args[-1]:
                        return subprocess.CompletedProcess(args, 0, stdout='{"packaging":null}')
                    if python_failure == 'import':
                        raise subprocess.CalledProcessError(1, args)
                    prefix = root / 'envs/research' if python_failure != 'environment' else root / 'wrong-env'
                    return subprocess.CompletedProcess(args, 0, stdout=json.dumps({
                        'executable': str(args[0]), 'prefix': str(prefix),
                        'base_prefix': str(root / 'python'), 'version': '3.12.15',
                        'packages': {'packaging': '26.0'},
                    }))
                if args[0] == 'pandoc':
                    if fail_pdf:
                        raise subprocess.CalledProcessError(1, args)
                    Path(args[-1]).write_bytes(b'%PDF-test')
            with patch.object(runtime, 'tool_root', return_value=root), patch.object(runtime.shutil, 'which', return_value='/usr/bin/uv'), patch.object(runtime, 'run', side_effect=command), patch.object(runtime, 'ensure_node', return_value=root / 'node/bin'), patch.object(runtime, 'install_tex', return_value=root / 'TinyTeX/bin/test'), patch.object(runtime, 'install_course_materials', return_value={'installed': 13}), patch('sys.argv', ['setup-runtime.py','--workspace',str(workspace),'--agent','codex']), contextlib.redirect_stdout(io.StringIO()) as output:
                if fail_pdf or python_failure:
                    error = RuntimeError if python_failure == 'environment' else subprocess.CalledProcessError
                    with self.assertRaises(error):
                        runtime.traced_main()
                else:
                    runtime.traced_main()
            passed = not fail_pdf and not python_failure
            self.assertEqual('RUNTIME_READY' in output.getvalue(), passed)
            self.assertEqual((workspace / '.codex/config.toml').exists(), passed)
            self.assertIn(('/usr/bin/uv', 'python', 'install', '3.12'), commands)
            self.assertTrue(str(root) in os.environ['UV_PROJECT_ENVIRONMENT'])
            self.assertFalse((workspace / '.venv').exists())
            journal = Path(os.environ['AI_RESEARCH_TRACE_FILE'])
            events = [json.loads(line) for line in journal.read_text().splitlines()]
            self.assertEqual(events[-1]['status'], 'completed' if passed else 'after')
            if not passed:
                self.assertTrue(any(e['action'] == 'phase' and e['status'] == 'failed' for e in events))
                self.assertTrue(any(e['action'] == 'snapshot' and e['status'] == 'after' for e in events))
            if passed:
                receipt = json.loads((workspace / 'tools/runtime-env.json').read_text())
                self.assertEqual(receipt['tool_root'], str(root))
                self.assertEqual(receipt['install_trace'], str(journal))
                self.assertEqual(receipt['python']['prefix'], str(root / 'envs/research'))
                self.assertEqual(receipt['env']['VIRTUAL_ENV'], receipt['env']['UV_PROJECT_ENVIRONMENT'])
                settings = json.loads((workspace / '.vscode/settings.json').read_text())
                self.assertEqual(settings['python.defaultInterpreterPath'], receipt['python']['executable'])
                self.assertIn(('/usr/bin/uv', 'pip', 'install', '--python', receipt['python']['executable'], 'packaging>=24'), commands)


if __name__ == '__main__':
    unittest.main()
