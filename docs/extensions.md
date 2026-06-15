# Extending DDEV PI

This document explains the two ways to add functionality to the DDEV PI environment: through Pi's built-in extension management and through the DDEV PI add-on's extensibility seams.

## Managing Pi Extensions

Pi supports two types of extensions:

- **Global extensions:** Install with `ddev pi install <addon-ref>`. These are stored in `.ddev/pi/global/` and are local to your environment. Do not commit this directory to VCS.
- **Project extensions:** Install with `ddev pi install -l <addon-ref>`. These are stored in the project's `.pi/` directory. **Commit this directory to VCS** so that extensions are shared across your team.

To remove extensions, use `ddev pi remove` (global) or `ddev pi remove -l` (project).

## DDEV PI Extensibility Seams

DDEV PI exposes four extensibility seams so addon authors and project maintainers can customize or extend the environment without forking the base addon. Each seam has a different lifecycle, execution context, and activation cost.

### Seam overview

| Seam | Runs as | Activated by | Notes |
|---|---|---|---|
| `build.d/` | `root` (or `pi` via `sudo -u`) | Rebuild | Scripts execute during image build |
| `bashrc.d/` | `pi` (interactive) | Restart | Interactive shell only |
| `entrypoint.d/` | `pi` (with `sudo` available) | Restart | Container startup hooks |
| `global/agent/extensions/` | Pi agent | Restart | Independent command listeners |

### `build.d/` — build-time package installation

Place shell scripts here to install additional packages or make system-level changes during the Docker image build. Scripts run as `root` in lexicographic (sorted) order. Use numeric prefixes to control execution order and to avoid conflicts with existing scripts.

The naming bands are:

- `00–09`: core image setup (reserved)
- `10–49`: runtimes and infrastructure
- `50–89`: tools and utilities
- `90–99`: project-specific overrides

If you need to run a step as the `pi` user inside a build script, prefix the command with `sudo -u ${USERNAME}`.

> **Changes to `build.d/` require a full image rebuild** to take effect. Run `ddev debug rebuild` or equivalent.

### `bashrc.d/` — interactive shell ergonomics

Place scripts here to customize the interactive shell experience inside the PI container. Scripts are sourced in sorted order whenever a user enters the container (e.g., via `ddev ssh --service=pi`).

This seam is **for interactive shells only**. Scripts placed here do not affect PI's autonomous tool execution or entrypoint hooks.

> **A `ddev restart` is sufficient** to pick up changes. No rebuild is needed.

### `entrypoint.d/` — runtime startup hooks

Place scripts here to run initialization logic on every container startup. Scripts execute as the `pi` user in sorted order. `sudo` is available inside these scripts if you need root-level steps.

Hook failures emit a warning but do not crash the container, so a broken hook will not prevent the PI service from starting.

> **A `ddev restart` is sufficient** to pick up changes. No rebuild is needed.

### `global/agent/extensions/` — PI agent command routing

This directory is a mounted path where the PI agent discovers additional command extension files. Extensions are independent listeners and are not processed as an ordered pipeline, so **numeric prefixes have no effect** here.

To avoid filename collisions with other addons, use an addon-specific prefix in every filename, for example:

```
myaddon-summarize.ts
myaddon-review.ts
```

> **A `ddev restart` is sufficient** to pick up new or updated extensions. No rebuild is needed.
