import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, type AskResult, type DocInfo } from "./api";

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

/** Turn "[1]" markers in an answer into buttons that jump to the matching source. */
function Answer({ text, onCite }: { text: string; onCite: (n: number) => void }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="answer">
      {parts.map((part, i) => {
        const match = /^\[(\d+)\]$/.exec(part);
        if (!match) return <span key={i}>{part}</span>;
        const n = Number(match[1]);
        return (
          <button key={i} className="cite" onClick={() => onCite(n)} aria-label={`Source ${n}`}>
            {n}
          </button>
        );
      })}
    </p>
  );
}

export function App() {
  const [docs, setDocs] = useState<DocInfo[]>([]);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setDocs(await api.listDocuments());
    } catch (err) {
      setError(messageOf(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await api.addDocument(file.name, await file.text());
      }
      await refresh();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function onDelete(id: string) {
    setError(null);
    try {
      await api.deleteDocument(id);
      setResult(null);
      await refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setError(null);
    setHighlight(null);
    try {
      setResult(await api.ask(question));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setAsking(false);
    }
  }

  function jumpTo(n: number) {
    setHighlight(n);
    document.getElementById(`source-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>DocMind</h1>
        <p className="muted">Ask questions about your own documents.</p>

        <label className="upload">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".txt,.md,.markdown,.csv,.json,.log"
            onChange={(e) => void onUpload(e.target.files)}
          />
          {uploading ? "Uploading…" : "+ Add documents"}
        </label>

        <ul className="doc-list">
          {docs.length === 0 && <li className="muted">No documents yet. Add a .txt or .md file.</li>}
          {docs.map((d) => (
            <li key={d.id}>
              <div>
                <strong>{d.name}</strong>
                <span className="muted">{d.chunks} chunks</span>
              </div>
              <button className="ghost" onClick={() => void onDelete(d.id)} aria-label={`Delete ${d.name}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        <form onSubmit={onAsk} className="ask">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={docs.length ? "Ask something about your documents…" : "Add a document first"}
            disabled={docs.length === 0}
            maxLength={1000}
          />
          <button type="submit" disabled={asking || docs.length === 0 || question.trim().length < 3}>
            {asking ? "Thinking…" : "Ask"}
          </button>
        </form>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        {result && (
          <section>
            <Answer text={result.answer} onCite={jumpTo} />
            <p className="muted small">Answered by {result.model}</p>

            {result.sources.length > 0 && <h2>Sources</h2>}
            {result.sources.map((s) => (
              <article
                key={s.n}
                id={`source-${s.n}`}
                className={`source ${highlight === s.n ? "active" : ""}`}
              >
                <header>
                  <span className="cite static">{s.n}</span>
                  <strong>{s.docName}</strong>
                  <span className="muted small">chunk {s.chunkIndex + 1} · score {s.score.toFixed(2)}</span>
                </header>
                <p>{s.text}</p>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
