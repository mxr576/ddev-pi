#!/usr/bin/env bats

# Bats is a testing framework for Bash
# Documentation https://bats-core.readthedocs.io/en/stable/
# Bats libraries documentation https://github.com/ztombol/bats-docs

# For local tests, install bats-core, bats-assert, bats-file, bats-support
# And run this in the add-on root directory:
#   bats ./tests/test.bats
# To exclude release tests:
#   bats ./tests/test.bats --filter-tags '!release'
# For debugging:
#   bats ./tests/test.bats --show-output-of-passing-tests --verbose-run --print-output-on-failure

setup() {
  set -eu -o pipefail

  # Override this variable for your add-on:
  export GITHUB_REPO=mxr576/ddev-pi

  TEST_BREW_PREFIX="$(brew --prefix 2>/dev/null || true)"
  export BATS_LIB_PATH="${BATS_LIB_PATH}:${TEST_BREW_PREFIX}/lib:/usr/lib/bats"
  bats_load_library bats-assert
  bats_load_library bats-file
  bats_load_library bats-support

  export DIR="$(cd "$(dirname "${BATS_TEST_FILENAME}")/.." >/dev/null 2>&1 && pwd)"
  export PROJNAME="test-$(basename "${GITHUB_REPO}")"
  mkdir -p "${HOME}/tmp"
  export TESTDIR="$(mktemp -d "${HOME}/tmp/${PROJNAME}.XXXXXX")"
  export DDEV_NONINTERACTIVE=true
  export DDEV_NO_INSTRUMENTATION=true
  ddev delete -Oy "${PROJNAME}" >/dev/null 2>&1 || true
  cd "${TESTDIR}"
  run ddev config --project-name="${PROJNAME}" --project-tld=ddev.site
  assert_success
  run ddev start -y
  assert_success
}

health_checks() {
  # Do something useful here that verifies the add-on

  # You can check for specific information in headers:
  # run curl -sfI https://${PROJNAME}.ddev.site
  # assert_output --partial "HTTP/2 200"
  # assert_output --partial "test_header"

  # Or check if some command gives expected output:
  DDEV_DEBUG=true run ddev launch
  assert_success
  assert_output --partial "FULLURL https://${PROJNAME}.ddev.site"
}

teardown() {
  set -eu -o pipefail
  ddev delete -Oy "${PROJNAME}" >/dev/null 2>&1
  # Persist TESTDIR if running inside GitHub Actions. Useful for uploading test result artifacts
  # See example at https://github.com/ddev/github-action-add-on-test#preserving-artifacts
  if [ -n "${GITHUB_ENV:-}" ]; then
    [ -e "${GITHUB_ENV:-}" ] && echo "TESTDIR=${HOME}/tmp/${PROJNAME}" >> "${GITHUB_ENV}"
  else
    [ "${TESTDIR}" != "" ] && rm -rf "${TESTDIR}"
  fi
}

@test "install from directory" {
  set -eu -o pipefail
  echo "# ddev add-on get ${DIR} with project ${PROJNAME} in $(pwd)" >&3
  run ddev add-on get "${DIR}"
  assert_success
  run ddev restart -y
  assert_success
  health_checks
}

# bats test_tags=release
@test "install from release" {
  set -eu -o pipefail
  echo "# ddev add-on get ${GITHUB_REPO} with project ${PROJNAME} in $(pwd)" >&3
  run ddev add-on get "${GITHUB_REPO}"
  assert_success
  run ddev restart -y
  assert_success
  health_checks
}

@test "entrypoint.d: empty directory does not cause errors" {
  set -eu -o pipefail
  run ddev add-on get "${DIR}"
  assert_success
  run ddev restart && ddev start --profiles=pi
  assert_success
  run ddev exec --service pi echo "container is up"
  assert_success
  assert_output --partial "container is up"
}

@test "entrypoint.d: hooks run in lexicographic order" {
  set -eu -o pipefail
  run ddev add-on get "${DIR}"
  assert_success

  HOOK_DIR="${TESTDIR}/.ddev/pi/entrypoint.d"
  mkdir -p "${HOOK_DIR}"

  cat > "${HOOK_DIR}/10-first.sh" <<'EOF'
#!/usr/bin/env bash
echo "10-first" >> /tmp/hook-order.log
EOF
  chmod +x "${HOOK_DIR}/10-first.sh"

  cat > "${HOOK_DIR}/50-second.sh" <<'EOF'
#!/usr/bin/env bash
echo "50-second" >> /tmp/hook-order.log
EOF
  chmod +x "${HOOK_DIR}/50-second.sh"

  run ddev restart && ddev start --profiles=pi
  assert_success

  run ddev exec --service pi cat /tmp/hook-order.log
  assert_success
  assert_output --partial "10-first"
  assert_output --partial "50-second"

  # Verify 10-first appears before 50-second in the file.
  run ddev exec --service pi bash -c 'grep -n "10-first" /tmp/hook-order.log | cut -d: -f1'
  assert_success
  FIRST_LINE="${output}"

  run ddev exec --service pi bash -c 'grep -n "50-second" /tmp/hook-order.log | cut -d: -f1'
  assert_success
  SECOND_LINE="${output}"

  [ "${FIRST_LINE}" -lt "${SECOND_LINE}" ]
}

@test "entrypoint.d: failing hook emits warning but container keeps running" {
  set -eu -o pipefail
  run ddev add-on get "${DIR}"
  assert_success

  HOOK_DIR="${TESTDIR}/.ddev/pi/entrypoint.d"
  mkdir -p "${HOOK_DIR}"

  cat > "${HOOK_DIR}/10-failing.sh" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
  chmod +x "${HOOK_DIR}/10-failing.sh"

  cat > "${HOOK_DIR}/20-after-failure.sh" <<'EOF'
#!/usr/bin/env bash
echo "still-running" >> /tmp/post-failure.log
EOF
  chmod +x "${HOOK_DIR}/20-after-failure.sh"

  run ddev restart && ddev start --profiles=pi
  assert_success

  # Container must still be reachable.
  run ddev exec --service pi echo "alive"
  assert_success
  assert_output --partial "alive"

  # The hook that follows the failing one must still have run.
  run ddev exec --service pi cat /tmp/post-failure.log
  assert_success
  assert_output --partial "still-running"
}

@test "entrypoint.d: successful hook produces observable side effects" {
  set -eu -o pipefail
  run ddev add-on get "${DIR}"
  assert_success

  HOOK_DIR="${TESTDIR}/.ddev/pi/entrypoint.d"
  mkdir -p "${HOOK_DIR}"

  cat > "${HOOK_DIR}/50-side-effect.sh" <<'EOF'
#!/usr/bin/env bash
touch /tmp/hook-ran.marker
EOF
  chmod +x "${HOOK_DIR}/50-side-effect.sh"

  run ddev restart && ddev start --profiles=pi
  assert_success

  run ddev exec --service pi test -f /tmp/hook-ran.marker
  assert_success
}

@test "build.d: contributed script installs package into PI container" {
  set -eu -o pipefail
  echo "# Testing build.d/ seam with project ${PROJNAME} in $(pwd)" >&3

  run ddev add-on get "${DIR}"
  assert_success

  # Copy the fixture build script into .ddev/pi/build.d/ so it is picked
  # up when the PI image is (re)built.
  BUILD_D_DIR="${TESTDIR}/.ddev/pi/build.d"
  mkdir -p "${BUILD_D_DIR}"
  cp "${DIR}/tests/testdata/build.d/50-test-package.sh" "${BUILD_D_DIR}/50-test-package.sh"
  chmod +x "${BUILD_D_DIR}/50-test-package.sh"

  # Restart rebuilds the PI image, then start --profiles=pi brings the
  # PI container up (it is an optional profile).
  run ddev restart && ddev start --profiles=pi
  assert_success

  # The fixture script installs 'jq', which must now be present inside the
  # running PI container.
  run ddev exec --service pi which jq
  assert_success

  run ddev exec --service pi jq --version
  assert_success
}

@test "build.d: empty directory (gitkeep only) builds and starts cleanly" {
  set -eu -o pipefail
  echo "# Testing empty build.d/ seam with project ${PROJNAME} in $(pwd)" >&3

  run ddev add-on get "${DIR}"
  assert_success

  # Confirm that .ddev/pi/build.d/ contains only .gitkeep (the default
  # state shipped by the add-on) — no extra scripts.
  BUILD_D_DIR="${TESTDIR}/.ddev/pi/build.d"
  run bash -c "ls '${BUILD_D_DIR}' | grep -v '^\.' | wc -l | tr -d ' '"
  assert_success
  assert_output "0"

  # Restart rebuilds the PI image, then start --profiles=pi brings the
  # PI container up (it is an optional profile).
  run ddev restart && ddev start --profiles=pi
  assert_success

  # The PI container must be reachable, proving the build succeeded.
  run ddev exec --service pi echo "container is up"
  assert_success
  assert_output --partial "container is up"
}
