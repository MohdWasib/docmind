import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, type AppOptions } from "../src/app";
import { HashEmbedder } from "../src/embedder";
import { ExtractiveLLM } from "../src/llm";
import { NO_ANSWER, RagService } from "../src/rag";
import { VectorStore } from "../src/vectorStore";

const servers: Server[] = [];

function start(options?: AppOptions) {
  const store = new VectorStore();
  const rag = new RagService(new HashEmbedder(), store, new ExtractiveLLM());
  const server = createApp(rag, store, options).listen(0);
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
  };
  return { call };
}

afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

const CACHING_DOC =
  "An ETag is a fingerprint of a response body. When the content has not changed, " +
  "the server replies with status 304 Not Modified and no body, saving bandwidth.";

describe("API", () => {
  it("reports health", async () => {
    const { call } = start();
    expect((await call("GET", "/api/health")).json).toEqual({ ok: true });
  });

  it("ingests a document and answers with cited sources", async () => {
    const { call } = start();

    const created = await call("POST", "/api/documents", { name: "caching.md", text: CACHING_DOC });
    expect(created.status).toBe(201);
    expect(created.json.document.name).toBe("caching.md");

    const asked = await call("POST", "/api/ask", { question: "What does a 304 Not Modified response mean?" });
    expect(asked.status).toBe(200);
    expect(asked.json.sources.length).toBeGreaterThan(0);
    expect(asked.json.sources[0].docName).toBe("caching.md");
    expect(asked.json.answer).toMatch(/\[1\]/);
  });

  it("refuses to answer when nothing relevant is retrieved", async () => {
    const { call } = start();
    await call("POST", "/api/documents", { name: "caching.md", text: CACHING_DOC });

    const asked = await call("POST", "/api/ask", { question: "Explain quantum chromodynamics lattice gauge theory" });
    expect(asked.status).toBe(200);
    expect(asked.json.answer).toBe(NO_ANSWER);
    expect(asked.json.sources).toEqual([]);
  });

  it("replaces a document when the same name is uploaded again", async () => {
    const { call } = start();
    await call("POST", "/api/documents", { name: "notes.md", text: "First version of the notes." });
    await call("POST", "/api/documents", { name: "notes.md", text: "Second version of the notes." });

    const list = await call("GET", "/api/documents");
    expect(list.json.documents).toHaveLength(1);
  });

  it("deletes documents and returns 404 for unknown ids", async () => {
    const { call } = start();
    const created = await call("POST", "/api/documents", { name: "a.md", text: CACHING_DOC });

    expect((await call("DELETE", `/api/documents/${created.json.document.id}`)).status).toBe(204);
    expect((await call("GET", "/api/documents")).json.documents).toEqual([]);
    expect((await call("DELETE", "/api/documents/nope")).status).toBe(404);
  });

  it("validates input", async () => {
    const { call } = start();
    expect((await call("POST", "/api/documents", { text: "no name" })).status).toBe(400);
    expect((await call("POST", "/api/documents", { name: "blank.md", text: "   " })).status).toBe(400);
    expect((await call("POST", "/api/ask", { question: "hi" })).status).toBe(400);
    expect((await call("POST", "/api/ask", { question: "valid question", k: 99 })).status).toBe(400);
  });

  it("rate limits /api/ask with a Retry-After header", async () => {
    const { call } = start({ askLimitPerMinute: 2 });
    await call("POST", "/api/documents", { name: "a.md", text: CACHING_DOC });

    expect((await call("POST", "/api/ask", { question: "what is an etag" })).status).toBe(200);
    expect((await call("POST", "/api/ask", { question: "what is an etag" })).status).toBe(200);

    const limited = await call("POST", "/api/ask", { question: "what is an etag" });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
