"use client";

import { useState } from "react";
import { play, stop, Instrument } from "@/lib/player";
import { startRecording, stopRecording } from "@/lib/recorder";

const API_URL = "http://127.0.0.1:8000";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ALL_CHORDS = NOTES.flatMap((n) => [n, n + "m"]);

type Chord = { start: number; end: number; chord: string };
type Analysis = {
  tempo: number;
  key: string;
  duration: number;
  chords: Chord[];
};

function transposeChord(chord: string, steps: number) {
  const root = chord.length > 1 && chord[1] === "#" ? chord.slice(0, 2) : chord[0];
  const quality = chord.slice(root.length);
  const idx = NOTES.indexOf(root);
  if (idx === -1) return chord;
  return NOTES[(((idx + steps) % 12) + 12) % 12] + quality;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [key, setKey] = useState("");
  const [duration, setDuration] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [chords, setChords] = useState<Chord[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [instrument, setInstrument] = useState<Instrument>("guitar");
  const [playing, setPlaying] = useState(false);
  const [originalTempo, setOriginalTempo] = useState(120);
  const [recording, setRecording] = useState(false);
  const [vocalUrl, setVocalUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState("");

  async function handleAnalyze() {
    if (!file) return;
    setLoading(true);
    setError("");
    setSelected(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/analyze`, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Analysis අසාර්ථකයි");
      }
      const data: Analysis = await res.json();
      setTempo(data.tempo);
      setOriginalTempo(data.tempo);
      setKey(data.key);
      setDuration(data.duration);
      setChords(data.chords);
    } catch (e) {
      setError(e instanceof Error ? e.message : "නොදන්නා දෝෂයක්");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Chord editing ----------
  function changeChord(i: number, newChord: string) {
    setChords(chords.map((c, idx) => (idx === i ? { ...c, chord: newChord } : c)));
  }

  function deleteChord(i: number) {
    setChords(chords.filter((_, idx) => idx !== i));
    setSelected(null);
  }

  function addChordAfter(i: number) {
    const base = chords[i];
    const mid = (base.start + base.end) / 2;
    const first = { ...base, end: mid };
    const second = { start: mid, end: base.end, chord: base.chord };
    const next = [...chords.slice(0, i), first, second, ...chords.slice(i + 1)];
    setChords(next);
    setSelected(i + 1);
  }

  function transposeAll(steps: number) {
    setChords(chords.map((c) => ({ ...c, chord: transposeChord(c.chord, steps) })));
    if (key) {
      const [root, mode] = key.split(" ");
      setKey(`${transposeChord(root, steps)} ${mode}`);
    }
  }

  const hasChords = chords.length > 0;
  async function handlePlay() {
    setPlaying(true);
    await play(chords, tempo, instrument, () => setPlaying(false));
  }

  function handleStop() {
    stop();
    setPlaying(false);
  }
  async function handleRecord() {
    setMicError("");
    try {
      await startRecording();
      setRecording(true);
      // backing track එකත් එකවර ආරම්භ කරනවා
      setPlaying(true);
      await play(chords, tempo, instrument, () => setPlaying(false));
    } catch {
      setMicError("Microphone එකට ප්‍රවේශය ලබාගන්න බැහැ. Browser permission එක Allow කරන්න.");
      setRecording(false);
    }
  }

  async function handleStopRecord() {
    stop();
    setPlaying(false);
    const blob = await stopRecording();
    setRecording(false);
    if (vocalUrl) URL.revokeObjectURL(vocalUrl);
    setVocalUrl(URL.createObjectURL(blob));
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🎵 Cover Song Studio</h1>
        <p className="text-neutral-400 mb-8">
          සිංදුවක් upload කරන්න, chords නිවැරදි කරන්න.
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

        {/* ---------- 2. Chord Editor ---------- */}
        {hasChords && (
          <section className="bg-neutral-900 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">2. Chord Editor</h2>

            {/* Tempo / Key / Transpose */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-neutral-800 rounded-lg p-4">
                <div className="text-neutral-400 text-sm mb-2">Tempo: {tempo} BPM</div>
                <input
                  type="range"
                  min={60}
                  max={200}
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="bg-neutral-800 rounded-lg p-4 text-center">
                <div className="text-neutral-400 text-sm">Key</div>
                <div className="text-2xl font-bold">{key}</div>
              </div>

              <div className="bg-neutral-800 rounded-lg p-4 text-center">
                <div className="text-neutral-400 text-sm mb-2">Transpose</div>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => transposeAll(-1)}
                    className="w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xl font-bold"
                  >
                    −
                  </button>
                  <button
                    onClick={() => transposeAll(1)}
                    className="w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xl font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <p className="text-sm text-neutral-400 mb-3">
              Chord එකක් click කරලා edit කරන්න. ({chords.length} chords, {Math.floor(duration / 60)}:
              {String(Math.round(duration % 60)).padStart(2, "0")})
            </p>

            {/* Chord grid */}
            <div className="flex flex-wrap gap-2 mb-6">
              {chords.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`rounded-lg px-3 py-2 text-center border transition ${selected === i
                    ? "bg-indigo-500 border-white"
                    : "bg-indigo-600/20 border-indigo-500 hover:bg-indigo-600/40"
                    }`}
                >
                  <div className="font-bold">{c.chord}</div>
                  <div className="text-xs text-neutral-300">{c.start.toFixed(1)}s</div>
                </button>
              ))}
            </div>

            {/* Selected chord panel */}
            {selected !== null && chords[selected] && (
              <div className="bg-neutral-800 rounded-lg p-4 flex flex-wrap items-center gap-3">
                <span className="text-neutral-300">
                  තෝරාගත් chord (#{selected + 1}):
                </span>
                <select
                  value={chords[selected].chord}
                  onChange={(e) => changeChord(selected, e.target.value)}
                  className="bg-neutral-700 rounded-lg px-3 py-2"
                >
                  {ALL_CHORDS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => addChordAfter(selected)}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500"
                >
                  ➕ Add
                </button>
                <button
                  onClick={() => deleteChord(selected)}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500"
                >
                  🗑 Delete
                </button>
              </div>
            )}
            {/* ---------- Music ---------- */}
            <div className="mt-8 border-t border-neutral-700 pt-6">
              <h2 className="text-xl font-semibold mb-4">3. Music</h2>

              <div className="flex flex-wrap gap-2 mb-4">
                {(
                  [
                    ["guitar", "🎸 Guitar"],
                    ["piano", "🎹 Piano"],
                    ["flute", "🪈 Flute"],
                    ["strings", "🎻 Strings"],
                  ] as [Instrument, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setInstrument(id)}
                    className={`px-4 py-2 rounded-lg border ${instrument === id
                      ? "bg-indigo-600 border-white"
                      : "bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                {!playing ? (
                  <button
                    onClick={handlePlay}
                    className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 font-medium"
                  >
                    ▶ Play
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-medium"
                  >
                    ⏹ Stop
                  </button>
                )}
              </div>
            </div>
            {/* ---------- Record ---------- */}
            <div className="mt-8 border-t border-neutral-700 pt-6">
              <h2 className="text-xl font-semibold mb-2">4. Record</h2>
              <p className="text-sm text-yellow-400 mb-4">
                🎧 Headphones පළඳින්න! (නැත්නම් backing track එක mic එකට ඇතුල් වේ)
              </p>

              <div className="flex flex-wrap gap-3 mb-4">
                {!recording ? (
                  <button
                    onClick={handleRecord}
                    className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-medium"
                  >
                    🔴 Record
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecord}
                    className="px-6 py-2 rounded-lg bg-neutral-600 hover:bg-neutral-500 font-medium animate-pulse"
                  >
                    ⏹ Stop Recording
                  </button>
                )}
              </div>

              {micError && <p className="text-red-400 mb-3">⚠️ {micError}</p>}

              {vocalUrl && (
                <div>
                  <p className="text-sm text-neutral-300 mb-2">ඔබේ record එක:</p>
                  <audio controls src={vocalUrl} className="w-full" />
                  <a
                    href={vocalUrl}
                    download="my-vocals.webm"
                    className="inline-block mt-3 text-indigo-400 hover:text-indigo-300 underline"
                  >
                    ⬇ Vocals download කරන්න
                  </a>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}