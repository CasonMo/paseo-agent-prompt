import type { RpcInput } from "@getpaseo/plugin";
import type { PluginSettings } from "@getpaseo/plugin/server";
import { AGENT_IDS, AGENT_META, type AgentId } from "../shared/agents";
import {
  hubHistoryRpc,
  hubRestoreRpc,
  hubSaveFileRpc,
  hubSettingsSchema,
  hubSyncSharedRpc,
  type HubSettingsValues,
  type OutcomeDetail,
  type WriteOutcome,
} from "../shared/hub";
import { listBackups, readFileInfo, restoreBackup, writeFileSafely, type WriteResult } from "./files";
import { defaultPathContext, resolveAgentPath, sharedStorePath, type PathContext } from "./paths";
import { detectSharedBlock, spliceSharedBlock } from "./shared-block";

export function createHubService(
  settings: PluginSettings<typeof hubSettingsSchema>,
  ctx: PathContext = defaultPathContext(),
) {
  async function readSettings(): Promise<HubSettingsValues> {
    const state = await settings.read();
    if (state.status === "ready") return state.values;
    return hubSettingsSchema.parse({});
  }

  async function pathForAgent(agentId: AgentId): Promise<string> {
    const values = await readSettings();
    return resolveAgentPath(agentId, ctx, values.pathOverrides);
  }

  function toOutcome(result: WriteResult, detail?: OutcomeDetail): WriteOutcome {
    if (result.ok) {
      const unchanged = result.code === "unchanged";
      return {
        ok: true,
        code: unchanged ? "unchanged" : "ok",
        message: unchanged ? "无变化" : detail === "saved" ? "已保存" : null,
        detail: unchanged ? "unchanged" : (detail ?? null),
        hash: result.info.hash,
        mtimeMs: result.info.mtimeMs,
        sizeBytes: result.info.sizeBytes,
        backup: result.backupName,
      };
    }
    if (result.code === "conflict") {
      return {
        ok: false,
        code: "conflict",
        message: "文件已被外部修改，请刷新后重试",
        detail: null,
        hash: result.currentHash,
        mtimeMs: null,
        sizeBytes: 0,
        backup: null,
      };
    }
    return {
      ok: false,
      code: "error",
      message: result.message,
      detail: null,
      hash: null,
      mtimeMs: null,
      sizeBytes: 0,
      backup: null,
    };
  }

  function denied(): WriteOutcome {
    return {
      ok: false,
      code: "read-only",
      message: "只读模式已开启，未写入任何文件",
      detail: null,
      hash: null,
      mtimeMs: null,
      sizeBytes: 0,
      backup: null,
    };
  }

  return {
    async getState() {
      const values = await readSettings();
      const sharedPath = sharedStorePath(ctx);
      const sharedInfo = await readFileInfo(sharedPath);

      const agents: Array<{
        id: AgentId;
        label: string;
        notes: string;
        path: string;
        exists: boolean;
        content: string;
        hash: string | null;
        mtimeMs: number | null;
        sizeBytes: number;
        sharedBlock: "none" | "ok" | "broken";
        sharedTarget: boolean;
      }> = [];

      for (const id of AGENT_IDS) {
        const path = resolveAgentPath(id, ctx, values.pathOverrides);
        const info = await readFileInfo(path);
        agents.push({
          id,
          label: AGENT_META[id].label,
          notes: AGENT_META[id].notes,
          path,
          exists: info.exists,
          content: info.content,
          hash: info.hash,
          mtimeMs: info.mtimeMs,
          sizeBytes: info.sizeBytes,
          sharedBlock: detectSharedBlock(info.content),
          sharedTarget: values.sharedTargets.includes(id),
        });
      }

      return {
        agents,
        shared: {
          path: sharedPath,
          exists: sharedInfo.exists,
          content: sharedInfo.content,
          hash: sharedInfo.hash,
          mtimeMs: sharedInfo.mtimeMs,
          sizeBytes: sharedInfo.sizeBytes,
        },
        readOnly: values.readOnly,
        backupRetention: values.backupRetention,
      };
    },

    async saveFile(input: RpcInput<typeof hubSaveFileRpc>) {
      const values = await readSettings();
      if (values.readOnly) return denied();
      const path = await pathForAgent(input.agentId);
      const result = await writeFileSafely(path, input.content, {
        expectedHash: input.expectedHash,
        backupRetention: values.backupRetention,
      });
      return toOutcome(result, result.ok && result.code === "written" ? "saved" : undefined);
    },

    async syncShared(input: RpcInput<typeof hubSyncSharedRpc>) {
      const values = await readSettings();
      if (values.readOnly) {
        const outcome = denied();
        return { shared: outcome, results: input.targets.map((agentId) => ({ agentId, outcome })) };
      }

      const sharedPath = sharedStorePath(ctx);
      const sharedWrite = await writeFileSafely(sharedPath, input.content, {
        expectedHash: input.expectedSharedHash,
        backupRetention: values.backupRetention,
      });
      const shared = toOutcome(sharedWrite, "saved");

      if (!shared.ok || input.saveOnly) {
        return { shared, results: [] };
      }

      const results: Array<{ agentId: AgentId; outcome: WriteOutcome }> = [];
      for (const agentId of input.targets) {
        const path = await pathForAgent(agentId);
        const current = await readFileInfo(path);

        const hasExpected = Object.prototype.hasOwnProperty.call(input.expectedHashes, agentId);
        const expected = hasExpected ? (input.expectedHashes[agentId] ?? null) : null;
        const matches = expected === null ? !current.exists : current.exists && current.hash === expected;
        if (!matches) {
          results.push({
            agentId,
            outcome: toOutcome({ ok: false, code: "conflict", currentHash: current.exists ? current.hash : null }),
          });
          continue;
        }

        const splice = spliceSharedBlock(current.exists ? current.content : null, input.content);
        if (!splice.ok) {
          results.push({
            agentId,
            outcome: {
              ok: false,
              code: "error",
              message: splice.error,
              detail: null,
              hash: current.hash,
              mtimeMs: current.mtimeMs,
              sizeBytes: current.sizeBytes,
              backup: null,
            },
          });
          continue;
        }

        if (splice.action === "unchanged") {
          results.push({
            agentId,
            outcome: {
              ok: true,
              code: "unchanged",
              message: "无变化",
              detail: "unchanged",
              hash: current.hash,
              mtimeMs: current.mtimeMs,
              sizeBytes: current.sizeBytes,
              backup: null,
            },
          });
          continue;
        }

        const write = await writeFileSafely(path, splice.next, {
          expectedHash: current.hash,
          backupRetention: values.backupRetention,
        });
        results.push({ agentId, outcome: toOutcome(write, splice.action) });
      }

      return { shared, results };
    },

    async history(input: RpcInput<typeof hubHistoryRpc>) {
      const path = input.target === "shared" ? sharedStorePath(ctx) : await pathForAgent(input.target);
      const backups = await listBackups(path);
      return {
        path,
        backups: backups.map((entry) => ({ name: entry.name, mtimeMs: entry.mtimeMs, sizeBytes: entry.sizeBytes })),
      };
    },

    async restore(input: RpcInput<typeof hubRestoreRpc>) {
      const values = await readSettings();
      if (values.readOnly) return denied();
      const path = input.target === "shared" ? sharedStorePath(ctx) : await pathForAgent(input.target);
      const result = await restoreBackup(path, input.backupName, {
        expectedHash: input.expectedHash,
        backupRetention: values.backupRetention,
      });
      return toOutcome(result, result.ok ? "restored" : undefined);
    },
  };
}
