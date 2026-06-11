# Agent Guidelines

When working on this project, please adhere to the following guidelines:

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

Note: `ddev utility rebuild -s <service>` is currently broken for profile-gated
services on DDEV HEAD (the build succeeds but the recreate step cannot resolve
the service). Track [ddev/ddev#8463](https://github.com/ddev/ddev/pull/8463)
for the fix. Until that lands, `ddev restart && ddev start --profiles=pi` is
the correct and only reliable way to force a PI image rebuild and bring the
container up in tests.
