/**
 * An embedder turns text into fixed-length vectors. Swap implementations
 * without touching the rest of the pipeline.
 */
export interface Embedder {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}

const STOPWORDS = new Set(
  (
    "a an and are as at be but by can do does for from has have how if in into is it its " +
    "of on or so than that the their then there these they this to was we what when where " +
    "which who why will with you your i my me should would could about after before over"
  ).split(" "),
);

/** Very light suffix stripping so "indexes", "indexing" and "index" collide. */
function stem(token: string): string {
  let t = token;
  if (t.length > 4) t = t.replace(/(ing|ed|es|s)$/, "");
  if (t.length > 4) t = t.replace(/e$/, "");
  return t;
}

export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return raw.filter((t) => t.length > 1 && !STOPWORDS.has(t)).map(stem);
}

/** 32-bit FNV-1a hash. */
function fnv1a(input: string, seed = 0x811c9dc5): number {
  let h = seed;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Offline, deterministic baseline embedder using signed feature hashing over
 * unigrams and bigrams with sublinear term frequency. It matches on shared
 * vocabulary, not meaning, which makes it a useful baseline and easy to test.
 * Replace it with a neural embedding model for real semantic search.
 */
export class HashEmbedder implements Embedder {
  readonly name: string;

  constructor(private readonly dim = 768) {
    this.name = `hash-${dim}`;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }

  private embedOne(text: string): number[] {
    const tokens = tokenize(text);
    const counts = new Map<string, number>();
    for (let i = 0; i < tokens.length; i++) {
      const uni = tokens[i]!;
      counts.set(uni, (counts.get(uni) ?? 0) + 1);
      if (i + 1 < tokens.length) {
        const bi = `${uni}_${tokens[i + 1]}`;
        counts.set(bi, (counts.get(bi) ?? 0) + 0.5);
      }
    }

    const vec = new Array<number>(this.dim).fill(0);
    for (const [feature, count] of counts) {
      const h = fnv1a(feature);
      const sign = fnv1a(feature, 0x9747b28c) & 1 ? -1 : 1;
      vec[h % this.dim]! += sign * (1 + Math.log(count));
    }

    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return norm === 0 ? vec : vec.map((v) => v / norm);
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}
