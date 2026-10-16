import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentId } from "../shared/agents";

export interface PathContext {
  env: Record<string, string | undefined>;
  home: string;
}

export function defaultPathContext(): PathContext {
  return { env: process.env, home: homedir() };
}

function envDir(env: Record<string, string | undefined>, key: string, fallback: string): string {
  const value = env[key]?.trim();
  return value ? value : fallback;
}

export function expandHome(path: string, home: string): string {
  if (path === "~") return home;
  if (path.startsWith("~/")) return join(home, path.slice(2));
  return path;
}

export function resolveAgentPath(
  agentId: AgentId,
  ctx: PathContext,
  overrides: Record<string, string> = {},
): string {
  const override = overrides[agentId]?.trim();
  if (override) return expandHome(override, ctx.home);

  switch (agentId) {
    case "claude":
      return join(envDir(ctx.env, "CLAUDE_CONFIG_DIR", join(ctx.home, ".claude")), "CLAUDE.md");
    case "codex":
      return join(envDir(ctx.env, "CODEX_HOME", join(ctx.home, ".codex")), "AGENTS.md");
    case "pi":
      return join(envDir(ctx.env, "PI_CODING_AGENT_DIR", join(ctx.home, ".pi", "agent")), "AGENTS.md");
    case "opencode":
      return join(envDir(ctx.env, "XDG_CONFIG_HOME", join(ctx.home, ".config")), "opencode", "AGENTS.md");
    case "qoder":
      return join(envDir(ctx.env, "QODER_CONFIG_DIR", join(ctx.home, ".qoder")), "AGENTS.md");
  }
}

export function sharedStorePath(ctx: PathContext): string {
  return join(envDir(ctx.env, "XDG_CONFIG_HOME", join(ctx.home, ".config")), "paseo", "prompt-hub", "shared.md");
}
