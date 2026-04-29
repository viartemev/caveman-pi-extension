import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const MODES = ["lite", "full", "ultra", "wenyan-lite", "wenyan-full", "wenyan", "wenyan-ultra"] as const;
type Mode = (typeof MODES)[number] | "off";

const STATE_TYPE = "caveman-state";
const EXT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(EXT_DIR, "..");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const CAVEMAN_SKILL = join(SKILLS_DIR, "caveman", "SKILL.md");
const COMMIT_SKILL = join(SKILLS_DIR, "caveman-commit", "SKILL.md");
const REVIEW_SKILL = join(SKILLS_DIR, "caveman-review", "SKILL.md");
const HELP_SKILL = join(SKILLS_DIR, "caveman-help", "SKILL.md");
const COMPRESS_SKILL = join(REPO_ROOT, "caveman-compress", "SKILL.md");

function read(path: string): string {
	return readFileSync(path, "utf8");
}

function normalizeMode(input: string | undefined): Mode | undefined {
	const value = (input ?? "").trim().toLowerCase();
	if (!value) return "full";
	if (value === "normal" || value === "stop" || value === "off") return "off";
	if (value === "wenyan") return "wenyan";
	return (MODES as readonly string[]).includes(value) ? (value as Mode) : undefined;
}

function defaultMode(): Mode {
	const env = normalizeMode(process.env.CAVEMAN_DEFAULT_MODE);
	if (env) return env;

	const configPath = join(homedir(), ".config", "caveman", "config.json");
	if (existsSync(configPath)) {
		try {
			const config = JSON.parse(read(configPath)) as { defaultMode?: string };
			const configured = normalizeMode(config.defaultMode);
			if (configured) return configured;
		} catch {
			// Ignore invalid config. Fall back to full.
		}
	}

	return "full";
}

function modeInstruction(mode: Mode): string {
	if (mode === "off") return "";
	const canonical = mode === "wenyan" ? "wenyan-full" : mode;
	return `${read(CAVEMAN_SKILL)}\n\nCurrent caveman intensity: ${canonical}. Persist until user changes mode or says normal mode.`;
}

function taskPrompt(skillPath: string, userArgs: string): string {
	const suffix = userArgs.trim() ? `\n\nUser request/context:\n${userArgs.trim()}` : "";
	return `${read(skillPath)}${suffix}`;
}

export default function cavemanPiExtension(pi: ExtensionAPI) {
	let activeMode: Mode = defaultMode();

	pi.on("resources_discover", () => {
		return existsSync(SKILLS_DIR) ? { skillPaths: [SKILLS_DIR] } : undefined;
	});

	pi.on("session_start", (_event, ctx) => {
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === STATE_TYPE) {
				const saved = (entry.data as { mode?: string } | undefined)?.mode;
				const mode = normalizeMode(saved);
				if (mode) activeMode = mode;
			}
		}

		if (activeMode !== "off") {
			ctx.ui.setStatus("caveman", `[CAVEMAN:${activeMode === "wenyan" ? "WENYAN" : activeMode.toUpperCase()}]`);
		}
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
		return { action: "continue" as const };
	});

	pi.on("before_agent_start", (event) => {
		const instruction = modeInstruction(activeMode);
		if (!instruction) return;
		return { systemPrompt: `${event.systemPrompt}\n\n${instruction}` };
	});

	pi.registerCommand("caveman", {
		description: "Enable caveman mode: /caveman [lite|full|ultra|wenyan-lite|wenyan|wenyan-ultra|off]",
		handler: async (args, ctx) => {
			const mode = normalizeMode(args);
			if (!mode) {
				ctx.ui.notify("Usage: /caveman [lite|full|ultra|wenyan-lite|wenyan|wenyan-ultra|off]", "warning");
				return;
			}

			activeMode = mode;
			pi.appendEntry(STATE_TYPE, { mode });
			ctx.ui.setStatus("caveman", mode === "off" ? "" : `[CAVEMAN:${mode.toUpperCase()}]`);
			ctx.ui.notify(mode === "off" ? "Caveman off." : `Caveman ${mode} active.`, "info");
		},
	});

	pi.registerCommand("caveman-help", {
		description: "Show caveman quick reference",
		handler: async (_args, _ctx) => {
			pi.sendUserMessage(taskPrompt(HELP_SKILL, "Show help card."));
		},
	});

	pi.registerCommand("caveman-commit", {
		description: "Generate terse Conventional Commit message",
		handler: async (args, _ctx) => {
			pi.sendUserMessage(taskPrompt(COMMIT_SKILL, args || "Inspect current git diff/staged changes and write commit message."));
		},
	});

	pi.registerCommand("caveman-review", {
		description: "Generate terse one-line code review comments",
		handler: async (args, _ctx) => {
			pi.sendUserMessage(taskPrompt(REVIEW_SKILL, args || "Review current diff and output terse actionable findings."));
		},
	});

	pi.registerCommand("caveman-compress", {
		description: "Compress a markdown/memory file: /caveman-compress <filepath>",
		handler: async (args, _ctx) => {
			pi.sendUserMessage(taskPrompt(COMPRESS_SKILL, args || "Ask user for filepath to compress."));
		},
	});
}
