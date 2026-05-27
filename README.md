[![add-on registry](https://img.shields.io/badge/DDEV-Add--on_Registry-blue)](https://addons.ddev.com)
[![tests](https://github.com/mxr576/ddev-pi/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/mxr576/ddev-pi/actions/workflows/tests.yml?query=branch%3Amain)
[![last commit](https://img.shields.io/github/last-commit/mxr576/ddev-pi)](https://github.com/mxr576/ddev-pi/commits)
[![release](https://img.shields.io/github/v/release/mxr576/ddev-pi)](https://github.com/mxr576/ddev-pi/releases/latest)

# DDEV Pi

## Overview

This add-on integrates Pi into your [DDEV](https://ddev.com/) project.

## Installation

```bash
ddev add-on get mxr576/ddev-pi
ddev restart
```

After installation, make sure to commit the `.ddev` directory to version control.

## Usage

| Command | Description |
| ------- | ----------- |
| `ddev describe` | View service status and used ports for Pi |
| `ddev logs -s pi` | Check Pi logs |

## Advanced Customization

To change the Docker image:

```bash
ddev dotenv set .ddev/.env.pi --pi-docker-image="ddev/ddev-utilities:latest"
ddev add-on get mxr576/ddev-pi
ddev restart
```

Make sure to commit the `.ddev/.env.pi` file to version control.

All customization options (use with caution):

| Variable | Flag | Default |
| -------- | ---- | ------- |
| `PI_DOCKER_IMAGE` | `--pi-docker-image` | `ddev/ddev-utilities:latest` |

## Credits

**Contributed and maintained by [@mxr576](https://github.com/mxr576)**
