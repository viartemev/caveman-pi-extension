import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const MODES = ["lite", "full", "ultra", "wenyan-lite", "wenyan-full", "wenyan-ultra"] as const;
const MODE_ARGS = [...MODES, "wenyan", "off"] as const;
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
	"wenyan-lite": "Caveman wenyan-lite active. Semi-classical terse style. Drop filler/hedging, keep meaning clear. Preserve exact technical terms, code blocks, commands, paths, quoted errors. Persist until user changes mode or says normal mode.",
	"wenyan-full": "Caveman wenyan-full active. Maximum classical terseness, 文言文 where practical. Keep all technical substance. Preserve exact technical terms, code blocks, commands, paths, quoted errors. Persist until user changes mode or says normal mode.",
	"wenyan-ultra": "Caveman wenyan-ultra active. Extreme classical compression. Keep all technical substance. Preserve exact technical terms, code blocks, commands, paths, quoted errors. Persist until user changes mode or says normal mode.",
};

const HELP_CARD = `# Caveman Help

| Command | Action |
| --- | --- |
| /caveman | enable full mode |
| /caveman lite | concise, normal grammar |
| /caveman full | caveman fragments, no filler |
| /caveman ultra | max terse shorthand |
| /caveman wenyan-lite | semi-classical terse |
| /caveman wenyan or wenyan-full | classical terse |
| /caveman wenyan-ultra | extreme classical terse |
| /caveman off | disable |
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
	if (value === "wenyan") return "wenyan-full";
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

function statusLabel(mode: Mode): string {
	return mode === "off" ? "" : `[CAVEMAN:${mode.toUpperCase()}]`;
}

function taskPrompt(skillPath: string, userArgs: string): string {
	const suffix = userArgs.trim() ? `\n\nUser request/context:\n${userArgs.trim()}` : "";
	return `${read(skillPath)}${suffix}`;
}

function completions(prefix: string) {
	return MODE_ARGS.filter((mode) => mode.startsWith(prefix)).map((mode) => ({ value: mode, label: mode }));
}

function saveDefaultMode(mode: Mode) {
	mkdirSync(dirname(CONFIG_PATH), { recursive: true });
	writeFileSync(CONFIG_PATH, `${JSON.stringify({ defaultMode: mode }, null, 2)}\n`);
}

async function gitDiff(pi: ExtensionAPI): Promise<string> {
	const staged = await pi.exec("git", ["diff", "--cached"], { timeout: 10_000 });
	if (staged.code === 0 && staged.stdout.trim()) return staged.stdout;

	const unstaged = await pi.exec("git", ["diff"], { timeout: 10_000 });
	if (unstaged.code === 0 && unstaged.stdout.trim()) return unstaged.stdout;

	return "";
}

export default function cavemanPiExtension(pi: ExtensionAPI) {
	let activeMode: Mode = defaultMode();

	pi.on("session_start", (_event, ctx) => {
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === STATE_TYPE) {
				const saved = (entry.data as { mode?: string } | undefined)?.mode;
				const mode = normalizeMode(saved);
				if (mode) activeMode = mode;
			}
		}

		ctx.ui.setStatus("caveman", statusLabel(activeMode));
	});

	pi.on("input", (event, ctx) => {
		const text = event.text.trim().toLowerCase();
		if (["stop caveman", "normal mode", "caveman off"].includes(text)) {
			activeMode = "off";
			pi.appendEntry(STATE_TYPE, { mode: activeMode });
			ctx.ui.setStatus("caveman", "");
			ctx.ui.notify("Caveman off.", "info");
			return { action: "handled" as const };
		}

		if (["caveman mode", "use caveman", "talk like caveman", "less tokens", "be brief"].includes(text)) {
			activeMode = defaultMode() === "off" ? "full" : defaultMode();
			pi.appendEntry(STATE_TYPE, { mode: activeMode });
			ctx.ui.setStatus("caveman", statusLabel(activeMode));
			ctx.ui.notify(`Caveman ${activeMode} active.`, "info");
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
		description: "Enable caveman mode: /caveman [lite|full|ultra|wenyan-lite|wenyan|wenyan-full|wenyan-ultra|off]",
		getArgumentCompletions: completions,
		handler: async (args, ctx) => {
			const mode = normalizeMode(args);
			if (!mode) {
				ctx.ui.notify("Usage: /caveman [lite|full|ultra|wenyan-lite|wenyan|wenyan-full|wenyan-ultra|off]", "warning");
				return;
			}

			activeMode = mode;
			pi.appendEntry(STATE_TYPE, { mode });
			ctx.ui.setStatus("caveman", statusLabel(mode));
			ctx.ui.notify(mode === "off" ? "Caveman off." : `Caveman ${mode} active.`, "info");
		},
	});

	pi.registerCommand("caveman-help", {
		description: "Show caveman quick reference",
		handler: async (_args, _ctx) => {
			pi.sendMessage({ customType: "caveman-help", content: HELP_CARD, display: true });
		},
	});

	pi.registerCommand("caveman-default", {
		description: "Save default caveman mode: /caveman-default [lite|full|ultra|wenyan-lite|wenyan|wenyan-full|wenyan-ultra|off]",
		getArgumentCompletions: completions,
		handler: async (args, ctx) => {
			const mode = normalizeMode(args);
			if (!mode) {
				ctx.ui.notify("Usage: /caveman-default [lite|full|ultra|wenyan-lite|wenyan|wenyan-full|wenyan-ultra|off]", "warning");
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
