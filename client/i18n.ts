import { useSettings } from "@getpaseo/plugin/client";
import { useMemo } from "react";
import type { AgentId } from "../shared/agents";
import { hubSettings } from "../shared/hub";

export type Language = "en" | "zh";

const en = {
  "app.title": "Agent Prompt Hub",
  "app.subtitle":
    "Manage global prompts for Claude Code, Codex, Pi, OpenCode, and Qoder. One shared block syncs to every agent you pick.",
  "sidebar.label": "Prompt Hub",

  "common.refresh": "Refresh",
  "common.refreshing": "Refreshing…",
  "common.loading": "Loading…",
  "common.settings": "Settings",
  "common.back": "Back",

  "banner.readOnly": "Read-only mode is on: no files are written. Turn it off in Settings → Plugins → Prompt Hub.",
  "update.available":
    "New version v{latest} is available (current v{current}) · Update: paseo plugin update agent-prompt-hub",
  "update.dismiss": "Dismiss",
  "error.loadFailed": "Failed to load: {message}",

  "shared.title": "Shared block: edit once, apply to many agents",
  "shared.hint":
    "Sync writes the marked region into each selected agent's global prompt file. Everything outside the markers is preserved, so existing content is never overwritten. Clear the content and sync to remove the block.",
  "shared.placeholder": "# Shared instructions\nFor example: reply and write commit messages in Chinese; never push to remotes unprompted.",
  "shared.saveOnly": "Save block only",
  "shared.sync": "Sync to {count} agents",
  "shared.syncing": "Syncing…",
  "shared.dirty": "Unsaved shared block changes",
  "shared.store": "Shared store: {path}",
  "history.show": "History",
  "history.hide": "Hide history",
  "shared.previewTitle": "Sync preview:",
  "shared.viewHint": "Select an agent below to read its current file content.",

  "preview.create": "will create the file and write the block",
  "preview.append": "will append the block (existing content kept)",
  "preview.update": "will update the shared block",
  "preview.unchanged": "no change",
  "preview.remove": "will remove the shared block",
  "preview.broken": "broken markers: sync will fail until fixed",

  "agents.title": "Agents",
  "tab.shared": "Shared",
  "agent.sharedOn": " · shared ✓",
  "agent.hasBlock": " · has block",
  "agent.broken": " · broken markers",
  "agent.notExist": "File does not exist (created on save)",

  "agentNote.claude": "User-level memory file applied to all projects (read at session start)",
  "agentNote.codex": "Global AGENTS.md injected as global guidance (global → project layering)",
  "agentNote.pi": "User instructions applied across working directories (context file)",
  "agentNote.opencode": "Global rules file applied to all projects",
  "agentNote.qoder": "User-level static memory (cross-project preferences)",

  "agentPath.claude": "~/.claude/CLAUDE.md (CLAUDE_CONFIG_DIR overrides)",
  "agentPath.codex": "~/.codex/AGENTS.md (CODEX_HOME overrides)",
  "agentPath.pi": "~/.pi/agent/AGENTS.md (PI_CODING_AGENT_DIR overrides)",
  "agentPath.opencode": "~/.config/opencode/AGENTS.md (XDG_CONFIG_HOME overrides)",
  "agentPath.qoder": "~/.qoder/AGENTS.md (QODER_CONFIG_DIR overrides)",

  "editor.title": "{label} · global prompt file",
  "editor.copyPath": "Copy path",
  "editor.refresh": "Reload (discard draft)",
  "editor.save": "Save",
  "editor.saving": "Saving…",
  "editor.dirty": "Unsaved changes. Saving backs up the current version first.",
  "editor.meta": "{count} chars · base {hash}",
  "editor.baseNew": "(file missing, saving creates it)",
  "editor.placeholder": "# Global instructions\n...",
  "editor.loadedHint":
    "The file's current content is loaded below. Saving uses it as the base and never silently overwrites.",
  "editor.sharedOn": "In shared sync targets",
  "editor.sharedOff": "Not in shared sync targets",
  "editor.blockOk": "contains the shared block",
  "editor.blockNone": "no shared block",
  "editor.blockBroken": "shared markers broken",
  "editor.discarded": "Unsaved changes discarded",

  "history.title": "History · {name}",
  "history.sharedName": "Shared block",
  "history.empty": "No backups yet",
  "history.restore": "Restore",
  "history.restoring": "Restoring…",

  "toast.copied": "Path copied",
  "toast.copyFailed": "Copy failed",
  "toast.saveFailedLog": "Save failed. Check the plugin logs.",
  "toast.syncFailedLog": "Sync failed. Check the plugin logs.",
  "toast.restoreFailedLog": "Restore failed. Check the plugin logs.",
  "toast.syncedCount": "Synced to {count} agents",
  "toast.syncFailedCount": "{count} agents failed. See the list below.",
  "toast.sharedSavedOnly": "Shared block saved (not synced)",
  "toast.targetsNotSaved": "Target selection was not saved to settings",

  "result.saved": "saved",
  "result.created": "file created with shared block",
  "result.appended": "shared block appended (existing content kept)",
  "result.updated": "shared block updated",
  "result.removed": "shared block removed",
  "result.unchanged": "no change",
  "result.restored": "backup restored (previous version backed up first)",
  "result.conflict": "File changed outside the plugin. Refresh and retry.",
  "result.readOnly": "Read-only mode is on. Nothing was written.",
  "result.failed": "Failed",
  "result.backup": "(backed up {name})",

  "settings.general": "General",
  "settings.language": "Language",
  "settings.languageHint": "Plugin UI language. English by default.",
  "settings.readOnly": "Read-only mode",
  "settings.readOnlyHint": "No files are written (agent files or the shared store).",
  "settings.backupRetention": "Backups kept",
  "settings.backupRetentionHint":
    "Every write backs up the current version first; older backups beyond this count are pruned.",
  "settings.backupCount": "{count} copies",
  "settings.targets": "Default sync targets",
  "settings.targetsInfo": "Pre-selected on the main screen; you can still toggle per sync.",
  "settings.paths": "Custom paths",
  "settings.pathsInfo": "Leave empty for the default path. Supports ~/ and absolute paths.",
  "settings.pathPlaceholder": "Use default path",
  "settings.save": "Save settings",
  "settings.saving": "Saving…",
  "settings.reload": "Reload",
  "settings.dirty": "Unsaved changes",
  "settings.loading": "Loading settings…",
  "settings.loadError": "Failed to load settings: {message}",
  "settings.invalid": "Settings data is invalid: {message}",
  "settings.reset": "Reset to defaults",
  "settings.saved": "Settings saved",
  "settings.saveFailed": "Save failed: another window may have changed the settings. Reload and try again.",
  "settings.resetDone": "Settings reset to defaults",
  "settings.resetFailed": "Reset failed",
} satisfies Record<string, string>;

export type MessageKey = keyof typeof en;
export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

const zh: Record<MessageKey, string> = {
  "app.title": "全局提示词中心",
  "app.subtitle": "统一管理 Claude Code / Codex / Pi / OpenCode / Qoder 的全局提示词；共享块一处修改，多端同步。",
  "sidebar.label": "提示词中心",

  "common.refresh": "刷新",
  "common.refreshing": "刷新中…",
  "common.loading": "读取中…",
  "common.settings": "设置",
  "common.back": "返回",

  "banner.readOnly": "只读模式已开启：不会写入任何文件。可在 Settings → Plugins → Prompt Hub 中关闭。",
  "update.available": "发现新版本 v{latest}（当前 v{current}）· 更新：paseo plugin update agent-prompt-hub",
  "update.dismiss": "关闭",
  "error.loadFailed": "读取失败：{message}",

  "shared.title": "共享块（一处修改，多 agent 生效）",
  "shared.hint":
    "同步时写入各 agent 全局提示词文件中带标记的区域；标记以外的原有内容一律保留，不会被覆盖。清空内容后同步 = 从所有文件移除共享块。",
  "shared.placeholder": "# 共享提示词\n例如：回复和 commit message 使用中文；不要主动推送远程仓库。",
  "shared.saveOnly": "仅保存共享块",
  "shared.sync": "同步到所选 {count} 个 agent",
  "shared.syncing": "同步中…",
  "shared.dirty": "有未保存的共享块修改",
  "shared.store": "共享存储：{path}",
  "history.show": "历史备份",
  "history.hide": "收起历史",
  "shared.previewTitle": "同步预览：",
  "shared.viewHint": "在下方选择任一 agent，可查看该文件的现有内容（完整读取）。",

  "preview.create": "将创建文件并写入共享块",
  "preview.append": "将追加共享块（原有内容保留）",
  "preview.update": "将更新共享块区域",
  "preview.unchanged": "无变化",
  "preview.remove": "将移除共享块",
  "preview.broken": "共享块标记异常，将失败",

  "agents.title": "Agents",
  "tab.shared": "共享",
  "agent.sharedOn": " · 共享 ✓",
  "agent.hasBlock": " · 含共享块",
  "agent.broken": " · 共享块标记异常",
  "agent.notExist": "文件不存在（保存后创建）",

  "agentNote.claude": "用户级 memory 文件，对所有项目生效（新会话读取）",
  "agentNote.codex": "全局 AGENTS.md，作为全局 guidance 注入会话（全局 → 项目叠加）",
  "agentNote.pi": "跨工作目录的用户指令（上下文文件）",
  "agentNote.opencode": "全局规则文件，对所有项目生效",
  "agentNote.qoder": "用户级静态记忆（跨项目通用偏好）",

  "agentPath.claude": "~/.claude/CLAUDE.md（CLAUDE_CONFIG_DIR 可覆盖）",
  "agentPath.codex": "~/.codex/AGENTS.md（CODEX_HOME 可覆盖）",
  "agentPath.pi": "~/.pi/agent/AGENTS.md（PI_CODING_AGENT_DIR 可覆盖）",
  "agentPath.opencode": "~/.config/opencode/AGENTS.md（XDG_CONFIG_HOME 可覆盖）",
  "agentPath.qoder": "~/.qoder/AGENTS.md（QODER_CONFIG_DIR 可覆盖）",

  "editor.title": "{label} · 全局提示词文件",
  "editor.copyPath": "复制路径",
  "editor.refresh": "刷新（丢弃草稿）",
  "editor.save": "保存",
  "editor.saving": "保存中…",
  "editor.dirty": "有未保存的修改；保存时会先备份当前版本。",
  "editor.meta": "{count} 字符 · 基线 {hash}",
  "editor.baseNew": "（文件不存在，保存将创建）",
  "editor.placeholder": "# 全局指令\n...",
  "editor.loadedHint": "下方已完整读取该文件现有内容；保存以它为基线，不会静默覆盖。",
  "editor.sharedOn": "已加入共享同步目标",
  "editor.sharedOff": "未加入共享同步目标",
  "editor.blockOk": "文件含共享块",
  "editor.blockNone": "未含共享块",
  "editor.blockBroken": "共享块标记异常",
  "editor.discarded": "已丢弃未保存的修改",

  "history.title": "历史备份 · {name}",
  "history.sharedName": "共享块",
  "history.empty": "暂无备份",
  "history.restore": "恢复",
  "history.restoring": "恢复中…",

  "toast.copied": "已复制路径",
  "toast.copyFailed": "复制失败",
  "toast.saveFailedLog": "保存失败，请查看插件日志",
  "toast.syncFailedLog": "同步失败，请查看插件日志",
  "toast.restoreFailedLog": "恢复失败，请查看插件日志",
  "toast.syncedCount": "已同步到 {count} 个 agent",
  "toast.syncFailedCount": "{count} 个 agent 同步失败，请看下方列表",
  "toast.sharedSavedOnly": "共享块已保存（未同步到 agent）",
  "toast.targetsNotSaved": "同步目标选择未能保存到设置",

  "result.saved": "已保存",
  "result.created": "已创建文件并写入共享块",
  "result.appended": "已追加共享块（原有内容保留）",
  "result.updated": "共享块已更新",
  "result.removed": "共享块已移除",
  "result.unchanged": "无变化",
  "result.restored": "已恢复备份（当前版本已先备份）",
  "result.conflict": "文件已被外部修改，请刷新后重试",
  "result.readOnly": "只读模式已开启，未写入任何文件",
  "result.failed": "失败",
  "result.backup": "（已备份 {name}）",

  "settings.general": "通用",
  "settings.language": "语言",
  "settings.languageHint": "插件界面语言，默认英文",
  "settings.readOnly": "只读模式",
  "settings.readOnlyHint": "开启后插件不会写入任何文件（包括 agent 文件与共享块存储）",
  "settings.backupRetention": "备份保留数量",
  "settings.backupRetentionHint": "每次写入前自动备份当前版本，超过数量自动清理",
  "settings.backupCount": "{count} 份",
  "settings.targets": "默认同步目标",
  "settings.targetsInfo": "默认勾选的 agent；主页同步前也可以临时勾选",
  "settings.paths": "自定义路径",
  "settings.pathsInfo": "留空使用默认路径；支持 ~/ 开头与绝对路径",
  "settings.pathPlaceholder": "留空使用默认路径",
  "settings.save": "保存设置",
  "settings.saving": "保存中…",
  "settings.reload": "重新加载",
  "settings.dirty": "有未保存的修改",
  "settings.loading": "读取设置中…",
  "settings.loadError": "读取设置失败：{message}",
  "settings.invalid": "设置数据无效：{message}",
  "settings.reset": "重置为默认",
  "settings.saved": "设置已保存",
  "settings.saveFailed": "保存失败：可能有其他窗口同时修改，请重新加载后再试",
  "settings.resetDone": "已重置为默认设置",
  "settings.resetFailed": "重置失败",
};

export const MESSAGES: Record<Language, Record<MessageKey, string>> = { en, zh };

export const AGENT_NOTE_KEYS: Record<AgentId, MessageKey> = {
  claude: "agentNote.claude",
  codex: "agentNote.codex",
  pi: "agentNote.pi",
  opencode: "agentNote.opencode",
  qoder: "agentNote.qoder",
};

export const AGENT_PATH_KEYS: Record<AgentId, MessageKey> = {
  claude: "agentPath.claude",
  codex: "agentPath.codex",
  pi: "agentPath.pi",
  opencode: "agentPath.opencode",
  qoder: "agentPath.qoder",
};

export function translate(language: Language, key: MessageKey, params?: Record<string, string | number>): string {
  const template = MESSAGES[language][key] ?? MESSAGES.en[key] ?? key;
  if (!params) return template;
  let text = template;
  for (const [name, value] of Object.entries(params)) {
    text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

export function useI18n(): { t: Translate; language: Language } {
  const settingsState = useSettings(hubSettings);
  const language: Language = settingsState.status === "ready" ? settingsState.values.language : "en";
  const t = useMemo<Translate>(() => (key, params) => translate(language, key, params), [language]);
  return { t, language };
}
