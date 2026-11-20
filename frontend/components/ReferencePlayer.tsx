"use client";

import { useEffect, useRef, useState } from "react";

function fmt(sec: number) {
    if (!isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ReferencePlayer({
    onTempo,
    onBeforePlay,
}: {
    onTempo?: (bpm: number) => void;
    onBeforePlay?: () => void;
}) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [playing, setPlaying] = useState(false);
    const [time, setTime] = useState(0);
    const [dur, setDur] = useState(0);
    const [rate, setRate] = useState(1);
    const [vol, setVol] = useState(1);
    const [a, setA] = useState<number | null>(null);
    const [b, setB] = useState<number | null>(null);
    const [loop, setLoop] = useState(false);
    const taps = useRef<number[]>([]);
    const [tapBpm, setTapBpm] = useState<number | null>(null);

    // pitch රැකෙන්න (වේගය වෙනස් කළත් තනුව වෙනස් නොවේ)
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        el.playbackRate = rate;
        el.preservesPitch = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el as any).mozPreservesPitch = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el as any).webkitPreservesPitch = true;
    }, [rate, url]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = vol;
    }, [vol]);

    // A-B loop
    function onTimeUpdate() {
        const el = audioRef.current;
        if (!el) return;
        setTime(el.currentTime);
        if (loop && a !== null && b !== null && b > a && el.currentTime >= b) {
            el.currentTime = a;
        }
    }

    function onFile(f: File | null) {
        if (!f) return;
        if (url) URL.revokeObjectURL(url);
        setUrl(URL.createObjectURL(f));
        setName(f.name);
        setA(null);
        setB(null);
        setLoop(false);
        setPlaying(false);
        setTime(0);
    }

    function toggle() {
        const el = audioRef.current;
        if (!el) return;
        if (el.paused) {
            onBeforePlay?.();
            el.play();
            setPlaying(true);
        } else {
            el.pause();
            setPlaying(false);
        }
    }

    function seek(v: number) {
        if (audioRef.current) audioRef.current.currentTime = v;
        setTime(v);
    }

    function tap() {
        const now = performance.now();
        const arr = taps.current;
        if (arr.length && now - arr[arr.length - 1] > 2000) arr.length = 0;
        arr.push(now);
        if (arr.length > 8) arr.shift();
        if (arr.length >= 3) {
            const gaps = arr.slice(1).map((t, i) => t - arr[i]);
            const avg = gaps.reduce((x, y) => x + y, 0) / gaps.length;
            const bpm = Math.round(60000 / avg);
            setTapBpm(bpm);
        }
    }

    return (
        <section className="bg-neutral-900 rounded-xl p-5 border border-sky-800">
            <h2 className="text-lg font-semibold mb-1">🎧 Reference සිංදුව (ඇහෙන්න පමණයි)</h2>
            <p className="text-sm text-neutral-400 mb-3">
                ඔබේ සිංදුව මෙතනින් ඇහෙමින්, පහළ ඇති බොත්තම් වලින් ඒකට ගැලපෙන ඔබේම music එක හදන්න.
                මේ සිංදුව server එකට යන්නේ නැහැ, final cover එකටත් ඇතුළු වෙන්නේ නැහැ.
            </p>

            <input
                type="file"
                accept=".mp3,.wav,audio/*"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="text-sm mb-3 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-sky-600 file:text-white hover:file:bg-sky-500 file:cursor-pointer"
            />

            {url && (
                <div className="space-y-4">
                    <audio
                        ref={audioRef}
                        src={url}
                        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
                        onTimeUpdate={onTimeUpdate}
                        onEnded={() => setPlaying(false)}
                    />
                    <div className="text-xs text-neutral-500">📄 {name}</div>

                    {/* Play + seek */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggle}
                            className="w-12 h-12 rounded-full bg-sky-600 hover:bg-sky-500 text-xl"
                        >
                            {playing ? "⏸" : "▶"}
                        </button>
                        <div className="flex-1">
                            <input
                                type="range"
                                min={0}
                                max={dur || 0}
                                step={0.1}
                                value={time}
                                onChange={(e) => seek(Number(e.target.value))}
                                className="w-full"
                            />
                            <div className="text-xs text-neutral-400 flex justify-between">
                                <span>{fmt(time)}</span>
                                <span>{fmt(dur)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Speed + Volume */}
                    <div className="flex flex-wrap gap-4 items-center">
                        <div>
                            <div className="text-xs text-neutral-400 mb-1">වේගය (තනුව වෙනස් නොවේ)</div>
                            <div className="flex gap-2">
                                {[0.5, 0.75, 1, 1.25].map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setRate(r)}
                                        className={`px-3 py-1 rounded-lg border text-sm ${rate === r
                                                ? "bg-sky-600 border-white"
                                                : "bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
                                            }`}
                                    >
                                        {r === 0.5 ? "🐢 " : r === 1.25 ? "🐇 " : ""}
                                        {r}x
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 min-w-[140px]">
                            <div className="text-xs text-neutral-400 mb-1">🔊 ශබ්දය</div>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={vol}
                                onChange={(e) => setVol(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* A-B loop */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-neutral-300">🔁 කොටසක් නැවත නැවත:</span>
                        <button
                            onClick={() => setA(time)}
                            className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-sm"
                        >
                            A පටන් ගැනීම {a !== null && `(${fmt(a)})`}
                        </button>
                        <button
                            onClick={() => setB(time)}
                            className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-sm"
                        >
                            B අවසානය {b !== null && `(${fmt(b)})`}
                        </button>
                        <button
                            onClick={() => {
                                if (a !== null && b !== null && b > a) {
                                    setLoop(!loop);
                                    if (!loop) seek(a);
                                }
                            }}
                            className={`px-3 py-1 rounded-lg text-sm ${loop ? "bg-green-600" : "bg-neutral-800 hover:bg-neutral-700 border border-neutral-600"
                                }`}
                        >
                            {loop ? "🔁 Loop ON" : "Loop OFF"}
                        </button>
                        <button
                            onClick={() => {
                                setA(null);
                                setB(null);
                                setLoop(false);
                            }}
                            className="px-3 py-1 rounded-lg text-sm text-neutral-400 hover:text-white"
                        >
                            මකන්න
                        </button>
                    </div>
                </div>
            )}

            {/* Tap tempo */}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-800 pt-4">
                <span className="text-sm text-neutral-300">⏱ සිංදුවේ වේගය (BPM) හොයාගන්න:</span>
                <button
                    onClick={tap}
                    className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium"
                >
                    👆 රිද්මයට Tap කරන්න
                </button>
                {tapBpm && (
                    <>
                        <span className="font-bold">{tapBpm} BPM</span>
                        <button
                            onClick={() => onTempo?.(Math.min(200, Math.max(50, tapBpm)))}
                            className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm"
                        >
                            ✔ මේක පාවිච්චි කරන්න
                        </button>
                    </>
                )}
                <span className="text-xs text-neutral-500 w-full">
                    සිංදුව ඇහෙමින් බීට් එකට අනුව 4-8 වතාවක් බොත්තම ඔබන්න.
                </span>
            </div>
        </section>
    );
}