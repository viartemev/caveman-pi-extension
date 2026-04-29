# Caveman for pi

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![pi package](https://img.shields.io/badge/pi-package-blue)](https://github.com/mariozechner/pi-coding-agent)
[![Version](https://img.shields.io/badge/version-0.2.0-green)](package.json)

Ultra-compressed communication mode for [`pi`](https://github.com/mariozechner/pi-coding-agent): fewer tokens, same technical substance.

`pi-caveman` packages the original [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) prompt/skills as a native pi package with persistent modes, slash commands, and bundled helper skills.

## Why

Coding agents often spend tokens on polite filler. Caveman mode removes filler while preserving exact technical meaning.

```text
Before: Sure! I'd be happy to help. The issue is likely caused by...
After: Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:
```

## Features

- Persistent caveman response mode across turns
- Intensity levels: `lite`, `full`, `ultra`, `wenyan-lite`, `wenyan-full`, `wenyan-ultra`
- Slash commands for quick mode switching
- Natural-language disable: `normal mode`, `stop caveman`, `caveman off`
- Bundled skills:
  - terse commit messages
  - terse code review comments
  - markdown memory compression
- Static `/caveman-help` command without model call
- Default mode via env/config
- Upstream sync script for original caveman assets

## Install

### From GitHub

```bash
pi install git:github.com/viartemev/caveman-pi-extension
```

Project-local install:

```bash
pi install -l git:github.com/viartemev/caveman-pi-extension
```

### From local clone

```bash
git clone git@github.com:viartemev/caveman-pi-extension.git
pi install ./caveman-pi-extension
```

Try without installing:

```bash
pi -e ./caveman-pi-extension
```

## Commands

| Command | Action |
| --- | --- |
| `/caveman` | Enable default `full` mode |
| `/caveman lite` | Tight but normal grammar |
| `/caveman full` | Classic caveman: fragments, no filler |
| `/caveman ultra` | Maximum terse technical shorthand |
| `/caveman wenyan-lite` | Semi-classical terse style |
| `/caveman wenyan-full` | Classical terse style |
| `/caveman wenyan-ultra` | Extreme classical compression |
| `/caveman off` | Disable caveman mode |
| `/caveman-default <mode>` | Save default mode to `~/.config/caveman/config.json` |
| `/caveman-help` | Show quick reference without model call |
| `/caveman-commit [context]` | Generate terse Conventional Commit message |
| `/caveman-review [context]` | Generate one-line actionable review comments |
| `/caveman-compress <filepath>` | Compress markdown/memory file |

Natural-language disable also works:

```text
stop caveman
normal mode
caveman off
```

## Config

Default mode resolution:

1. `CAVEMAN_DEFAULT_MODE`
2. `~/.config/caveman/config.json`
3. `full`

Example:

```bash
export CAVEMAN_DEFAULT_MODE=ultra
```

```json
{ "defaultMode": "lite" }
```

Use `off` to keep commands installed but disable auto-activation.

## Package layout

```text
extensions/caveman.ts       # pi extension adapter + compact mode prompts
skills/caveman-commit       # terse commit skill
skills/caveman-review       # terse review skill
caveman-compress/SKILL.md   # memory compression skill
caveman-compress/scripts/   # compression helper scripts
scripts/sync-upstream.sh    # syncs upstream caveman assets
vendor/caveman              # upstream git submodule
package.json                # pi package manifest
```

## How it works

The pi extension hooks into:

- `session_start` — restores mode and status badge
- `input` — handles enable/disable phrases
- `before_agent_start` — injects compact active-mode rules every turn
- `registerCommand` — registers slash commands

Skills are exposed by `package.json` manifest, not by extension runtime discovery.

## Updating from upstream caveman

This repo tracks upstream as a git submodule:

```text
vendor/caveman -> https://github.com/JuliusBrussee/caveman
```

Update bundled skills/scripts:

```bash
git submodule update --init --recursive
npm run update:upstream
```

This syncs pi-needed assets only:

- `skills/caveman*`
- `caveman-compress/SKILL.md`
- `caveman-compress/scripts/*`

Only `caveman-commit`, `caveman-review`, and `caveman-compress` are loaded as pi skills by default. Base caveman/help prompts remain in repo for upstream sync/reference; extension handles them directly.

The pi adapter stays in `extensions/caveman.ts`.

## License

MIT. See [LICENSE](LICENSE).

## Attribution

Caveman rules and skills originate from [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman), MIT licensed.
