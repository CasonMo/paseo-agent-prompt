# Agent Prompt Hub

Manage the global prompt files of five coding agents from one place in Paseo: Claude Code, Codex, Pi, OpenCode, and Qoder.

The plugin reads and writes each agent's native user-level instruction file, so changes apply everywhere the agent runs (Paseo, terminals, IDEs), not only to Paseo sessions. Files that already exist are shown in full before you edit them, and every write keeps content outside the managed region untouched.

The shared block maintains one block of instructions and syncs it to any number of the five agents. Sync only replaces the marked region inside each file, or appends the block when a file has no markers yet. Clearing the block and syncing removes it. Before you confirm a sync, the plugin previews what it will do to each file: create, append, update, remove, or no change.

Writes are conflict-checked against the file's current hash, backed up first with configurable retention, written atomically, and keep the original file permissions and line endings. A history panel lists backups and can restore any of them, backing up the current version first. A read-only mode in settings disables all writes.

Settings cover the plugin language (English by default, Chinese available), per-agent path overrides, backup retention, read-only mode, and default sync targets. The plugin works on local files on the daemon host. Its only network access is the version check: the plugin reads the public registry record for this listing and the pinned package.json from raw.githubusercontent.com (falling back to api.github.com), cached for one hour, to tell you when a newer release exists; no user data is sent. Prompts stored here are read by the agents themselves and then sent to whichever model providers you run those agents with, the same as any other agent instruction file.

## 中文

在一个界面里管理五个编码 Agent 的全局提示词文件：Claude Code、Codex、Pi、OpenCode 和 Qoder。

插件读写的是每个 Agent 原生的用户级指令文件，因此修改对这个 Agent 运行的所有位置（Paseo、终端、IDE）都生效，而不只是 Paseo 会话。已存在的文件在编辑前会完整展示，每次写入都不会动到托管区域之外的内容。

共享块维护一段指令，可同步到五个 Agent 中的任意多个。同步只替换每个文件中被标记的区域；文件还没有标记时则追加该块；清空共享块后再同步即从所有文件中移除。确认同步前，插件会预览对每个文件将执行的操作：创建、追加、更新、移除或无变化。

写入前会用当前文件哈希做冲突检测，先按可配置的保留份数备份，再原子写入，并保留原文件权限与换行风格。历史面板列出所有备份，可一键恢复任意一份（恢复前会先备份当前版本）。设置中的只读模式会禁用全部写入。

设置项包括插件语言（默认英文，可切中文）、每个 Agent 的路径覆盖、备份保留、只读模式与默认同步目标。插件只操作 daemon 所在机器的本地文件。唯一的网络访问是版本检查：读取本插件公开的 registry 记录与对应提交的 package.json（来自 raw.githubusercontent.com，失败时回退 api.github.com），缓存一小时，仅用于提示是否有新版本；不发送任何用户数据。这里存放的提示词由 Agent 自身读取，之后随你为这些 Agent 配置的模型供应商一起发送，与任何其他 Agent 指令文件的行为一致。
