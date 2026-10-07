"""Runtime checks with no downloads and no changes to the real user's tools."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import tomllib
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('runtime', ROOT / 'downloads/setup-runtime.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class RuntimeTests(unittest.TestCase):
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
                        for name in ['tlmgr', 'xelatex']:
                            info = tarfile.TarInfo(f'{folder}/bin/test-platform/{name}')
                            info.mode = 0o755; info.size = 1
                            bundle.addfile(info, io.BytesIO(b'x'))
                with patch.object(runtime.platform, 'system', return_value=system), patch.object(runtime.platform, 'machine', return_value=arch), patch.object(runtime.urllib.request, 'urlretrieve', side_effect=download), patch.object(runtime, 'run') as command:
                    binary = runtime.install_tex(root)
                    runtime.install_tex(root)
                self.assertEqual(len(calls), 1)
                self.assertEqual(binary, root / 'TinyTeX/bin/test-platform')
                self.assertTrue(all(str(c.args[0]).startswith(str(root)) for c in command.call_args_list))

    def test_compatible_node_is_reused_without_network(self):
        with tempfile.TemporaryDirectory() as scratch, patch.object(runtime.shutil, 'which', return_value='/usr/bin/node'), patch.object(runtime, 'run', return_value=subprocess.CompletedProcess([], 0, stdout='22.1.0')), patch.object(runtime.urllib.request, 'urlopen') as network:
            self.assertEqual(runtime.ensure_node(Path(scratch), 'claude'), Path('/usr/bin'))
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

    def test_bootstrap_pdf_failure_never_reports_ready(self):
        self.exercise_main(fail_pdf=True)

    def test_bootstrap_pdf_success_writes_receipt_and_config(self):
        self.exercise_main(fail_pdf=False)

    def exercise_main(self, fail_pdf):
        with tempfile.TemporaryDirectory(prefix='research runtime ') as scratch, patch.dict(os.environ):
            workspace = Path(scratch) / 'workspace'; workspace.mkdir()
            root = Path(scratch) / 'local tools'
            commands = []
            def command(*args, **kwargs):
                commands.append(tuple(map(str, args)))
                if args[0] == 'pandoc':
                    if fail_pdf:
                        raise subprocess.CalledProcessError(1, args)
                    Path(args[-1]).write_bytes(b'%PDF-test')
            with patch.object(runtime, 'tool_root', return_value=root), patch.object(runtime.shutil, 'which', return_value='/usr/bin/uv'), patch.object(runtime, 'run', side_effect=command), patch.object(runtime, 'ensure_node', return_value=root / 'node/bin'), patch.object(runtime, 'install_tex', return_value=root / 'TinyTeX/bin/test'), patch('sys.argv', ['setup-runtime.py','--workspace',str(workspace),'--agent','codex']), contextlib.redirect_stdout(io.StringIO()) as output:
                if fail_pdf:
                    with self.assertRaises(subprocess.CalledProcessError):
                        runtime.main()
                else:
                    runtime.main()
            self.assertEqual('RUNTIME_READY' in output.getvalue(), not fail_pdf)
            self.assertEqual((workspace / '.codex/config.toml').exists(), not fail_pdf)
            self.assertIn(('/usr/bin/uv', 'python', 'install', '3.12'), commands)
            self.assertTrue(str(root) in os.environ['UV_PROJECT_ENVIRONMENT'])
            self.assertFalse((workspace / '.venv').exists())
            if not fail_pdf:
                receipt = json.loads((workspace / 'tools/runtime-env.json').read_text())
                self.assertEqual(receipt['tool_root'], str(root))


if __name__ == '__main__':
    unittest.main()
