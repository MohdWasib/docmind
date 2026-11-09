import { describe, expect, it } from "vitest";
import { HashEmbedder, cosine, tokenize } from "../src/embedder";

describe("tokenize", () => {
  it("lowercases, drops stopwords and stems simple suffixes", () => {
    expect(tokenize("The Indexes are indexing")).toEqual(["index", "index"]);
  });
});

describe("HashEmbedder", () => {
  const embedder = new HashEmbedder();

  it("is deterministic", async () => {
    const [a] = await embedder.embed(["postgres index types"]);
    const [b] = await embedder.embed(["postgres index types"]);
    expect(a).toEqual(b);
  });

  it("produces unit-length vectors of the configured dimension", async () => {
    const [v] = await embedder.embed(["some reasonable sentence about caching"]);
    expect(v).toHaveLength(768);
    expect(Math.sqrt(v!.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 5);
  });

  it("returns a zero vector for text with no usable tokens", async () => {
    const [v] = await embedder.embed(["the and of"]);
    expect(v!.every((x) => x === 0)).toBe(true);
  });

  it("scores related text higher than unrelated text", async () => {
    const [query, related, unrelated] = await embedder.embed([
      "how do database indexes speed up queries",
      "A database index speeds up read queries on large tables",
      "Bake the sourdough loaf at high heat until golden",
    ]);
    expect(cosine(query!, related!)).toBeGreaterThan(cosine(query!, unrelated!));
  });
});

describe("cosine", () => {
  it("handles zero vectors without NaN", () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });

  it("is 1 for identical direction and 0 for orthogonal", () => {
    expect(cosine([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
});
