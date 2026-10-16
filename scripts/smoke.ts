import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listBackups, readFileInfo, restoreBackup, writeFileSafely } from "../server/files";
import { resolveAgentPath, sharedStorePath, type PathContext } from "../server/paths";
import { SHARED_BLOCK_BEGIN, SHARED_BLOCK_END, detectSharedBlock, spliceSharedBlock } from "../server/shared-block";

function testPaths() {
  const ctx: PathContext = { env: {}, home: "/Users/tester" };
  assert.equal(resolveAgentPath("claude", ctx), "/Users/tester/.claude/CLAUDE.md");
  assert.equal(resolveAgentPath("codex", ctx), "/Users/tester/.codex/AGENTS.md");
  assert.equal(resolveAgentPath("pi", ctx), "/Users/tester/.pi/agent/AGENTS.md");
  assert.equal(resolveAgentPath("opencode", ctx), "/Users/tester/.config/opencode/AGENTS.md");
  assert.equal(resolveAgentPath("qoder", ctx), "/Users/tester/.qoder/AGENTS.md");

  const envCtx: PathContext = {
    env: {
      CLAUDE_CONFIG_DIR: "/x/claude",
      CODEX_HOME: "/x/codex",
      PI_CODING_AGENT_DIR: "/x/pi",
      XDG_CONFIG_HOME: "/x/xdg",
      QODER_CONFIG_DIR: "/x/qoder",
    },
    home: "/Users/tester",
  };
  assert.equal(resolveAgentPath("claude", envCtx), "/x/claude/CLAUDE.md");
  assert.equal(resolveAgentPath("codex", envCtx), "/x/codex/AGENTS.md");
  assert.equal(resolveAgentPath("pi", envCtx), "/x/pi/AGENTS.md");
  assert.equal(resolveAgentPath("opencode", envCtx), "/x/xdg/opencode/AGENTS.md");
  assert.equal(resolveAgentPath("qoder", envCtx), "/x/qoder/AGENTS.md");
  assert.equal(sharedStorePath(envCtx), "/x/xdg/paseo/prompt-hub/shared.md");
  assert.equal(resolveAgentPath("codex", ctx, { codex: "~/custom/AGENTS.md" }), "/Users/tester/custom/AGENTS.md");
  console.log("paths ok");
}

function testSplice() {
  const created = spliceSharedBlock(null, "hello");
  assert.ok(created.ok);
  assert.equal(created.action, "created");
  assert.equal(created.next, `${SHARED_BLOCK_BEGIN}\nhello\n${SHARED_BLOCK_END}\n`);

  const unchanged = spliceSharedBlock(created.next, "hello");
  assert.ok(unchanged.ok);
  assert.equal(unchanged.action, "unchanged");

  const updated = spliceSharedBlock(created.next, "hello v2");
  assert.ok(updated.ok);
  assert.equal(updated.action, "updated");
  assert.equal(updated.next, `${SHARED_BLOCK_BEGIN}\nhello v2\n${SHARED_BLOCK_END}\n`);

  const appended = spliceSharedBlock("# User rules\n\nkeep me\n", "shared");
  assert.ok(appended.ok);
  assert.equal(appended.action, "appended");
  assert.equal(appended.next, `# User rules\n\nkeep me\n\n${SHARED_BLOCK_BEGIN}\nshared\n${SHARED_BLOCK_END}\n`);

  const removed = spliceSharedBlock(appended.next, "");
  assert.ok(removed.ok);
  assert.equal(removed.action, "removed");
  assert.equal(removed.next, "# User rules\n\nkeep me\n");

  const broken = spliceSharedBlock(`${SHARED_BLOCK_BEGIN} only`, "y");
  assert.ok(!broken.ok);

  const nested = spliceSharedBlock(null, `evil ${SHARED_BLOCK_END}`);
  assert.ok(!nested.ok);

  assert.equal(detectSharedBlock("plain"), "none");
  assert.equal(detectSharedBlock(created.next), "ok");
  assert.equal(detectSharedBlock(`${SHARED_BLOCK_BEGIN} x`), "broken");
  console.log("splice ok");
}

async function testFiles() {
  const dir = await mkdtemp(join(tmpdir(), "prompt-hub-test-"));
  try {
    const file = join(dir, "AGENTS.md");

    const created = await writeFileSafely(file, "line1\nline2\n", { expectedHash: null, backupRetention: 3 });
    assert.ok(created.ok && created.code === "written");

    const stale = await writeFileSafely(file, "x", { expectedHash: "stale", backupRetention: 3 });
    assert.ok(!stale.ok && stale.code === "conflict");

    const info = await readFileInfo(file);
    const unchanged = await writeFileSafely(file, info.content, { expectedHash: info.hash, backupRetention: 3 });
    assert.ok(unchanged.ok && unchanged.code === "unchanged");

    const updated = await writeFileSafely(file, "line1\nline2\nline3\n", { expectedHash: info.hash, backupRetention: 3 });
    assert.ok(updated.ok && updated.code === "written");
    assert.ok(updated.backupName);
    assert.equal(updated.info.content, "line1\nline2\nline3\n");

    let backups = await listBackups(file);
    assert.equal(backups.length, 1);

    const crlfFile = join(dir, "CRLF.md");
    await writeFile(crlfFile, "a\r\nb\r\n", "utf8");
    const crlfInfo = await readFileInfo(crlfFile);
    assert.equal(crlfInfo.eol, "\r\n");
    const crlfWrite = await writeFileSafely(crlfFile, "a\nb\nc\n", { expectedHash: crlfInfo.hash, backupRetention: 3 });
    assert.ok(crlfWrite.ok);
    assert.equal(await readFile(crlfFile, "utf8"), "a\r\nb\r\nc\r\n");

    let current = await readFileInfo(file);
    for (let index = 0; index < 5; index += 1) {
      const result = await writeFileSafely(file, `version-${index}\n`, { expectedHash: current.hash, backupRetention: 2 });
      assert.ok(result.ok);
      current = result.info;
    }
    backups = await listBackups(file);
    assert.equal(backups.length, 2);

    const restored = await restoreBackup(file, backups[0].name, { expectedHash: current.hash, backupRetention: 2 });
    assert.ok(restored.ok);
    assert.equal(await readFile(file, "utf8"), "version-3\n");

    // symlink write-through: writing via a symlink keeps the symlink and updates the real file
    const realFile = join(dir, "real-config.md");
    const linkFile = join(dir, "link-config.md");
    const realCreated = await writeFileSafely(realFile, "original\n", { expectedHash: null, backupRetention: 3 });
    assert.ok(realCreated.ok);
    await symlink(realFile, linkFile);
    const linkRead = await readFileInfo(linkFile);
    const viaLink = await writeFileSafely(linkFile, "updated via link\n", { expectedHash: linkRead.hash, backupRetention: 3 });
    assert.ok(viaLink.ok, JSON.stringify(viaLink));
    assert.ok((await lstat(linkFile)).isSymbolicLink());
    assert.equal(await readFile(realFile, "utf8"), "updated via link\n");
    const linkBackups = await listBackups(linkFile);
    assert.ok(linkBackups.length >= 1);

    const badName = await restoreBackup(file, "../evil", { expectedHash: restored.ok ? restored.info.hash : null, backupRetention: 2 });
    assert.ok(!badName.ok && badName.code === "error");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  console.log("files ok");
}

async function main() {
  testPaths();
  testSplice();
  await testFiles();
  console.log("smoke: all ok");
}

void main();
