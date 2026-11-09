export interface ChunkOptions {
  /** Target maximum characters per chunk. */
  size: number;
  /** Approximate characters of trailing context carried into the next chunk. */
  overlap: number;
}

const DEFAULTS: ChunkOptions = { size: 600, overlap: 100 };

/** Split text into sentences, treating blank lines as hard boundaries. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function hardSplit(sentence: string, size: number): string[] {
  if (sentence.length <= size) return [sentence];
  const parts: string[] = [];
  for (let i = 0; i < sentence.length; i += size) {
    parts.push(sentence.slice(i, i + size));
  }
  return parts;
}

/**
 * Sentence-aware chunking with overlap. Chunks never cut a sentence in half
 * unless a single sentence is longer than `size`.
 */
export function chunkText(text: string, opts: Partial<ChunkOptions> = {}): string[] {
  const { size, overlap } = { ...DEFAULTS, ...opts };
  if (size <= 0) throw new Error("size must be positive");
  if (overlap < 0 || overlap >= size) throw new Error("overlap must be in [0, size)");

  const sentences = splitSentences(text).flatMap((s) => hardSplit(s, size));
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const sentence of sentences) {
    if (current.length > 0 && length + sentence.length + 1 > size) {
      chunks.push(current.join(" "));

      const carry: string[] = [];
      let carryLength = 0;
      for (let i = current.length - 1; i >= 0; i--) {
        const s = current[i]!;
        if (carryLength + s.length > overlap) break;
        carry.unshift(s);
        carryLength += s.length + 1;
      }
      current = carry;
      length = carryLength;
    }
    current.push(sentence);
    length += sentence.length + 1;
  }

  if (current.length > 0) chunks.push(current.join(" "));
  return chunks;
}
