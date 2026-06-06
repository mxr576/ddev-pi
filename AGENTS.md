# Agent Guidelines

When working on this project, please adhere to the following guidelines:

## Ignoring `.ddev`
- Do not modify or perform extensive searches within the `.ddev` directory. This directory contains the installed version of this addon, which is used for testing changes. Focus your work on the source code outside of this directory.

## DDEV Environment
- This project is designed to be worked on within a DDEV environment.
- If the `IS_DDEV_PROJECT` environment variable is set, or if the `ddev` command is not available, you are already running inside a DDEV container. In this case, **never** attempt to execute commands prefixed with `ddev` (such as `ddev ...`); instead, run those commands directly (e.g., run `composer` or `drush` directly without the `ddev` prefix).
