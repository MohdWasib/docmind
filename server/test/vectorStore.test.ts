import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { VectorStore, type DocInfo, type StoredChunk } from "../src/vectorStore";

const doc = (id: string, name = id): DocInfo => ({ id, name, chunks: 2, addedAt: new Date().toISOString() });
const chunk = (docId: string, index: number, vector: number[]): StoredChunk => ({
  id: `${docId}:${index}`,
  docId,
  docName: docId,
  index,
  text: `${docId} chunk ${index}`,
  vector,
});

describe("VectorStore", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("returns hits ordered by similarity and respects k", () => {
    const store = new VectorStore();
    store.addDocument(doc("a"), [chunk("a", 0, [1, 0]), chunk("a", 1, [0.7, 0.7])]);
    store.addDocument(doc("b"), [chunk("b", 0, [0, 1])]);

    const hits = store.search([1, 0], 2);
    expect(hits.map((h) => h.chunk.id)).toEqual(["a:0", "a:1"]);
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
  });

  it("removes a document and all of its chunks", () => {
    const store = new VectorStore();
    store.addDocument(doc("a"), [chunk("a", 0, [1, 0])]);
    store.addDocument(doc("b"), [chunk("b", 0, [0, 1])]);

    expect(store.removeDocument("a")).toBe(true);
    expect(store.removeDocument("a")).toBe(false);
    expect(store.listDocuments().map((d) => d.id)).toEqual(["b"]);
    expect(store.search([1, 0], 5).every((h) => h.chunk.docId === "b")).toBe(true);
  });

  it("finds documents by name", () => {
    const store = new VectorStore();
    store.addDocument(doc("id-1", "notes.md"), [chunk("id-1", 0, [1, 0])]);
    expect(store.findByName("notes.md")?.id).toBe("id-1");
    expect(store.findByName("missing.md")).toBeUndefined();
  });

  it("persists to disk and reloads", () => {
    const dir = mkdtempSync(join(tmpdir(), "docmind-"));
    dirs.push(dir);
    const file = join(dir, "nested", "store.json");

    const first = new VectorStore(file);
    first.addDocument(doc("a"), [chunk("a", 0, [1, 0])]);

    const second = new VectorStore(file);
    expect(second.listDocuments().map((d) => d.id)).toEqual(["a"]);
    expect(second.search([1, 0], 1)[0]!.chunk.id).toBe("a:0");
  });
});
