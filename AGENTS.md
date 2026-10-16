# Agent Guidelines

## Documentation Pointers
Read project documentation when relevant to your task:
- **`README.md`**: Project overview, setup, and usage instructions.
- **`docs/architecture.md`**: Read when modifying system architecture, container networking, or security boundaries.
- **`docs/extensions.md`**: Read when modifying extension hooks (`build.d/`, `bashrc.d/`, `entrypoint.d/`, `global/agent/extensions/`) or Pi extension management.

## File Search Boundary
- Do not search or modify `.ddev/`. It contains the installed addon used for testing; work on source files outside `.ddev/`.

## Environment & Execution Boundaries
- **Container Environment**: When running inside the DDEV container (`IS_DDEV_PROJECT` is set or `ddev` command is missing):
  - Do not run `ddev` or `bats` inside the container; `ddev` and `bats` tests run on the host.
- **Host Test Execution**: `tests/test.bats` runs on the host.
  - Profile-gated `pi` container: Tests requiring the `pi` container must start it from the host using:
    ```bash
    ddev restart && ddev start --profiles=pi
    ```
  - Note: `ddev restart` reuses active services and ignores profiles by default ([ddev/ddev#7904](https://github.com/ddev/ddev/issues/7904)). Running `ddev restart && ddev start --profiles=pi` ensures the `pi` container starts with all required dependencies.

## Diagrams
- Plain 7-bit ASCII only (`+`, `-`, `|`, `v`, `^`, `<`, `>`). Max 75 cols wide. No Unicode box-drawing characters (`┌─│└▼`). Space-padded.
