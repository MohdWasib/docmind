export interface DocInfo {
  id: string;
  name: string;
  chunks: number;
  addedAt: string;
}

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  listDocuments: () => request<{ documents: DocInfo[] }>("/api/documents").then((r) => r.documents),

  addDocument: (name: string, text: string) =>
    request<{ document: DocInfo }>("/api/documents", {
      method: "POST",
      body: JSON.stringify({ name, text }),
    }).then((r) => r.document),

  deleteDocument: (id: string) => request<void>(`/api/documents/${id}`, { method: "DELETE" }),

  ask: (question: string) =>
    request<AskResult>("/api/ask", { method: "POST", body: JSON.stringify({ question }) }),
};
