import { describe, expect, it } from "vitest";
import { chunkText, splitSentences } from "../src/chunker";

const sentence = (n: number) => `This is sentence number ${n} in the document.`;
const doc = (count: number) => Array.from({ length: count }, (_, i) => sentence(i)).join(" ");

describe("splitSentences", () => {
  it("splits on terminal punctuation and blank lines", () => {
    expect(splitSentences("One. Two! Three?\n\nFour without punctuation")).toEqual([
      "One.",
      "Two!",
      "Three?",
      "Four without punctuation",
    ]);
  });
});

describe("chunkText", () => {
  it("returns no chunks for empty or whitespace-only text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    expect(chunkText("Short text.")).toEqual(["Short text."]);
  });

  it("keeps chunks within the size limit", () => {
    const chunks = chunkText(doc(60), { size: 200, overlap: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200);
  });

  it("carries overlap between consecutive chunks", () => {
    const chunks = chunkText(doc(30), { size: 200, overlap: 60 });
    for (let i = 1; i < chunks.length; i++) {
      const lastSentenceOfPrev = splitSentences(chunks[i - 1]!).at(-1)!;
      expect(chunks[i]!.startsWith(lastSentenceOfPrev)).toBe(true);
    }
  });

  it("does not lose any sentence", () => {
    const text = doc(40);
    const joined = chunkText(text, { size: 180, overlap: 50 }).join(" ");
    for (let i = 0; i < 40; i++) expect(joined).toContain(sentence(i));
  });

  it("hard-splits a single sentence longer than the size", () => {
    const chunks = chunkText("x".repeat(1000), { size: 300, overlap: 50 });
    expect(chunks.length).toBe(4);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(300);
  });

  it("rejects invalid options", () => {
    expect(() => chunkText("text", { size: 100, overlap: 100 })).toThrow();
    expect(() => chunkText("text", { size: 0 })).toThrow();
  });
});
