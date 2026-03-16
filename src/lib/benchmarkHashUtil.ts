/**
 * Deterministic hash for benchmark chunk IDs.
 * Mirrors the platform SHA256(document_id + parse_version + chunk_index) pattern
 * using a simple FNV-1a hash for in-browser use without crypto dependencies.
 */

export function createHash(documentId: string, parseVersion: string, chunkIndex: number): string {
  const input = `${documentId}:${parseVersion}:${chunkIndex}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
