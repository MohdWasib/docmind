import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cosine } from "./embedder";

export interface StoredChunk {
  id: string;
  docId: string;
  docName: string;
  index: number;
  text: string;
  vector: number[];
}

export interface DocInfo {
  id: string;
  name: string;
  chunks: number;
  addedAt: string;
}

export interface SearchHit {
  chunk: StoredChunk;
  score: number;
}

interface Snapshot {
  docs: DocInfo[];
  chunks: StoredChunk[];
}

/**
 * Minimal in-memory vector store with optional JSON persistence.
 * Search is a brute-force scan: O(chunks x dims), fine for thousands of
 * chunks. Beyond that, move to an ANN index (pgvector, HNSW, etc.).
 */
export class VectorStore {
  private chunks: StoredChunk[] = [];
  private docs = new Map<string, DocInfo>();

  constructor(private readonly filePath?: string) {
    this.load();
  }

  addDocument(doc: DocInfo, chunks: StoredChunk[]): void {
    this.docs.set(doc.id, doc);
    this.chunks.push(...chunks);
    this.persist();
  }

  removeDocument(id: string): boolean {
    if (!this.docs.delete(id)) return false;
    this.chunks = this.chunks.filter((c) => c.docId !== id);
    this.persist();
    return true;
  }

  findByName(name: string): DocInfo | undefined {
    for (const doc of this.docs.values()) if (doc.name === name) return doc;
    return undefined;
  }

  listDocuments(): DocInfo[] {
    return [...this.docs.values()].sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  }

  search(query: number[], k: number): SearchHit[] {
    return this.chunks
      .map((chunk) => ({ chunk, score: cosine(query, chunk.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  private load(): void {
    if (!this.filePath || !existsSync(this.filePath)) return;
    const snap = JSON.parse(readFileSync(this.filePath, "utf8")) as Snapshot;
    this.chunks = snap.chunks;
    this.docs = new Map(snap.docs.map((d) => [d.id, d]));
  }

  /** Write to a temp file then rename, so a crash never leaves a torn file. */
  private persist(): void {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    const snap: Snapshot = { docs: [...this.docs.values()], chunks: this.chunks };
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(snap));
    renameSync(tmp, this.filePath);
  }
}
