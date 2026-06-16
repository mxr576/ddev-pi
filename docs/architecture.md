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

> [!WARNING]
> While these boundaries isolate the process space and global host directories, the agent has full write access to the project workspace (`/var/www/html`). For details on how malicious actors or prompt injections can exploit this shared space to escape to the host and how to protect against it, please see the [Security Advisory and Sandbox Hardening Guide](SECURITY.md).
