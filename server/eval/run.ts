/**
 * Retrieval evaluation. Measures how well the retriever surfaces the right
 * document for a labelled set of questions, independent of any LLM.
 *
 *   hit@k   fraction of answerable questions whose top-k chunks include the expected doc
 *   MRR     mean reciprocal rank of the first chunk from the expected doc
 *   abstain fraction of unanswerable questions correctly rejected by the score threshold
 *
 * Run with: npm run eval   (exits non-zero if quality drops below the gates)
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HashEmbedder } from "../src/embedder";
import { ExtractiveLLM } from "../src/llm";
import { RagService } from "../src/rag";
import { VectorStore } from "../src/vectorStore";

interface Case {
  question: string;
  doc: string | null;
}

const here = dirname(fileURLToPath(import.meta.url));
const corpusDir = join(here, "corpus");
const cases = JSON.parse(readFileSync(join(here, "golden.json"), "utf8")) as Case[];

const GATES = { hitAt3: 0.8, abstain: 0.66 };
const PRODUCTION_MIN_SCORE = 0.12;

async function build(minScore: number) {
  const store = new VectorStore();
  const rag = new RagService(new HashEmbedder(), store, new ExtractiveLLM(), { minScore });
  for (const file of readdirSync(corpusDir).filter((f) => f.endsWith(".md"))) {
    await rag.ingest(file, readFileSync(join(corpusDir, file), "utf8"));
  }
  return rag;
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

async function main() {
  // Rank with no threshold so we measure ordering quality on its own.
  const ranker = await build(0);
  // Production threshold, used only for the abstain check.
  const production = await build(PRODUCTION_MIN_SCORE);

  const answerable = cases.filter((c) => c.doc !== null);
  const unanswerable = cases.filter((c) => c.doc === null);

  let hit1 = 0;
  let hit3 = 0;
  let reciprocalRanks = 0;

  console.log("Answerable questions");
  for (const c of answerable) {
    const hits = await ranker.retrieve(c.question, 5);
    const rank = hits.findIndex((h) => h.chunk.docName === c.doc) + 1; // 0 = miss
    if (rank === 1) hit1++;
    if (rank >= 1 && rank <= 3) hit3++;
    if (rank > 0) reciprocalRanks += 1 / rank;
    const top = hits[0];
    console.log(
      `  ${rank === 1 ? "PASS" : rank > 0 ? "WEAK" : "MISS"}  rank=${rank || "-"}  top=${top?.chunk.docName ?? "-"} (${top?.score.toFixed(2) ?? "-"})  ${c.question}`,
    );
  }

  let abstained = 0;
  console.log("\nUnanswerable questions (should be rejected by the threshold)");
  for (const c of unanswerable) {
    const hits = await production.retrieve(c.question, 5);
    const ok = hits.length === 0;
    if (ok) abstained++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  returned=${hits.length}  ${c.question}`);
  }

  const result = {
    hitAt1: hit1 / answerable.length,
    hitAt3: hit3 / answerable.length,
    mrr: reciprocalRanks / answerable.length,
    abstain: unanswerable.length ? abstained / unanswerable.length : 1,
  };

  console.log("\nSummary");
  console.log(`  hit@1   ${pct(result.hitAt1)}`);
  console.log(`  hit@3   ${pct(result.hitAt3)}  (gate >= ${pct(GATES.hitAt3)})`);
  console.log(`  MRR     ${result.mrr.toFixed(3)}`);
  console.log(`  abstain ${pct(result.abstain)}  (gate >= ${pct(GATES.abstain)})`);

  if (result.hitAt3 < GATES.hitAt3 || result.abstain < GATES.abstain) {
    console.error("\nEval gates failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
