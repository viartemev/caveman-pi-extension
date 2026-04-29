# pi-caveman

Caveman mode for [pi](https://github.com/mariozechner/pi-coding-agent), packaged as an independent pi package.

Based on [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman): fewer output tokens, same technical substance.

## Features

- Persistent caveman response mode
- Intensity switching: `lite`, `full`, `ultra`, `wenyan-lite`, `wenyan`, `wenyan-ultra`
- pi slash commands
- Ships caveman skills for commit messages, code review, help, and memory compression
- Default mode via env/config

## Install

From local clone:

```bash
pi install /absolute/path/to/pi-caveman
```

Project-local install:

```bash
pi install -l /absolute/path/to/pi-caveman
```

Try without installing:

```bash
pi -e /absolute/path/to/pi-caveman
```

From git after publishing:

```bash
pi install git:github.com/<user>/pi-caveman
# or project-local
pi install -l git:github.com/<user>/pi-caveman
```

## Commands

- `/caveman` — enable full mode
- `/caveman lite|full|ultra|wenyan-lite|wenyan|wenyan-ultra` — switch mode
- `/caveman off` — disable
- `/caveman-help` — show reference card
- `/caveman-commit [context]` — generate terse Conventional Commit message
- `/caveman-review [context]` — generate one-line actionable review comments
- `/caveman-compress <filepath>` — compress markdown/memory file

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

Use `off` to disable auto-activation while keeping commands available.

## Updating from upstream caveman

This repo links upstream as git submodule:

```text
vendor/caveman -> https://github.com/JuliusBrussee/caveman
```

Update bundled skills/scripts from upstream:

```bash
git submodule update --init --recursive
npm run update:upstream
```

This pulls latest `vendor/caveman`, then syncs only pi-needed assets into this package:

- `skills/caveman*`
- `caveman-compress/SKILL.md`
- `caveman-compress/scripts/*`

The pi adapter itself stays in `extensions/caveman.ts`.

## Package layout

```text
extensions/caveman.ts       # pi extension adapter
vendor/caveman              # upstream repo submodule
scripts/sync-upstream.sh    # copies upstream assets into package
skills/*/SKILL.md           # synced caveman skills
caveman-compress/SKILL.md   # synced compression skill
caveman-compress/scripts/   # synced compression helper scripts
package.json                # pi package manifest
```

## Notes

This package adapts caveman to pi events:

- `resources_discover` exposes bundled skills
- `session_start` restores mode and status badge
- `input` handles disable phrases
- `before_agent_start` injects active caveman rules each turn
- `registerCommand` adds slash commands

## Attribution

Caveman rules and skills originate from [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman), MIT licensed.
