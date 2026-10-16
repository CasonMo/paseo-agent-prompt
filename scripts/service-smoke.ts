import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHubService } from "../server/hub";
import { hubSettingsSchema } from "../shared/hub";

const DEFAULTS = hubSettingsSchema.parse({});

function fakeSettings(overrides: Record<string, unknown> = {}) {
  const values = { ...DEFAULTS, ...overrides };
  return {
    read: async () => ({ status: "ready" as const, revision: "rev-1", values }),
    subscribe: () => () => {},
  } as unknown as Parameters<typeof createHubService>[0];
}

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "prompt-hub-svc-"));
  const ctx = { env: {}, home: dir };
  try {
    const service = createHubService(fakeSettings(), ctx);
    const claudePath = join(dir, ".claude", "CLAUDE.md");
    const codexPath = join(dir, ".codex", "AGENTS.md");

    const state1 = await service.getState();
    assert.equal(state1.agents.length, 5);
    assert.ok(state1.agents.every((agent) => !agent.exists));
    assert.equal(state1.shared.exists, false);

    const save1 = await service.saveFile({ agentId: "claude", content: "my private rules\n", expectedHash: null });
    assert.ok(save1.ok && save1.backup === null);
    assert.equal(await readFile(claudePath, "utf8"), "my private rules\n");

    const saveConflict = await service.saveFile({ agentId: "claude", content: "nope", expectedHash: "stale" });
    assert.ok(!saveConflict.ok && saveConflict.code === "conflict");

    const state2 = await service.getState();
    const claude2 = state2.agents.find((agent) => agent.id === "claude")!;
    const sync1 = await service.syncShared({
      content: "shared: reply in Chinese\n",
      expectedSharedHash: null,
      targets: ["claude", "codex", "pi"],
      expectedHashes: { claude: claude2.hash, codex: null, pi: null },
      saveOnly: false,
    });
    assert.ok(sync1.shared.ok, JSON.stringify(sync1.shared));
    assert.equal(sync1.results.length, 3);
    assert.ok(sync1.results.every((entry) => entry.outcome.ok), JSON.stringify(sync1.results));
    const claudeAfter1 = await readFile(claudePath, "utf8");
    assert.ok(claudeAfter1.startsWith("my private rules"));
    assert.ok(claudeAfter1.includes("<!-- paseo-prompt-hub:shared:begin -->"));
    assert.ok(claudeAfter1.includes("shared: reply in Chinese"));
    const codexText = await readFile(codexPath, "utf8");
    assert.ok(codexText.startsWith("<!-- paseo-prompt-hub:shared:begin -->"));

    const state3 = await service.getState();
    assert.equal(state3.agents.find((agent) => agent.id === "claude")!.sharedBlock, "ok");
    assert.equal(state3.agents.find((agent) => agent.id === "qoder")!.sharedBlock, "none");

    const sync2 = await service.syncShared({
      content: "shared v2\n",
      expectedSharedHash: state3.shared.hash,
      targets: ["claude"],
      expectedHashes: { claude: state3.agents.find((agent) => agent.id === "claude")!.hash },
      saveOnly: false,
    });
    assert.ok(sync2.shared.ok);
    const claudeAfter2 = await readFile(claudePath, "utf8");
    assert.ok(claudeAfter2.includes("shared v2"));
    assert.ok(!claudeAfter2.includes("reply in Chinese"));

    const history = await service.history({ target: "claude" });
    assert.ok(history.backups.length >= 1);
    const state4 = await service.getState();
    const claude4 = state4.agents.find((agent) => agent.id === "claude")!;
    const restored = await service.restore({ target: "claude", backupName: history.backups[0].name, expectedHash: claude4.hash });
    assert.ok(restored.ok, JSON.stringify(restored));
    const restoredText = await readFile(claudePath, "utf8");
    assert.ok(restoredText.includes("shared: reply in Chinese"));

    const state5 = await service.getState();
    const sync3 = await service.syncShared({
      content: "",
      expectedSharedHash: state5.shared.hash,
      targets: ["claude", "codex"],
      expectedHashes: {
        claude: state5.agents.find((agent) => agent.id === "claude")!.hash,
        codex: state5.agents.find((agent) => agent.id === "codex")!.hash,
      },
      saveOnly: false,
    });
    assert.ok(sync3.shared.ok);
    assert.ok(sync3.results.every((entry) => entry.outcome.ok), JSON.stringify(sync3.results));
    const claudeRemoved = await readFile(claudePath, "utf8");
    assert.ok(!claudeRemoved.includes("<!-- paseo-prompt-hub"));
    assert.equal(claudeRemoved, "my private rules\n");

    const readOnlyService = createHubService(fakeSettings({ readOnly: true }), ctx);
    const denied = await readOnlyService.saveFile({ agentId: "qoder", content: "x", expectedHash: null });
    assert.ok(!denied.ok && denied.code === "read-only");

    const state6 = await service.getState();
    const saveOnly = await service.syncShared({
      content: "only store\n",
      expectedSharedHash: state6.shared.hash,
      targets: [],
      expectedHashes: {},
      saveOnly: true,
    });
    assert.ok(saveOnly.shared.ok && saveOnly.results.length === 0);

    console.log("service smoke: all ok");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

void main();
