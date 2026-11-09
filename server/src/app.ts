import cors from "cors";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { ZodError, z } from "zod";
import { rateLimit } from "./rateLimit";
import { ValidationError, type RagService } from "./rag";
import type { VectorStore } from "./vectorStore";

const ingestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  text: z.string().min(1).max(500_000),
});

const askSchema = z.object({
  question: z.string().trim().min(3).max(1000),
  k: z.number().int().min(1).max(10).optional(),
});

/** Forward rejected promises from async handlers to the error middleware. */
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export interface AppOptions {
  askLimitPerMinute?: number;
}

export function createApp(rag: RagService, store: VectorStore, options: AppOptions = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/documents", (_req, res) => {
    res.json({ documents: store.listDocuments() });
  });

  app.post(
    "/api/documents",
    wrap(async (req, res) => {
      const { name, text } = ingestSchema.parse(req.body);
      const doc = await rag.ingest(name, text);
      res.status(201).json({ document: doc });
    }),
  );

  app.delete("/api/documents/:id", (req, res) => {
    const removed = store.removeDocument(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.status(204).end();
  });

  app.post(
    "/api/ask",
    rateLimit(options.askLimitPerMinute ?? 30, 60_000),
    wrap(async (req, res) => {
      const { question, k } = askSchema.parse(req.body);
      res.json(await rag.ask(question, k));
    }),
  );

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Invalid request", details: err.flatten().fieldErrors });
      return;
    }
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    // Malformed JSON bodies from express.json
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "Malformed JSON" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}
