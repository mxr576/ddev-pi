#!/usr/bin/env python3
#ddev-generated
import os
import sys
import time
import subprocess
import shutil
import signal

def copy_to_host_clipboard(text):
    # Detect platform
    platform = sys.platform

    # Check if WSL
    is_wsl = False
    if platform == 'linux':
        try:
            with open('/proc/version', 'r') as f:
                version_info = f.read().lower()
                if 'microsoft' in version_info or 'wsl' in version_info:
                    is_wsl = True
        except Exception:
            pass

    if platform == 'darwin':
        # macOS
        try:
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HOST] Trying macOS pbcopy...", flush=True)
            res = subprocess.run(
                ['pbcopy'],
                input=text.encode('utf-8'),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
                timeout=2
            )
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HOST] Successfully copied using pbcopy.", flush=True)
            return
        except subprocess.TimeoutExpired:
            raise Exception("pbcopy timed out after 2 seconds")
        except subprocess.CalledProcessError as e:
            stderr_str = e.stderr.decode('utf-8', errors='replace').strip() if e.stderr else 'No stderr output'
            raise Exception(f"pbcopy failed with exit code {e.returncode}: {stderr_str}")

    elif platform == 'win32' or is_wsl:
        # Windows / WSL
        clip_cmd = shutil.which('clip.exe') or shutil.which('clip')
        ps_cmd = shutil.which('powershell.exe') or shutil.which('powershell')

        utilities = []
        if clip_cmd:
            utilities.append(('clip', [clip_cmd], 'utf-8'))
        if ps_cmd:
            utilities.append(('powershell', [ps_cmd, '-NoProfile', '-Command', 'Set-Clipboard'], 'utf-16'))

        if not utilities:
            raise Exception("No Windows clipboard utility found (clip.exe or powershell.exe).")

        errors = []
        for name, cmd, encoding in utilities:
            try:
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HOST] Trying Windows/WSL {name}...", flush=True)
                subprocess.run(
                    cmd,
                    input=text.encode(encoding),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True,
                    timeout=2
                )
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HOST] Successfully copied using Windows/WSL {name}.", flush=True)
                return
            except subprocess.TimeoutExpired:
                errors.append(f"{name} timed out after 2 seconds")
            except subprocess.CalledProcessError as e:
                stderr_str = e.stderr.decode('utf-8', errors='replace').strip() if e.stderr else 'No stderr output'
                errors.append(f"{name} failed with exit code {e.returncode}: {stderr_str}")

        raise Exception("All available Windows/WSL clipboard utilities failed:\n  " + "\n  ".join(errors))

    elif platform == 'linux':
        # Native Linux
        wl_copy = shutil.which('wl-copy')
        xclip = shutil.which('xclip')
        xsel = shutil.which('xsel')

        utilities = []
        if wl_copy:
            utilities.append(('wl-copy', [wl_copy], 'utf-8'))
        if xclip:
            utilities.append(('xclip', [xclip, '-selection', 'clipboard'], 'utf-8'))
        if xsel:
            utilities.append(('xsel', [xsel, '--clipboard', '--input'], 'utf-8'))

        if not utilities:
            raise Exception("No Linux clipboard utility found (wl-copy, xclip, xsel). Please install one (e.g. wl-clipboard, xclip, or xsel).")

        errors = []
        for name, cmd, encoding in utilities:
            try:
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HOST] Trying Linux {name}...", flush=True)
                subprocess.run(
                    cmd,
                    input=text.encode(encoding),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True,
                    timeout=2
                )
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HOST] Successfully copied using Linux {name}.", flush=True)
                return
            except subprocess.TimeoutExpired:
                errors.append(f"{name} timed out after 2 seconds")
            except subprocess.CalledProcessError as e:
                stderr_str = e.stderr.decode('utf-8', errors='replace').strip() if e.stderr else 'No stderr output'
                errors.append(f"{name} failed with exit code {e.returncode}: {stderr_str}")

        raise Exception("All available Linux clipboard utilities failed:\n  " + "\n  ".join(errors))
    else:
        raise Exception(f"Unsupported platform: {platform}")

def main():
    if len(sys.argv) < 2:
        print("Usage: clipboard-helper.py <pending_file_path>")
        sys.exit(1)

    pending_file = sys.argv[1]
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HOST] Starting clipboard helper, watching {pending_file}...", flush=True)

    # Register signal handlers for clean exit
    def handle_signal(signum, frame):
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HOST] Stopping clipboard helper...", flush=True)
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    while True:
        if os.path.exists(pending_file):
            try:
                # Read the pending file atomically (written via mv on Unix)
                with open(pending_file, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()

                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HOST] Read pending clipboard content ({len(content)} chars).", flush=True)
                # Copy to host clipboard
                copy_to_host_clipboard(content)
            except Exception as e:
                print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HOST] Error copying to clipboard: {e}", flush=True)
            finally:
                # Delete the pending file
                try:
                    os.remove(pending_file)
                except Exception as e:
                    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [HOST] Error removing pending file: {e}", flush=True)
        time.sleep(0.05) # Poll every 50ms

if __name__ == '__main__':
    main()
