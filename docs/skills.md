# Managing AI Skills

AI Skills are specialized scripts, prompt templates, or instruction sets designed to extend your agent's capabilities with targeted tasks (e.g., custom web scraping, task automation, or domain-specific tooling). You can easily install, update, and manage skills in the DDEV PI environment using the `skills` tool.

Similar to Pi extensions, AI Skills can be installed at either the project level or the global (user) level:

- **Project Skills (Default):** Installed into the project's `.pi/skills/` directory. **Always commit this directory to VCS** so that custom agent skills are shared seamlessly across your development team.
- **Global Skills (User-level):** Installed into the `.ddev/pi/skills/` directory with the `-g` flag. These are local to your machine and are not shared via VCS.

---

## Installation Methods

There are two primary ways to install skills depending on whether you are working from within Pi's command-line interface or from your host terminal.

### 1. From Pi's Prompt (Non-Interactive)
If you are already conversing with Pi, you can execute a non-interactive bash command using the double exclamation escape (`!!`):

```bash
!! npx skills add <skill-ref> -a pi -y
```

> [!IMPORTANT]
> - **The `-y` (or `--yes`) flag is strictly required** here. Since Pi's prompt executes commands in a non-interactive container context, it will hang or fail if it expects interactive confirmation.
> - **The `-a pi` flag** must be provided so the installer knows to use the Pi adapter and target the appropriate paths (`.pi/` or `.ddev/pi/`).

### 2. From Your Host Terminal (Interactive)
If you want to view interactive prompts, inspect installation outputs, or work from your own shell, you can use the `ddev exec` wrapper:

- **Run directly from the host terminal:**
  ```bash
  ddev exec -s pi npx skills add <skill-ref> -a pi
  ```
- **Run inside an interactive container shell:**
  ```bash
  ddev exec -s pi bash
  # Once inside the container:
  npx skills add <skill-ref> -a pi
  ```

---

## Parameters and Flags

* **`<skill-ref>`**: The reference to the skill you want to install. This can be:
  * A GitHub repository shortpath (e.g., `mattpocock/skills`)
  * A direct URL to a specific subdirectory on GitHub containing a skill (e.g., `https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling`)
* **`-a pi` / `--agent pi`**: Instructs the manager to use the Pi-specific adapter configuration and directory structure.
* **`-g` / `--global`**: Installs the skill globally for your user (into `.ddev/pi/skills/`) instead of the project level.
* **`-y` / `--yes`**: Bypasses all interactive confirmation prompts.

---

## Examples

* **Install a project-level skill (committed to VCS):**
  ```bash
  ddev exec -s pi npx skills add mattpocock/skills -a pi
  ```
* **Install a global, user-level skill (local to your environment):**
  ```bash
  ddev exec -s pi npx skills add mattpocock/skills -a pi -g
  ```
* **Install a specific sub-directory skill from GitHub non-interactively via Pi's prompt:**
  ```bash
  !! npx skills add https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling -a pi -y
  ```
