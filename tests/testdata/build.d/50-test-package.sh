#!/usr/bin/env bash
# Fixture build script for tests/test.bats.
# Installs 'jq', a small JSON processor that is NOT present in the base
# image.  The test asserts that this package is available inside the
# running PI container, verifying the build.d/ seam works end-to-end.
set -euo pipefail
apt-get update -q
apt-get install -y --no-install-recommends jq
rm -rf /var/lib/apt/lists/*
