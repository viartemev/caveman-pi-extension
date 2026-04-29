import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const MODES = ["lite", "full", "ultra"] as const;
const MODE_ARGS = [...MODES, "off"] as const;
const COMMAND_ARGS = [...MODE_ARGS, "toggle", "status"] as const;
const MAX_DIFF_CHARS = 60_000;
type Mode = (typeof MODES)[number] | "off";

const STATE_TYPE = "caveman-state";
const EXT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(EXT_DIR, "..");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const COMMIT_SKILL = join(SKILLS_DIR, "caveman-commit", "SKILL.md");
const REVIEW_SKILL = join(SKILLS_DIR, "caveman-review", "SKILL.md");
const COMPRESS_SKILL = join(REPO_ROOT, "caveman-compress", "SKILL.md");
const CONFIG_PATH = join(homedir(), ".config", "caveman", "config.json");

const MODE_PROMPTS: Record<Exclude<Mode, "off">, string> = {
	lite: "Caveman lite active. Be concise. Drop filler, pleasantries, hedging. Keep normal grammar. Preserve exact technical terms. Do not alter code blocks or quoted errors. Persist until user changes mode or says normal mode.",
	full: "Caveman full active. Respond terse like smart caveman. Drop articles, filler, pleasantries, hedging. Fragments OK. Pattern: [thing] [action] [reason]. Keep all technical substance. Preserve exact technical terms, code blocks, commands, paths, quoted errors. Persist until user changes mode or says normal mode.",
	ultra: "Caveman ultra active. Maximum terse technical shorthand. Abbrev safe terms (DB/auth/config/req/res/fn), use arrows for causality, one word when enough. Keep all technical substance. Preserve exact technical terms, code blocks, commands, paths, quoted errors. Persist until user changes mode or says normal mode.",
};

const HELP_CARD = `      _______
   .-'       '-.
  /   CAVE 🪨   \\
 |   no fluff    |
  \\             /
   '-._______.-'

# Caveman Help

| Command | Action |
| --- | --- |
| /caveman | enable full mode |
| /caveman lite | concise, normal grammar |
| /caveman full | caveman fragments, no filler |
| /caveman ultra | max terse shorthand |
| /caveman off | disable |
| /caveman toggle | toggle on/off |
| /caveman status | show status |
| /caveman-default <mode> | save default mode |
| /caveman-commit [context] | generate Conventional Commit message |
| /caveman-review [context] | generate terse review comments |
| /caveman-compress <file> | compress markdown/memory file |

Natural off: stop caveman, normal mode, caveman off.
Config: CAVEMAN_DEFAULT_MODE or ~/.config/caveman/config.json.
`;

function read(path: string): string {
	return readFileSync(path, "utf8");
}

function normalizeMode(input: string | undefined): Mode | undefined {
	const value = (input ?? "").trim().toLowerCase();
	if (!value) return "full";
	if (value === "normal" || value === "stop" || value === "off") return "off";
	return (MODES as readonly string[]).includes(value) ? (value as Mode) : undefined;
}

function defaultMode(): Mode {
	const env = normalizeMode(process.env.CAVEMAN_DEFAULT_MODE);
	if (env) return env;

	if (existsSync(CONFIG_PATH)) {
		try {
			const config = JSON.parse(read(CONFIG_PATH)) as { defaultMode?: string };
			const configured = normalizeMode(config.defaultMode);
			if (configured) return configured;
		} catch {
			// Ignore invalid config. Fall back to full.
		}
	}

	return "full";
}

function modeInstruction(mode: Mode): string {
	return mode === "off" ? "" : MODE_PROMPTS[mode];
}

function rockLabel(mode: Mode): string {
	if (mode === "off") return "🪨 sleeping";
	return `🪨 CAVE ${mode}`;
}

function statusCard(mode: Mode): string {
	return `      _______
   .-'       '-.
  /   CAVE 🪨   \\
 |   ${mode.padEnd(11).slice(0, 11)} |
  \\             /
   '-._______.-'

Mode: ${mode}
Badge: ${rockLabel(mode)}
Default: ${defaultMode()}
Config: ${CONFIG_PATH}
Prompt bytes/turn: ${mode === "off" ? 0 : MODE_PROMPTS[mode].length}
Footer status: disabled
`;
}

function taskPrompt(skillPath: string, userArgs: string): string {
	const suffix = userArgs.trim() ? `\n\nUser request/context:\n${userArgs.trim()}` : "";
	return `${read(skillPath)}${suffix}`;
}

function completions(prefix: string) {
	return COMMAND_ARGS.filter((arg) => arg.startsWith(prefix)).map((arg) => ({ value: arg, label: arg }));
}

function saveDefaultMode(mode: Mode) {
	mkdirSync(dirname(CONFIG_PATH), { recursive: true });
	writeFileSync(CONFIG_PATH, `${JSON.stringify({ defaultMode: mode }, null, 2)}\n`);
}

function capDiff(diff: string): string {
	if (diff.length <= MAX_DIFF_CHARS) return diff;
	return `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated: ${diff.length - MAX_DIFF_CHARS} chars omitted]`;
}

async function gitDiff(pi: ExtensionAPI): Promise<string> {
	const staged = await pi.exec("git", ["diff", "--cached"], { timeout: 10_000 });
	if (staged.code === 0 && staged.stdout.trim()) return capDiff(staged.stdout);

	const unstaged = await pi.exec("git", ["diff"], { timeout: 10_000 });
	if (unstaged.code === 0 && unstaged.stdout.trim()) return capDiff(unstaged.stdout);

	return "";
}

export default function cavemanPiExtension(pi: ExtensionAPI) {
	let activeMode: Mode = defaultMode();

	pi.on("session_start", (_event, _ctx) => {
		for (const entry of _ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === STATE_TYPE) {
				const saved = (entry.data as { mode?: string } | undefined)?.mode;
				const mode = normalizeMode(saved);
				if (mode) activeMode = mode;
			}
		}
	});

	pi.on("input", (event, ctx) => {
		const text = event.text.trim().toLowerCase();
		if (["stop caveman", "normal mode", "caveman off"].includes(text)) {
			activeMode = "off";
			pi.appendEntry(STATE_TYPE, { mode: activeMode });
			ctx.ui.notify("🪨 Caveman off.", "info");
			return { action: "handled" as const };
		}

		if (["caveman mode", "use caveman", "talk like caveman", "less tokens", "be brief", "будь краток", "без воды", "короче", "включи caveman", "говори как caveman"].includes(text)) {
			activeMode = defaultMode() === "off" ? "full" : defaultMode();
			pi.appendEntry(STATE_TYPE, { mode: activeMode });
			ctx.ui.notify(`${rockLabel(activeMode)} active.`, "info");
			return { action: "handled" as const };
		}

		return { action: "continue" as const };
	});

	pi.on("before_agent_start", (event) => {
		const instruction = modeInstruction(activeMode);
		if (!instruction) return;
		return { systemPrompt: `${event.systemPrompt}\n\n${instruction}` };
	});

	pi.registerCommand("caveman", {
		description: "Caveman mode: /caveman [lite|full|ultra|off|toggle|status]",
		getArgumentCompletions: completions,
		handler: async (args, ctx) => {
			const command = args.trim().toLowerCase();
			if (command === "status") {
				pi.sendMessage({ customType: "caveman-status", content: statusCard(activeMode), display: true });
				return;
			}

			if (command === "toggle") {
				activeMode = activeMode === "off" ? (defaultMode() === "off" ? "full" : defaultMode()) : "off";
				pi.appendEntry(STATE_TYPE, { mode: activeMode });
				ctx.ui.notify(activeMode === "off" ? "🪨 Caveman off." : `${rockLabel(activeMode)} active.`, "info");
				return;
			}

			const mode = normalizeMode(args);
			if (!mode) {
				ctx.ui.notify("Usage: /caveman [lite|full|ultra|off|toggle|status]", "warning");
				return;
			}

			activeMode = mode;
			pi.appendEntry(STATE_TYPE, { mode });
			ctx.ui.notify(mode === "off" ? "🪨 Caveman off." : `${rockLabel(mode)} active.`, "info");
		},
	});

	pi.registerCommand("caveman-help", {
		description: "Show caveman quick reference",
		handler: async (_args, _ctx) => {
			pi.sendMessage({ customType: "caveman-help", content: HELP_CARD, display: true });
		},
	});

	pi.registerCommand("caveman-default", {
		description: "Save default caveman mode: /caveman-default [lite|full|ultra|off]",
		getArgumentCompletions: completions,
		handler: async (args, ctx) => {
			const mode = normalizeMode(args);
			if (!mode) {
				ctx.ui.notify("Usage: /caveman-default [lite|full|ultra|off]", "warning");
				return;
			}
			saveDefaultMode(mode);
			ctx.ui.notify(`Default caveman mode saved: ${mode}.`, "info");
		},
	});

	pi.registerCommand("caveman-commit", {
		description: "Generate terse Conventional Commit message",
		handler: async (args, _ctx) => {
			const diff = await gitDiff(pi);
			const context = args.trim() || "Write commit message for current diff.";
			pi.sendUserMessage(taskPrompt(COMMIT_SKILL, diff ? `${context}\n\nDiff:\n\`\`\`diff\n${diff}\n\`\`\`` : context));
		},
	});

	pi.registerCommand("caveman-review", {
		description: "Generate terse one-line code review comments",
		handler: async (args, _ctx) => {
			const diff = await gitDiff(pi);
			const context = args.trim() || "Review current diff and output terse actionable findings.";
			pi.sendUserMessage(taskPrompt(REVIEW_SKILL, diff ? `${context}\n\nDiff:\n\`\`\`diff\n${diff}\n\`\`\`` : context));
		},
	});

	pi.registerCommand("caveman-compress", {
		description: "Compress a markdown/memory file: /caveman-compress <filepath>",
		handler: async (args, _ctx) => {
			pi.sendUserMessage(taskPrompt(COMPRESS_SKILL, args || "Ask user for filepath to compress."));
		},
	});
}
