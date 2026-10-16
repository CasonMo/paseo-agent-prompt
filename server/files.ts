import { createHash, randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export type Eol = "\n" | "\r\n";

export interface FileInfo {
  path: string;
  exists: boolean;
  content: string;
  hash: string | null;
  mtimeMs: number | null;
  sizeBytes: number;
  eol: Eol;
}

export interface BackupEntry {
  name: string;
  mtimeMs: number;
  sizeBytes: number;
}

export type WriteResult =
  | { ok: true; code: "written" | "unchanged"; info: FileInfo; backupName: string | null }
  | { ok: false; code: "conflict"; currentHash: string | null }
  | { ok: false; code: "error"; message: string };

export interface WriteOptions {
  /** Hash the editor read. null means "the file did not exist". */
  expectedHash: string | null;
  backupRetention: number;
}

export async function readFileInfo(path: string): Promise<FileInfo> {
  try {
    const buffer = await readFile(path);
    const content = buffer.toString("utf8");
    const info = await stat(path);
    return {
      path,
      exists: true,
      content,
      hash: hashText(content),
      mtimeMs: info.mtimeMs,
      sizeBytes: buffer.byteLength,
      eol: content.includes("\r\n") ? "\r\n" : "\n",
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { path, exists: false, content: "", hash: null, mtimeMs: null, sizeBytes: 0, eol: "\n" };
    }
    throw error;
  }
}

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export function applyEol(text: string, eol: Eol): string {
  return eol === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

/**
 * Resolve where a write should land. When the requested path is a symbolic link
 * (common for dotfiles setups), writes go to the link target so the link is kept.
 */
export async function resolveWriteTarget(path: string): Promise<string> {
  let isLink = false;
  try {
    isLink = (await lstat(path)).isSymbolicLink();
  } catch {
    return path;
  }
  if (!isLink) return path;
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}

/**
 * Conflict-checked, backup-first, atomic write.
 * - expectedHash must match the current file (or null when it must not exist yet)
 * - the current version is copied to a timestamped backup before the write
 * - the new content is written to a temp file in the same directory, then renamed
 * - original file permissions, line endings, and symbolic links are preserved
 */
export async function writeFileSafely(path: string, content: string, options: WriteOptions): Promise<WriteResult> {
  const target = await resolveWriteTarget(path);

  let existing: FileInfo;
  try {
    existing = await readFileInfo(target);
  } catch (error) {
    return errorResult(error);
  }

  const matches = options.expectedHash === null ? !existing.exists : existing.exists && existing.hash === options.expectedHash;
  if (!matches) {
    return { ok: false, code: "conflict", currentHash: existing.exists ? existing.hash : null };
  }

  const eol: Eol = existing.exists ? existing.eol : "\n";
  const next = applyEol(normalizeEol(content), eol);

  if (existing.exists && next === existing.content) {
    return { ok: true, code: "unchanged", info: existing, backupName: null };
  }

  let backupName: string | null = null;
  const tmpPath = join(dirname(target), `.${basename(target)}.paseo-tmp-${randomBytes(6).toString("hex")}`);
  try {
    if (existing.exists) backupName = await backupFile(target, existing);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(tmpPath, next, "utf8");
    if (existing.exists) {
      try {
        const info = await stat(target);
        await chmod(tmpPath, info.mode);
      } catch {
        /* keep the default mode */
      }
    }
    await rename(tmpPath, target);
  } catch (error) {
    await rm(tmpPath, { force: true }).catch(() => undefined);
    return errorResult(error);
  }

  if (backupName !== null) await pruneBackups(target, options.backupRetention);

  try {
    const info = await readFileInfo(target);
    return { ok: true, code: "written", info, backupName };
  } catch (error) {
    return errorResult(error);
  }
}

export async function listBackups(path: string): Promise<BackupEntry[]> {
  const target = await resolveWriteTarget(path);
  const dir = dirname(target);
  const pattern = backupRegex(basename(target));
  try {
    const names = await readdir(dir);
    const out: BackupEntry[] = [];
    for (const name of names) {
      if (!pattern.test(name)) continue;
      try {
        const info = await stat(join(dir, name));
        out.push({ name, mtimeMs: info.mtimeMs, sizeBytes: info.size });
      } catch {
        /* skip unreadable entries */
      }
    }
    out.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
    return out;
  } catch {
    return [];
  }
}

export async function restoreBackup(path: string, backupName: string, options: WriteOptions): Promise<WriteResult> {
  const target = await resolveWriteTarget(path);
  if (backupName.includes("/") || backupName.includes("\\") || backupName !== basename(backupName)) {
    return { ok: false, code: "error", message: "非法的备份文件名" };
  }
  if (!backupRegex(basename(target)).test(backupName)) {
    return { ok: false, code: "error", message: "备份文件名与目标文件不匹配" };
  }
  let content: string;
  try {
    content = await readFile(join(dirname(target), backupName), "utf8");
  } catch {
    return { ok: false, code: "error", message: "备份文件不存在或不可读" };
  }
  return writeFileSafely(target, content, options);
}

async function backupFile(target: string, existing: FileInfo): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let name = `${basename(target)}.bak.${stamp}`;
  let fullPath = join(dirname(target), name);
  try {
    await stat(fullPath);
    name = `${basename(target)}.bak.${stamp}-${randomBytes(3).toString("hex")}`;
    fullPath = join(dirname(target), name);
  } catch {
    /* name is free */
  }
  await writeFile(fullPath, existing.content, "utf8");
  return name;
}

async function pruneBackups(target: string, retention: number): Promise<void> {
  const backups = await listBackups(target);
  for (const entry of backups.slice(Math.max(retention, 1))) {
    try {
      await rm(join(dirname(target), entry.name), { force: true });
    } catch {
      /* best effort */
    }
  }
}

function backupRegex(base: string): RegExp {
  return new RegExp(`^${escapeRegExp(base)}\\.bak\\.\\d{4}-\\d{2}-\\d{2}T[0-9TZ-]*Z(?:-[0-9a-f]{6})?$`);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function errorResult(error: unknown): WriteResult {
  return { ok: false, code: "error", message: error instanceof Error ? error.message : String(error) };
}
