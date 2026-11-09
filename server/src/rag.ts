import { randomUUID } from "node:crypto";
import { chunkText, type ChunkOptions } from "./chunker";
import type { Embedder } from "./embedder";
import type { LLM } from "./llm";
import type { DocInfo, VectorStore } from "./vectorStore";

export class ValidationError extends Error {}

export const NO_ANSWER = "I couldn't find that in the uploaded documents.";

export interface Source {
  n: number;
  docId: string;
  docName: string;
  chunkIndex: number;
  score: number;
  text: string;
}

export interface AskResult {
  answer: string;
  sources: Source[];
  model: string;
}

export interface RagOptions {
  /** Hits scoring below this are discarded; if none remain we skip the LLM. */
  minScore: number;
  chunk?: Partial<ChunkOptions>;
}

export class RagService {
  constructor(
    private readonly embedder: Embedder,
    private readonly store: VectorStore,
    private readonly llm: LLM,
    private readonly opts: RagOptions = { minScore: 0.12 },
  ) {}

  /** Ingest a document. Re-uploading the same name replaces the old version. */
  async ingest(name: string, text: string): Promise<DocInfo> {
    const pieces = chunkText(text, this.opts.chunk);
    if (pieces.length === 0) throw new ValidationError("Document has no extractable text");

    const vectors = await this.embedder.embed(pieces);

    const existing = this.store.findByName(name);
    if (existing) this.store.removeDocument(existing.id);

    const docId = randomUUID();
    const info: DocInfo = {
      id: docId,
      name,
      chunks: pieces.length,
      addedAt: new Date().toISOString(),
    };
    this.store.addDocument(
      info,
      pieces.map((piece, index) => ({
        id: `${docId}:${index}`,
        docId,
        docName: name,
        index,
        text: piece,
        vector: vectors[index]!,
      })),
    );
    return info;
  }

  /** Retrieve only. Used by the eval harness to measure retrieval quality in isolation. */
  async retrieve(question: string, k: number) {
    const [queryVector] = await this.embedder.embed([question]);
    return this.store.search(queryVector!, k).filter((h) => h.score >= this.opts.minScore);
  }

  async ask(question: string, k = 4): Promise<AskResult> {
    const hits = await this.retrieve(question, k);

    // Guardrail: no relevant context means no LLM call and no invented answer.
    if (hits.length === 0) return { answer: NO_ANSWER, sources: [], model: this.llm.name };

    const passages = hits.map((h, i) => ({
      n: i + 1,
      docName: h.chunk.docName,
      text: h.chunk.text,
    }));
    const answer = await this.llm.answer(question, passages);

    return {
      answer,
      model: this.llm.name,
      sources: hits.map((h, i) => ({
        n: i + 1,
        docId: h.chunk.docId,
        docName: h.chunk.docName,
        chunkIndex: h.chunk.index,
        score: Math.round(h.score * 1000) / 1000,
        text: h.chunk.text,
      })),
    };
  }
}
