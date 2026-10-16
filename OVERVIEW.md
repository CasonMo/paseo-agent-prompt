# Agent Prompt Hub

Manage the global prompt files of five coding agents from one place in Paseo: Claude Code, Codex, Pi, OpenCode, and Qoder.

The plugin reads and writes each agent's native user-level instruction file, so changes apply everywhere the agent runs (Paseo, terminals, IDEs), not only to Paseo sessions. Files that already exist are shown in full before you edit them, and every write keeps content outside the managed region untouched.

The shared block maintains one block of instructions and syncs it to any number of the five agents. Sync only replaces the marked region inside each file, or appends the block when a file has no markers yet. Clearing the block and syncing removes it. Before you confirm a sync, the plugin previews what it will do to each file: create, append, update, remove, or no change.

Writes are conflict-checked against the file's current hash, backed up first with configurable retention, written atomically, and keep the original file permissions and line endings. A history panel lists backups and can restore any of them, backing up the current version first. A read-only mode in settings disables all writes.

Settings cover the plugin language (English by default, Chinese available), per-agent path overrides, backup retention, read-only mode, and default sync targets. The plugin works on local files on the daemon host and makes no network requests of its own. Prompts stored here are read by the agents themselves and then sent to whichever model providers you run those agents with, the same as any other agent instruction file.
