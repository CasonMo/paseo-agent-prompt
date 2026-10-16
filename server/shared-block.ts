import { SHARED_BLOCK_BEGIN, SHARED_BLOCK_END } from "../shared/markers";

export { SHARED_BLOCK_BEGIN, SHARED_BLOCK_END };

export type SharedSpliceAction = "created" | "updated" | "appended" | "removed" | "unchanged";

export type SharedSpliceResult =
  | { ok: true; next: string; action: SharedSpliceAction }
  | { ok: false; error: string };

export function detectSharedBlock(content: string): "none" | "ok" | "broken" {
  const begin = content.indexOf(SHARED_BLOCK_BEGIN);
  const end = content.indexOf(SHARED_BLOCK_END);
  if (begin === -1 && end === -1) return "none";
  const beginCount = countOccurrences(content, SHARED_BLOCK_BEGIN);
  const endCount = countOccurrences(content, SHARED_BLOCK_END);
  if (beginCount === 1 && endCount === 1 && begin < end) return "ok";
  return "broken";
}

/**
 * Splice the shared block into a file body:
 * - no markers: append the block (create the body when the file is new/empty)
 * - one pair of markers: replace the marked region in place
 * - empty shared content: remove the marked region
 * Everything outside the markers is preserved verbatim.
 */
export function spliceSharedBlock(current: string | null, content: string): SharedSpliceResult {
  if (content.includes(SHARED_BLOCK_BEGIN) || content.includes(SHARED_BLOCK_END)) {
    return { ok: false, error: "共享块内容不能包含标记本身" };
  }

  const trimmed = content.replace(/\r\n/g, "\n").trim();
  const blockText =
    trimmed.length > 0
      ? `${SHARED_BLOCK_BEGIN}\n${trimmed}\n${SHARED_BLOCK_END}`
      : `${SHARED_BLOCK_BEGIN}\n${SHARED_BLOCK_END}`;

  const src = current ?? "";
  const beginCount = countOccurrences(src, SHARED_BLOCK_BEGIN);
  const endCount = countOccurrences(src, SHARED_BLOCK_END);

  if (beginCount > 1 || endCount > 1 || beginCount !== endCount) {
    return { ok: false, error: "现有文件中的共享块标记不完整或有多个，请手动修复后重试" };
  }

  if (beginCount === 1) {
    const begin = src.indexOf(SHARED_BLOCK_BEGIN);
    const end = src.indexOf(SHARED_BLOCK_END);
    if (begin > end) return { ok: false, error: "现有文件中的共享块标记顺序不正确" };

    const regionEnd = end + SHARED_BLOCK_END.length;
    const existing = src.slice(begin, regionEnd);
    if (existing === blockText) return { ok: true, next: src, action: "unchanged" };

    if (trimmed.length === 0) {
      const before = src.slice(0, begin).replace(/[ \t]*[\r\n]+[ \t]*$/, "");
      const after = src.slice(regionEnd).replace(/^[ \t]*[\r\n]+[ \t]*/, "");
      let next = before.length > 0 && after.length > 0 ? `${before}\n\n${after}` : `${before}${after}`;
      if (next.length > 0 && !next.endsWith("\n")) next += "\n";
      return { ok: true, next, action: "removed" };
    }

    return { ok: true, next: src.slice(0, begin) + blockText + src.slice(regionEnd), action: "updated" };
  }

  if (trimmed.length === 0) return { ok: true, next: src, action: "unchanged" };

  if (src.trim().length === 0) {
    return { ok: true, next: `${blockText}\n`, action: current === null ? "created" : "updated" };
  }

  const base = src.replace(/\s+$/, "");
  return { ok: true, next: `${base}\n\n${blockText}\n`, action: "appended" };
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = 0;
  for (;;) {
    const found = haystack.indexOf(needle, index);
    if (found === -1) break;
    count += 1;
    index = found + needle.length;
  }
  return count;
}
