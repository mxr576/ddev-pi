#!/usr/bin/env bash
#ddev-generated
# 50-drupal-aliases.sh
#
# Drupal development aliases and helper functions for interactive shells
# inside the PI container.
#
# This script is sourced by ~/.bashrc when a user opens an interactive
# shell. It does NOT affect PI's autonomous tool execution, which routes
# through agent extensions.
#
# Numeric naming band:
#   50-89  Tools and utilities (this file lives in the tools band)

# ---------------------------------------------------------------------------
# SSH helper
# ---------------------------------------------------------------------------

# Safe SSH command wrapper - preserves quoting across SSH.
# Usage: ssh-cmd <host> <command> [args...]
ssh-cmd() {
  local host="$1"
  shift
  local cmd=""
  for arg in "$@"; do
    cmd="${cmd:+$cmd }$(printf "%q" "$arg")"
  done
  ssh "$host" "$cmd"
}

# ---------------------------------------------------------------------------
# Web container helpers
# ---------------------------------------------------------------------------

# Execute an arbitrary command inside the web container via SSH.
# Usage: web-exec <command> [args...]
web-exec() { ssh-cmd web "$@"; }

# Open an interactive bash shell in the web container.
web-shell() { ssh -t web bash; }

# ---------------------------------------------------------------------------
# Drupal toolchain proxies
#
# These functions forward calls through to the web container so that
# developers can type familiar commands (php, drush, etc.) directly in
# the PI shell without manually prefixing every call with "ssh web".
# ---------------------------------------------------------------------------

php()      { ssh-cmd web php "$@"; }
drush()    { ssh-cmd web ./vendor/bin/drush "$@"; }
composer() { ssh-cmd web composer "$@"; }
phpunit()  { ssh-cmd web ./vendor/bin/phpunit "$@"; }
phpstan()  { ssh-cmd web ./vendor/bin/phpstan "$@"; }
