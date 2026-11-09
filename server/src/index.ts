import { createApp } from "./app";
import { HashEmbedder } from "./embedder";
import { createLLM } from "./llm";
import { RagService } from "./rag";
import { VectorStore } from "./vectorStore";

const port = Number(process.env.PORT ?? 3001);
const store = new VectorStore(process.env.DATA_FILE ?? "data/store.json");
const llm = createLLM(process.env);
const rag = new RagService(new HashEmbedder(), store, llm);

createApp(rag, store).listen(port, () => {
  console.log(`DocMind API on http://localhost:${port} (answers: ${llm.name})`);
});
