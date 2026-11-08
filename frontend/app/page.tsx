"use client";

import { useState } from "react";

const API_URL = "http://127.0.0.1:8000";

type Chord = { start: number; end: number; chord: string };
type Analysis = {
  tempo: number;
  key: string;
  duration: number;
  chords: Chord[];
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Analysis අසාර්ථකයි");
      }

      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "නොදන්නා දෝෂයක්");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🎵 Cover Song Studio</h1>
        <p className="text-neutral-400 mb-8">
          සිංදුවක් upload කරන්න. Chords, tempo සහ key හඳුනාගනිමු.
        </p>

        {/* ---------- 1. Upload ---------- */}
        <section className="bg-neutral-900 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">1. Upload</h2>

          <input
            type="file"
            accept=".mp3,.wav,audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm mb-4 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer"
          />

          <button
            onClick={handleAnalyze}
            disabled={!file || loading}
            className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "විශ්ලේෂණය කරමින්... (තත්පර 20-60)" : "🔍 Analyze"}
          </button>

          {error && <p className="mt-4 text-red-400">⚠️ {error}</p>}
        </section>

        {/* ---------- 2. Result ---------- */}
        {result && (
          <section className="bg-neutral-900 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">2. ප්‍රතිඵලය</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-neutral-800 rounded-lg p-4 text-center">
                <div className="text-neutral-400 text-sm">Tempo</div>
                <div className="text-2xl font-bold">{result.tempo} BPM</div>
              </div>
              <div className="bg-neutral-800 rounded-lg p-4 text-center">
                <div className="text-neutral-400 text-sm">Key</div>
                <div className="text-2xl font-bold">{result.key}</div>
              </div>
              <div className="bg-neutral-800 rounded-lg p-4 text-center">
                <div className="text-neutral-400 text-sm">කාලය</div>
                <div className="text-2xl font-bold">
                  {Math.floor(result.duration / 60)}:
                  {String(Math.round(result.duration % 60)).padStart(2, "0")}
                </div>
              </div>
            </div>

            <h3 className="font-semibold mb-3">
              Chords ({result.chords.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {result.chords.map((c, i) => (
                <div
                  key={i}
                  className="bg-indigo-600/20 border border-indigo-500 rounded-lg px-3 py-2 text-center"
                >
                  <div className="font-bold">{c.chord}</div>
                  <div className="text-xs text-neutral-400">
                    {c.start.toFixed(1)}s
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}