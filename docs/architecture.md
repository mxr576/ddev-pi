# DDEV PI Add-on Architecture

This document provides a visual and narrative overview of the `ddev-pi` add-on's system architecture, defining the boundaries between the containerized environment and the host system.

## System Boundary Diagram (ASCII)

The following diagram illustrates the key components, boundaries, and data flows within the DDEV Pi environment.

```
+-----------------------------------------------------------------------------------------+
| OUTSIDE SYSTEM BOUNDARY: Host Environment & Public Network                              |
|                                                                                         |
|  +--------------------+      +--------------------+      +---------------------------+  |
|  | Host User Terminal |      | Host Sensitive SSH |      | External LLM Provider APIs|  |
|  | (Runs "ddev pi")   |      | (e.g., ~/.ssh)     |      | (OpenAI, Anthropic, etc.) |  |
|  +---------+----------+      +---------+----------+      +-------------+-------------+  |
|            |                           |                               ^                |
|            |                           | (EXPLICITLY BLOCKED)          | (Outbound only |
|            |                           v                               | if configured) |
| . . . . . .|. . . . . . . . . . . . . .X. . . . . . . . . . . . . . . .|. . . . . . . . |
|            | (ddev exec wrapper)                                       |                |
|            v                                                           v                |
| +-------------------------------------------------------------------------------------+ |
| | INSIDE SYSTEM BOUNDARY: Containerized Stack (DDEV Environment)                      | |
| |                                                                                     | |
| |  +-------------------------------------------------------------------------------+  | |
| |  | Pi Sidecar Container (ddev-${DDEV_SITENAME}-pi)                               |  | |
| |  |                                                                               |  | |
| |  |   +-----------------------+              +--------------------------------+   |  | |
| |  |   |  Pi Coding Agent CLI  |<------------>| Home Dir: /home/pi (Volume)    |   |  | |
| |  |   |  (pi/tools running)   |              | - .pi/ (Agent state & cache)   |   |  | |
| |  |   +-----------+-----------+              | - .pi/agent (Global extensions)|   |  | |
| |  |               |                          +--------------------------------+   |  | |
| |  |               v                                                               |  | |
| |  |   +-----------------------+                                                   |  | |
| |  |   | Extensibility Seams   |                                                   |  | |
| |  |   | - build.d/ (Packages) |                                                   |  | |
| |  |   | - entrypoint.d/ (Hooks)                                                   |  | |
| |  |   | - bashrc.d/ (Shell)   |                                                   |  | |
| |  |   +-----------------------+                                                   |  | |
| |  +---------------+---------------------------------------------------------------+  | |
| |                  |                                    ^                             | |
| |                  | (Direct Access)                    | (DDEV Private Network       | |
| |                  v                                    |  via trebormc/ddev-ai-ssh)  | |
| |  +---------------+--------------------------+         v                             | |
| |  | Project Workspace Root (/var/www/html)   |      +------------------------------+  | |
| |  | - Application Source Code (Read/Write)   |      | Web Container                |  | |
| |  | - .pi/ Directory (Shared configuration & |      | (Web server, PHP, Database,  |  | |
| |  |   project-specific extensions)           |      |  Drush, etc.)                |  | |
| |  +------------------------------------------+      +------------------------------+  | |
| +-------------------------------------------------------------------------------------+ |
+-----------------------------------------------------------------------------------------+
```

## Boundary Breakdown

### What is INSIDE the boundary?
*   **`pi` Container Sandbox:** An isolated, non-privileged sidecar container (`ddev-${DDEV_SITENAME}-pi`).
*   **Workspace `/var/www/html`:** Mounted from the host project root, giving the agent read/write access to the codebase.
*   **Project Config `.pi/`:** Located in the workspace, this directory holds VCS-committed settings and extensions shared across the team.
*   **Named Docker Volume `pi-agent`:** A persistent, project-specific volume that stores local user state, command history, and global extensions inside `/home/pi/.pi`. It is isolated from the host.
*   **Extensibility Seams:** `build.d/`, `entrypoint.d/`, and `bashrc.d/` directories provide hooks for customizing the container at different lifecycle stages.
*   **Private Container Network:** Enables secure communication between the `pi` container and other DDEV services (like the `web` container) via a pre-configured SSH bridge.

### What is OUTSIDE the boundary?
*   **Host-Level Sensitive Directories:** Host directories like `~/.ssh` and the global `~/.pi` are explicitly **not** mounted to ensure strict credential and state isolation.
*   **Host Shell/Terminal:** The developer interacts via a custom `ddev pi` command, which acts as a secure proxy to execute commands inside the container.
*   **Public Internet:** Network access is disabled by default (`PI_OFFLINE=1`) as a security measure. The user can explicitly enable it to allow the agent to contact external LLM provider APIs.

## Clipboard integration

To allow the containerized Pi Coding Agent to interact with the host system's clipboard without breaching container boundaries, opening ports, or exposing host networks, the add-on implements a **Shared Volume File Bridge**.

### How it works:
1. **Container Interceptors:** Standard Linux clipboard utilities (`xclip`, `xsel`, `wl-copy`) are replaced with a mock wrapper script inside the container's `/usr/local/bin/`.
2. **Display Emulation:** The container runs with the `DISPLAY: ":0"` environment variable defined. This satisfies the Pi Coding Agent's platform detection logic, forcing it to invoke the Linux clipboard tools instead of falling back to OSC 52.
3. **Pending File Bridge:** When the agent triggers a clipboard write (such as via the `/copy` command), the mock utility captures the standard input and writes the payload atomically to the shared project volume at `/var/www/html/.ddev/.clipboard_pending`.
4. **Host Clipboard Daemon:** On the host, the custom `ddev pi` wrapper starts a lightweight background Python daemon (`pi/clipboard-helper.py`) that monitors the project directory. When it detects `.clipboard_pending`, it reads the contents, copies them to the host's system clipboard using native host OS utilities (like `pbcopy`, `clip.exe`, or `wl-copy`/`xclip`), and then deletes the pending file.

This design is fully secure, bypasses host firewalls, opens no ports, and works cross-platform across macOS, Windows/WSL, and Linux.

> [!WARNING]
> While these boundaries isolate the process space and global host directories, the agent has full write access to the project workspace (`/var/www/html`). For details on how malicious actors or prompt injections can exploit this shared space to escape to the host and how to protect against it, please see the [Security Advisory and Sandbox Hardening Guide](SECURITY.md).
