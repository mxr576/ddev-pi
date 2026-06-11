#!/usr/bin/env bash
# Fixture for tests/test.bats.
# Writes a sentinel file so the entrypoint.d/ bats test can assert
# observable side-effects produced by a hook are present after startup.
touch /tmp/entrypoint-sentinel.marker
