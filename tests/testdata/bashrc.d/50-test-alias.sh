#!/usr/bin/env bash
# Fixture for tests/test.bats.
# Defines a unique shell alias that the bashrc.d/ bats test asserts is
# available in an interactive shell session inside the PI container.
alias pi-test-alias='echo pi-test-alias-ok'
