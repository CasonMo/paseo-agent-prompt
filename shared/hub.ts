import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";
import { AGENT_IDS } from "./agents";

export const agentIdSchema = z.enum(AGENT_IDS);
export const hubTargetSchema = z.union([agentIdSchema, z.literal("shared")]);

export const hubSettingsSchema = z.object({
  /** Plugin UI language. English by default. */
  language: z.enum(["en", "zh"]).default("en"),
  /** Agents that receive the shared block when syncing. */
  sharedTargets: z.array(agentIdSchema).default([...AGENT_IDS]),
  /** Optional per-agent absolute (or ~/) path overrides. Empty string means "use default". */
  pathOverrides: z.record(z.string(), z.string()).default({}),
  /** How many timestamped backups to keep per file. */
  backupRetention: z.number().int().min(1).max(100).default(10),
  /** When true, no file is written (agent files and the shared store are read-only). */
  readOnly: z.boolean().default(false),
});
export type HubSettingsValues = z.infer<typeof hubSettingsSchema>;

export const hubSettings = defineSettings({
  id: "hub",
  scope: "host",
  version: 1,
  schema: hubSettingsSchema,
});

export const outcomeDetailSchema = z.enum([
  "saved",
  "created",
  "appended",
  "updated",
  "removed",
  "unchanged",
  "restored",
]);
export type OutcomeDetail = z.infer<typeof outcomeDetailSchema>;

export const writeOutcomeSchema = z.object({
  ok: z.boolean(),
  code: z.enum(["ok", "unchanged", "conflict", "read-only", "error"]),
  message: z.string().nullable(),
  detail: outcomeDetailSchema.nullable(),
  hash: z.string().nullable(),
  mtimeMs: z.number().nullable(),
  sizeBytes: z.number(),
  backup: z.string().nullable(),
});
export type WriteOutcome = z.infer<typeof writeOutcomeSchema>;

export const agentStateSchema = z.object({
  id: agentIdSchema,
  label: z.string(),
  notes: z.string(),
  path: z.string(),
  exists: z.boolean(),
  content: z.string(),
  hash: z.string().nullable(),
  mtimeMs: z.number().nullable(),
  sizeBytes: z.number(),
  sharedBlock: z.enum(["none", "ok", "broken"]),
  sharedTarget: z.boolean(),
});
export type AgentState = z.infer<typeof agentStateSchema>;

export const sharedStateSchema = z.object({
  path: z.string(),
  exists: z.boolean(),
  content: z.string(),
  hash: z.string().nullable(),
  mtimeMs: z.number().nullable(),
  sizeBytes: z.number(),
});

export const hubStateSchema = z.object({
  agents: z.array(agentStateSchema),
  shared: sharedStateSchema,
  readOnly: z.boolean(),
  backupRetention: z.number(),
});
export type HubState = z.infer<typeof hubStateSchema>;

export const hubGetStateRpc = defineRpc({
  name: "prompt-hub.get-state",
  input: z.object({}),
  output: hubStateSchema,
});

export const hubSaveFileRpc = defineRpc({
  name: "prompt-hub.save-file",
  input: z.object({
    agentId: agentIdSchema,
    content: z.string().max(300_000),
    expectedHash: z.string().nullable(),
  }),
  output: writeOutcomeSchema,
});

export const hubSyncSharedRpc = defineRpc({
  name: "prompt-hub.sync-shared",
  input: z.object({
    content: z.string().max(300_000),
    expectedSharedHash: z.string().nullable(),
    targets: z.array(agentIdSchema),
    expectedHashes: z.record(z.string(), z.string().nullable()),
    saveOnly: z.boolean(),
  }),
  output: z.object({
    shared: writeOutcomeSchema,
    results: z.array(z.object({ agentId: agentIdSchema, outcome: writeOutcomeSchema })),
  }),
});

export const hubHistoryRpc = defineRpc({
  name: "prompt-hub.history",
  input: z.object({ target: hubTargetSchema }),
  output: z.object({
    path: z.string(),
    backups: z.array(z.object({ name: z.string(), mtimeMs: z.number(), sizeBytes: z.number() })),
  }),
});

export const hubRestoreRpc = defineRpc({
  name: "prompt-hub.restore",
  input: z.object({
    target: hubTargetSchema,
    backupName: z.string().max(300),
    expectedHash: z.string().nullable(),
  }),
  output: writeOutcomeSchema,
});

export const hubUpdateCheckRpc = defineRpc({
  name: "prompt-hub.update-check",
  input: z.object({}),
  output: z.object({
    currentVersion: z.string(),
    latestVersion: z.string(),
    latestCommit: z.string(),
    updateAvailable: z.boolean(),
    checkedAt: z.string(),
  }),
});
