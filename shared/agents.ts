export const AGENT_IDS = ["claude", "codex", "pi", "opencode", "qoder"] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export interface AgentMeta {
  label: string;
  notes: string;
  defaultPathLabel: string;
}

export const AGENT_META: Record<AgentId, AgentMeta> = {
  claude: {
    label: "Claude Code",
    notes: "用户级 memory 文件，对所有项目生效（新会话读取）",
    defaultPathLabel: "~/.claude/CLAUDE.md（CLAUDE_CONFIG_DIR 可覆盖）",
  },
  codex: {
    label: "Codex",
    notes: "全局 AGENTS.md，作为全局 guidance 注入会话（全局 → 项目叠加）",
    defaultPathLabel: "~/.codex/AGENTS.md（CODEX_HOME 可覆盖）",
  },
  pi: {
    label: "Pi",
    notes: "跨工作目录的用户指令（上下文文件）",
    defaultPathLabel: "~/.pi/agent/AGENTS.md（PI_CODING_AGENT_DIR 可覆盖）",
  },
  opencode: {
    label: "OpenCode",
    notes: "全局规则文件，对所有项目生效",
    defaultPathLabel: "~/.config/opencode/AGENTS.md（XDG_CONFIG_HOME 可覆盖）",
  },
  qoder: {
    label: "Qoder CLI",
    notes: "用户级静态记忆（跨项目通用偏好）",
    defaultPathLabel: "~/.qoder/AGENTS.md（QODER_CONFIG_DIR 可覆盖）",
  },
};
