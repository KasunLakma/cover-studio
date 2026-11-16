"use client";

import { useEffect, useState } from "react";
import {
  DRUM_PRESETS,
  DRUM_STEPS,
  INSTRUMENTS,
  MELODY_ROWS,
  NOTES,
  PROGRESSIONS,
  STEPS,
  STYLES,
  applyProgression,
  chordLabel,
  defaultProject,
  getPlayhead,
  melodyMidi,
  mixExport,
  previewNote,
  randomMelody,
  resizeProject,
  rowLabel,
  startEngine,
  stopEngine,
  updateProject,
  type Drums,
  type Project,
  type TrackId,
  type TrackSettings,
} from "@/lib/engine";
import { startRecording, stopRecording } from "@/lib/recorder";

const TRACK_INFO: Record<TrackId, { icon: string; name: string; color: string }> = {
  melody: { icon: "🎤", name: "තනුව", color: "border-pink-500 bg-pink-500/10" },
  chords: { icon: "🎼", name: "Chords", color: "border-indigo-500 bg-indigo-500/10" },
  bass: { icon: "🎸", name: "Bass", color: "border-emerald-500 bg-emerald-500/10" },
  drums: { icon: "🥁", name: "Drums", color: "border-orange-500 bg-orange-500/10" },
};

export default function Home() {
  const [p, setP] = useState<Project>(defaultProject());
  const [playing, setPlaying] = useState(false);
  const [head, setHead] = useState<number | null>(null);

  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState("");
  const [vocalUrl, setVocalUrl] = useState<string | null>(null);
  const [vocalBlob, setVocalBlob] = useState<Blob | null>(null);
  const [vocalVol, setVocalVol] = useState(1);
  const [trimMs, setTrimMs] = useState(0);
  const [mixing, setMixing] = useState(false);
  const [mixUrl, setMixUrl] = useState<string | null>(null);
  const [mixError, setMixError] = useState("");

  // ---------- helpers ----------
  const set = (patch: Partial<Project>) => setP((prev) => ({ ...prev, ...patch }));
  const setTrack = (id: TrackId, patch: Partial<TrackSettings>) =>
    setP((prev) => ({ ...prev, tracks: { ...prev.tracks, [id]: { ...prev.tracks[id], ...patch } } }));

  // Play වෙද්දී වෙනස්කම් engine එකට යවනවා
  useEffect(() => {
    if (playing) updateProject(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  // Playhead
  useEffect(() => {
    if (!playing) {
      setHead(null);
      return;
    }
    const id = setInterval(() => setHead(getPlayhead()), 60);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => () => stopEngine(), []);

  // ---------- Play ----------
  async function handlePlay() {
    await startEngine(p);
    setPlaying(true);
  }
  function handleStop() {
    stopEngine();
    setPlaying(false);
  }

  // ---------- Melody ----------
  function clickCell(col: number, row: number) {
    const m = [...p.melody];
    if (m[col] === row) {
      m[col] = -1;
    } else {
      m[col] = row;
      previewNote(melodyMidi(p, row), p.tracks.melody.instrument);
    }
    set({ melody: m });
  }

  // ---------- Drums ----------
  function toggleDrum(row: keyof Drums, step: number) {
    const arr = [...p.drums[row]];
    arr[step] = !arr[step];
    set({ drums: { ...p.drums, [row]: arr } });
  }

  // ---------- Record ----------
  async function handleRecord() {
    setMicError("");
    try {
      await startRecording();
      setRecording(true);
      await handlePlay();
    } catch {
      setMicError("Microphone එකට ප්‍රවේශය ලබාගන්න බැහැ. Browser permission එක Allow කරන්න.");
      setRecording(false);
    }
  }
  async function handleStopRecord() {
    handleStop();
    const blob = await stopRecording();
    setRecording(false);
    setVocalBlob(blob);
    if (vocalUrl) URL.revokeObjectURL(vocalUrl);
    setVocalUrl(URL.createObjectURL(blob));
    setMixUrl(null);
  }

  // ---------- Mix ----------
  async function handleMix() {
    if (!vocalBlob) return;
    setMixing(true);
    setMixError("");
    try {
      const out = await mixExport(p, vocalBlob, vocalVol, trimMs);
      if (mixUrl) URL.revokeObjectURL(mixUrl);
      setMixUrl(URL.createObjectURL(out));
    } catch (e) {
      setMixError(e instanceof Error ? e.message : "Mix අසාර්ථකයි");
    } finally {
      setMixing(false);
    }
  }

  const totalCols = p.bars * STEPS;
  const headCol = head === null ? -1 : Math.floor(head * totalCols);
  const headBar = head === null ? -1 : Math.floor(head * p.bars);
  const headDrum = head === null ? -1 : Math.floor(((head * p.bars) % 1) * DRUM_STEPS);

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <header>
          <h1 className="text-3xl font-bold">🎵 Cover Song Studio</h1>
          <p className="text-neutral-400">
            බොත්තම් වලින් ඔබේම music එක හදන්න. කනට ඇහෙන දේ අනුව තෝරන්න.
          </p>
        </header>

        {/* ================= PLAY BAR ================= */}
        <section className="bg-neutral-900 rounded-xl p-5 sticky top-0 z-20 border border-neutral-800">
          <div className="flex flex-wrap items-center gap-4">
            {!playing ? (
              <button onClick={handlePlay} className="w-14 h-14 rounded-full bg-orange-600 hover:bg-orange-500 text-2xl">
                ▶
              </button>
            ) : (
              <button onClick={handleStop} className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-2xl">
                ⏹
              </button>
            )}

            <div className="flex-1 min-w-[160px]">
              <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500" style={{ width: `${(head ?? 0) * 100}%` }} />
              </div>
              <div className="text-xs text-neutral-400 mt-1">
                {playing ? "වාදනය වෙමින් (නැවත නැවත)... වෙනස්කම් ක්ෂණිකව ඇහෙනවා" : "▶ ඔබලා ඇහෙන්න"}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-neutral-400">Key</div>
              <div className="text-xl font-bold">
                {NOTES[p.keyRoot]} {p.mode === "major" ? "Major" : "Minor"}
              </div>
            </div>
          </div>
        </section>

        {/* ================= 1. SETTINGS ================= */}
        <section className="bg-neutral-900 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">1. මූලික සැකසුම්</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Key */}
            <div>
              <div className="text-sm text-neutral-400 mb-1">ස්වරය (Key)</div>
              <div className="flex gap-2">
                <select
                  value={p.keyRoot}
                  onChange={(e) => set({ keyRoot: Number(e.target.value) })}
                  className="bg-neutral-800 rounded-lg px-3 py-2 flex-1"
                >
                  {NOTES.map((n, i) => (
                    <option key={n} value={i}>
                      {n}
                    </option>
                  ))}
                </select>
                <button onClick={() => set({ keyRoot: (p.keyRoot + 11) % 12 })} className="px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700">
                  🔽
                </button>
                <button onClick={() => set({ keyRoot: (p.keyRoot + 1) % 12 })} className="px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700">
                  🔼
                </button>
              </div>
            </div>

            {/* Mode */}
            <div>
              <div className="text-sm text-neutral-400 mb-1">හැඟීම</div>
              <div className="flex gap-2">
                {(
                  [
                    ["major", "😊 සතුටු"],
                    ["minor", "😢 දුක්බර"],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => set({ mode: m })}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm ${p.mode === m ? "bg-indigo-600 border-white" : "bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tempo */}
            <div>
              <div className="text-sm text-neutral-400 mb-1">වේගය: {p.tempo} BPM</div>
              <div className="flex items-center gap-2">
                <button onClick={() => set({ tempo: Math.max(50, p.tempo - 10) })} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm">
                  🐢
                </button>
                <input
                  type="range"
                  min={50}
                  max={200}
                  value={p.tempo}
                  onChange={(e) => set({ tempo: Number(e.target.value) })}
                  className="flex-1"
                />
                <button onClick={() => set({ tempo: Math.min(200, p.tempo + 10) })} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm">
                  🐇
                </button>
              </div>
            </div>

            {/* Bars */}
            <div>
              <div className="text-sm text-neutral-400 mb-1">දිග (bars)</div>
              <div className="flex gap-2">
                {[4, 8, 16].map((b) => (
                  <button
                    key={b}
                    onClick={() => setP(resizeProject(p, b))}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm ${p.bars === b ? "bg-indigo-600 border-white" : "bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
                      }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================= 2. CHORDS ================= */}
        <section className="bg-neutral-900 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-1">2. Chords (පසුබිම් සංගීතය)</h2>
          <p className="text-sm text-neutral-400 mb-3">
            සරලම ක්‍රමය: පහළ ඇති ක්‍රමයක් එබුවාම chords හැදෙනවා. ඊට පස්සේ bar එකක් බැගින් වෙනස් කරන්න.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {PROGRESSIONS.map((pr) => (
              <button
                key={pr.name}
                onClick={() => set({ chords: applyProgression(pr.degrees, p.bars) })}
                className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-sm"
              >
                {pr.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {p.chords.map((d, i) => (
              <div
                key={i}
                className={`rounded-lg border p-2 ${headBar === i ? "border-orange-400 bg-orange-500/20" : "border-neutral-700 bg-neutral-800"
                  }`}
              >
                <div className="text-xs text-neutral-400 mb-1">Bar {i + 1}</div>
                <select
                  value={d}
                  onChange={(e) => {
                    const c = [...p.chords];
                    c[i] = Number(e.target.value);
                    set({ chords: c });
                  }}
                  className="bg-neutral-700 rounded px-2 py-1 w-full font-bold"
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((deg) => (
                    <option key={deg} value={deg}>
                      {chordLabel(p.mode, p.keyRoot, deg)}
                    </option>
                  ))}
                  <option value={-1}>— (නැහැ)</option>
                </select>
              </div>
            ))}
          </div>
        </section>

        {/* ================= 3. MELODY ================= */}
        <section className="bg-neutral-900 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-1">3. 🎤 තනුව (ඔබේ සිංදුවේ තනුව දාන්න)</h2>
          <p className="text-sm text-neutral-400 mb-3">
            කොටුවක් click කරන්න → ඒ ස්වරය ඇහෙනවා. ඉහළ කොටු = උස ස්වර. එකම පේළියේ කොටු ගණනාවක් එක දිගට
            click කළොත් දිගු ස්වරයක් වෙනවා. ලා පාට කොටු = ඒ bar එකේ chord එකට ගැලපෙන ස්වර.
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => set({ melody: randomMelody(p) })}
              className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-sm font-medium"
            >
              🎲 Random අදහසක් (chords වලට ගැලපෙන)
            </button>
            <button
              onClick={() => set({ melody: Array(totalCols).fill(-1) })}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-sm"
            >
              🗑 සියල්ල මකන්න
            </button>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="inline-block">
              {Array.from({ length: MELODY_ROWS }, (_, i) => MELODY_ROWS - 1 - i).map((row) => (
                <div key={row} className="flex items-center">
                  <div
                    className={`w-10 text-xs text-right pr-2 sticky left-0 bg-neutral-900 ${row % 7 === 0 ? "text-pink-400 font-bold" : "text-neutral-500"
                      }`}
                  >
                    {rowLabel(p, row)}
                  </div>
                  {Array.from({ length: totalCols }, (_, col) => {
                    const on = p.melody[col] === row;
                    const bar = Math.floor(col / STEPS);
                    const d = p.chords[bar];
                    const rel = d < 0 ? -1 : (((row - d) % 7) + 7) % 7;
                    const hint = rel === 0 || rel === 2 || rel === 4;
                    return (
                      <button
                        key={col}
                        onClick={() => clickCell(col, row)}
                        className={`w-7 h-6 border-b border-neutral-900 ${col % STEPS === 0 ? "border-l-2 border-l-neutral-600" : "border-l border-l-neutral-900"
                          } ${on
                            ? "bg-pink-500"
                            : headCol === col
                              ? "bg-orange-500/40"
                              : hint
                                ? "bg-neutral-700 hover:bg-neutral-600"
                                : "bg-neutral-800 hover:bg-neutral-700"
                          }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= 4. DRUMS ================= */}
        <section className="bg-neutral-900 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-3">4. 🥁 Drums (රිද්මය)</h2>

          <div className="flex flex-wrap gap-2 mb-4">
            {DRUM_PRESETS.map((d) => (
              <button
                key={d.name}
                onClick={() => set({ drums: d.drums })}
                className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-sm"
              >
                {d.name}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            {(
              [
                ["kick", "Kick (බූ)"],
                ["snare", "Snare (ටැක්)"],
                ["hat", "Hi-hat (ටික්)"],
              ] as [keyof Drums, string][]
            ).map(([row, label]) => (
              <div key={row} className="flex items-center mb-1">
                <div className="w-28 text-sm text-neutral-300">{label}</div>
                {p.drums[row].map((on, s) => (
                  <button
                    key={s}
                    onClick={() => toggleDrum(row, s)}
                    className={`w-8 h-8 mr-1 rounded ${s % 4 === 0 ? "ml-1" : ""} ${on ? "bg-orange-500" : headDrum === s ? "bg-orange-500/40" : "bg-neutral-800 hover:bg-neutral-700"
                      }`}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ================= 5. MIXER ================= */}
        <section className="bg-neutral-900 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-3">5. Instruments සහ ශබ්ද මට්ටම</h2>
          <div className="space-y-3">
            {(Object.keys(TRACK_INFO) as TrackId[]).map((id) => {
              const info = TRACK_INFO[id];
              const t = p.tracks[id];
              return (
                <div
                  key={id}
                  className={`rounded-xl border p-3 flex flex-wrap items-center gap-3 ${info.color} ${t.muted ? "opacity-50" : ""}`}
                >
                  <div className="w-24 font-semibold">
                    {info.icon} {info.name}
                  </div>

                  {INSTRUMENTS[id].length > 0 && (
                    <select
                      value={t.instrument}
                      onChange={(e) => setTrack(id, { instrument: e.target.value })}
                      className="bg-neutral-800 rounded-lg px-3 py-2 text-sm"
                    >
                      {INSTRUMENTS[id].map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {STYLES[id].length > 0 && (
                    <select
                      value={t.style}
                      onChange={(e) => setTrack(id, { style: e.target.value })}
                      className="bg-neutral-800 rounded-lg px-3 py-2 text-sm"
                    >
                      {STYLES[id].map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                    <span>🔊</span>
                    <input
                      type="range"
                      min={-30}
                      max={0}
                      value={t.volume}
                      onChange={(e) => setTrack(id, { volume: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>

                  <button
                    onClick={() => setTrack(id, { muted: !t.muted })}
                    className={`px-3 py-2 rounded-lg text-sm ${t.muted ? "bg-yellow-600" : "bg-neutral-800 hover:bg-neutral-700"}`}
                  >
                    {t.muted ? "🔈 Unmute" : "🔇 Mute"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================= 6. RECORD ================= */}
        <section className="bg-neutral-900 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-2">6. 🎤 ඔබේ ගායනය Record කරන්න</h2>
          <p className="text-sm text-yellow-400 mb-3">
            🎧 Headphones පළඳින්න! Record ඔබද්දී music එක නැවත නැවත වාදනය වෙනවා. ගායනය ඉවර වුණාම Stop කරන්න.
          </p>

          {!recording ? (
            <button onClick={handleRecord} className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-medium">
              🔴 Record
            </button>
          ) : (
            <button onClick={handleStopRecord} className="px-6 py-2 rounded-lg bg-neutral-600 hover:bg-neutral-500 font-medium animate-pulse">
              ⏹ Stop Recording
            </button>
          )}
          {micError && <p className="mt-3 text-red-400">⚠️ {micError}</p>}

          {vocalUrl && (
            <div className="mt-4">
              <p className="text-sm text-neutral-300 mb-2">ඔබේ record එක:</p>
              <audio controls src={vocalUrl} className="w-full" />
            </div>
          )}
        </section>

        {/* ================= 7. MIX ================= */}
        {vocalBlob && (
          <section className="bg-neutral-900 rounded-xl p-5">
            <h2 className="text-lg font-semibold mb-3">7. 🎚 Mix කරලා Download කරන්න</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-neutral-800 rounded-lg p-4">
                <div className="text-sm text-neutral-400 mb-2">🎤 ඔබේ හඬේ ශබ්දය: {vocalVol.toFixed(1)}</div>
                <input type="range" min={0} max={2} step={0.1} value={vocalVol} onChange={(e) => setVocalVol(Number(e.target.value))} className="w-full" />
              </div>
              <div className="bg-neutral-800 rounded-lg p-4">
                <div className="text-sm text-neutral-400 mb-2">⏲ හඬ music එකට පස්සෙන් නම්, මේක වැඩි කරන්න: {trimMs} ms</div>
                <input type="range" min={0} max={500} step={10} value={trimMs} onChange={(e) => setTrimMs(Number(e.target.value))} className="w-full" />
                <div className="text-xs text-neutral-500 mt-1">(Bluetooth headphones නම් 150-300 අවශ්‍ය වෙයි)</div>
              </div>
            </div>

            <button
              onClick={handleMix}
              disabled={mixing}
              className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 font-medium"
            >
              {mixing ? "Mix කරමින්..." : "🎚 Mix කරන්න"}
            </button>
            {mixError && <p className="mt-3 text-red-400">⚠️ {mixError}</p>}

            {mixUrl && (
              <div className="mt-4">
                <p className="text-sm text-neutral-300 mb-2">අවසන් cover එක:</p>
                <audio controls src={mixUrl} className="w-full" />
                <a href={mixUrl} download="my-cover.wav" className="inline-block mt-3 px-5 py-2 rounded-lg bg-green-600 hover:bg-green-500 font-medium">
                  ⬇ Download (WAV)
                </a>
                <p className="text-xs text-neutral-500 mt-3">
                  ⚖️ මෙහි ඇත්තේ ඔබ හදපු අලුත් music එකයි, මුල් recording එකක් නැහැ. ඒත් තනුව/පද කවරේ
                  අයිතිය තවමත් මුල් ගීත රචකයාට අයිතියි. social media එකට දාන්න කලින් ඒ platform එකේ cover
                  license නීති බලන්න.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}