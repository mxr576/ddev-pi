#!/usr/bin/env bash
# Fixture for tests/test.bats.
# Exits non-zero to verify that a failing entrypoint.d/ hook emits a
# warning but does NOT crash the container (warning-not-crash behavior).
exit 1
