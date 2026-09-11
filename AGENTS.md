# Agent Guidelines

When working on this project, please adhere to the following guidelines:

## Read the Documentation First
- **Always start by reading the project documentation.** It contains essential information for working on this project.
- **`README.md`**: Provides the main project overview and installation instructions.
- **`docs/architecture.md`**: Contains a detailed diagram and explanation of the system architecture and security boundaries. This is critical for understanding how the components interact.
- **`docs/extensions.md`**: Explains the four extensibility seams (`build.d/`, `bashrc.d/`, `entrypoint.d/`, and `global/agent/extensions/`) and how to manage Pi extensions. Understanding these is critical for any modifications or feature additions.

## Ignoring `.ddev`
- Do not modify or perform extensive searches within the `.ddev` directory. This directory contains the installed version of this addon, which is used for testing changes. Focus your work on the source code outside of this directory.

## DDEV Environment
- This project is designed to be worked on within a DDEV environment.
- If the `IS_DDEV_PROJECT` environment variable is set, or if the `ddev` command is not available, you are already running inside a DDEV container. In this case, **never** attempt to execute commands prefixed with `ddev` (such as `ddev ...`); instead, run those commands directly (e.g., run `composer` or `drush` directly without the `ddev` prefix).

## Writing bats tests for the PI service

The `pi` service is gated behind an optional Docker Compose profile. A plain
`ddev restart` does not start it. Tests that need the PI container must use:

```
ddev restart && ddev start --profiles=pi
```

`ddev restart` alone reuses already-running services; since `pi` is not active
by default, the container will not exist and any subsequent `ddev exec --service pi`
call will fail with "no such service".

Note: `ddev restart` (including `--no-cache`) does not rebuild profile-gated
services ([ddev/ddev#8817](https://github.com/ddev/ddev/issues/8817)). While targeted rebuilding via
`ddev utility rebuild -s <service>` (or `ddev debug rebuild -s <service>`)
for profile-gated services was fixed in DDEV v1.25.3 ([ddev/ddev#8463](https://github.com/ddev/ddev/pull/8463)),
`ddev restart` does not support `--profiles` yet ([ddev/ddev#7904](https://github.com/ddev/ddev/issues/7904)).
Therefore, `ddev restart && ddev start --profiles=pi` is required after rebuilding to bring the
Pi container up with all dependencies.
