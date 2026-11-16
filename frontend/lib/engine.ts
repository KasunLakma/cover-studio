import * as Tone from "tone";

// ================= Types =================
export type Mode = "major" | "minor";
export type TrackId = "melody" | "chords" | "bass" | "drums";
export type TrackSettings = {
    instrument: string;
    style: string;
    volume: number; // dB
    muted: boolean;
};
export type Drums = { kick: boolean[]; snare: boolean[]; hat: boolean[] };
export type Project = {
    bars: number;
    tempo: number;
    keyRoot: number; // 0=C ... 11=B
    mode: Mode;
    chords: number[]; // bar එකකට scale degree (0-6), -1 = නැහැ
    melody: number[]; // 8th-note step එකකට row (0-13), -1 = නැහැ
    drums: Drums; // 16 steps (එක bar එකක්, නැවත නැවත)
    tracks: Record<TrackId, TrackSettings>;
};

// ================= Constants =================
export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES: Record<Mode, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
};
export const MELODY_ROWS = 14;
export const STEPS = 8; // melody steps per bar
export const DRUM_STEPS = 16;

export const INSTRUMENTS: Record<TrackId, { id: string; label: string }[]> = {
    melody: [
        { id: "piano", label: "🎹 Piano" },
        { id: "flute", label: "🪈 Flute" },
        { id: "guitar", label: "🎸 Guitar" },
        { id: "strings", label: "🎻 Strings" },
        { id: "bell", label: "🔔 Bell" },
    ],
    chords: [
        { id: "guitar", label: "🎸 Guitar" },
        { id: "piano", label: "🎹 Piano" },
        { id: "strings", label: "🎻 Strings" },
    ],
    bass: [
        { id: "bass", label: "🎸 Bass" },
        { id: "synthbass", label: "🎛 Synth Bass" },
    ],
    drums: [],
};

export const STYLES: Record<TrackId, { id: string; label: string }[]> = {
    melody: [],
    chords: [
        { id: "strum", label: "Strum (බෙර ගහනවා වගේ)" },
        { id: "arpeggio", label: "Arpeggio (ස්වර එකින් එක)" },
        { id: "pad", label: "Pad (දිගු)" },
    ],
    bass: [
        { id: "whole", label: "දිගු (bar එකට එකක්)" },
        { id: "half", label: "Half (2ක්)" },
        { id: "quarter", label: "Steady (4ක්)" },
        { id: "driving", label: "Driving (8ක්)" },
    ],
    drums: [],
};

export const PROGRESSIONS: { name: string; degrees: number[] }[] = [
    { name: "ප්‍රසිද්ධ Pop (I V vi IV)", degrees: [0, 4, 5, 3] },
    { name: "හැඟීම්බර (vi IV I V)", degrees: [5, 3, 0, 4] },
    { name: "දුක්බර (i VI III VII)", degrees: [0, 5, 2, 6] },
    { name: "සරල (I IV V IV)", degrees: [0, 3, 4, 3] },
    { name: "ළඟම (I vi IV V)", degrees: [0, 5, 3, 4] },
];

function pat(s: string): boolean[] {
    return s.split("").map((c) => c === "x");
}
export const DRUM_PRESETS: { name: string; drums: Drums }[] = [
    {
        name: "Pop",
        drums: { kick: pat("x.......x.x....."), snare: pat("....x.......x..."), hat: pat("x.x.x.x.x.x.x.x.") },
    },
    {
        name: "Slow",
        drums: { kick: pat("x.........x....."), snare: pat("........x......."), hat: pat("x...x...x...x...") },
    },
    {
        name: "Rock",
        drums: { kick: pat("x.....x.x.....x."), snare: pat("....x.......x..."), hat: pat("xxxxxxxxxxxxxxxx") },
    },
    {
        name: "හිස්",
        drums: { kick: pat("................"), snare: pat("................"), hat: pat("................") },
    },
];

// ================= Music helpers =================
export function scaleNote(mode: Mode, deg: number, base: number) {
    const sc = SCALES[mode];
    const o = Math.floor(deg / 7);
    const i = ((deg % 7) + 7) % 7;
    return base + sc[i] + 12 * o;
}

export function chordLabel(mode: Mode, keyRoot: number, deg: number) {
    const root = scaleNote(mode, deg, 0);
    const third = scaleNote(mode, deg + 2, 0) - root;
    const fifth = scaleNote(mode, deg + 4, 0) - root;
    const name = NOTES[(keyRoot + root) % 12];
    if (third === 3 && fifth === 7) return name + "m";
    if (third === 3 && fifth === 6) return name + "dim";
    return name;
}

export function rowLabel(p: Project, row: number) {
    return NOTES[scaleNote(p.mode, row, p.keyRoot) % 12];
}

export function melodyMidi(p: Project, row: number) {
    return scaleNote(p.mode, row, 55 + p.keyRoot);
}

const midiName = (m: number) => Tone.Frequency(m, "midi").toNote();

export function applyProgression(degrees: number[], bars: number) {
    return Array.from({ length: bars }, (_, i) => degrees[i % degrees.length]);
}

export function defaultProject(): Project {
    return {
        bars: 8,
        tempo: 100,
        keyRoot: 2,
        mode: "minor",
        chords: applyProgression([0, 5, 2, 6], 8),
        melody: Array(8 * STEPS).fill(-1),
        drums: DRUM_PRESETS[0].drums,
        tracks: {
            melody: { instrument: "piano", style: "", volume: -6, muted: false },
            chords: { instrument: "guitar", style: "strum", volume: -10, muted: false },
            bass: { instrument: "bass", style: "half", volume: -8, muted: false },
            drums: { instrument: "", style: "", volume: -14, muted: false },
        },
    };
}

export function resizeProject(p: Project, bars: number): Project {
    const chords = Array.from({ length: bars }, (_, i) => (i < p.chords.length ? p.chords[i] : p.chords[i % p.chords.length] ?? 0));
    const melody = Array.from({ length: bars * STEPS }, (_, i) => (i < p.melody.length ? p.melody[i] : -1));
    return { ...p, bars, chords, melody };
}

/** Chords වලට ගැලපෙන random තනුවක් */
export function randomMelody(p: Project): number[] {
    const out: number[] = [];
    let prev = 7;
    for (let c = 0; c < p.bars * STEPS; c++) {
        const bar = Math.floor(c / STEPS);
        const d = p.chords[bar] < 0 ? 0 : p.chords[bar];
        const strong = c % 2 === 0;
        if (Math.random() < (strong ? 0.85 : 0.45)) {
            const cands: number[] = [];
            for (let r = 0; r < MELODY_ROWS; r++) {
                const rel = (((r - d) % 7) + 7) % 7;
                if (strong ? rel === 0 || rel === 2 || rel === 4 : true) cands.push(r);
            }
            cands.sort((a, b) => Math.abs(a - prev) + Math.random() * 2 - (Math.abs(b - prev) + Math.random() * 2));
            const pick = cands[0];
            prev = pick;
            out.push(pick);
        } else {
            out.push(-1);
        }
    }
    return out;
}

// ================= Synths =================
function createSynth(instrument: string): Tone.PolySynth {
    switch (instrument) {
        case "guitar":
            return new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "fmtriangle" },
                envelope: { attack: 0.002, decay: 0.35, sustain: 0.05, release: 0.6 },
            });
        case "piano":
            return new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 0.005, decay: 0.4, sustain: 0.2, release: 1.2 },
            });
        case "flute":
            return new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sine" },
                envelope: { attack: 0.08, decay: 0.1, sustain: 0.8, release: 0.4 },
            });
        case "strings":
            return new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sawtooth" },
                envelope: { attack: 0.4, decay: 0.2, sustain: 0.8, release: 1.2 },
            });
        case "bell":
            return new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "fmsine" },
                envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1.2 },
            });
        case "bass":
            return new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 },
            });
        case "synthbass":
            return new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "square" },
                envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 },
            });
        default:
            return new Tone.PolySynth(Tone.Synth);
    }
}

type Rig = {
    vols: Record<TrackId, Tone.Volume>;
    melody: Tone.PolySynth;
    chords: Tone.PolySynth;
    bass: Tone.PolySynth;
    kick: Tone.MembraneSynth;
    snare: Tone.NoiseSynth;
    hat: Tone.NoiseSynth;
    all: Tone.ToneAudioNode[];
};

async function buildRig(p: Project): Promise<Rig> {
    const reverb = new Tone.Reverb({ decay: 2, wet: 0.18 }).toDestination();
    await reverb.ready;

    const mk = (t: TrackId) => {
        const v = new Tone.Volume(p.tracks[t].volume);
        v.mute = p.tracks[t].muted;
        v.connect(reverb);
        return v;
    };
    const vols = { melody: mk("melody"), chords: mk("chords"), bass: mk("bass"), drums: mk("drums") };

    const melody = createSynth(p.tracks.melody.instrument).connect(vols.melody);
    const chords = createSynth(p.tracks.chords.instrument).connect(vols.chords);
    const bass = createSynth(p.tracks.bass.instrument).connect(vols.bass);

    const kick = new Tone.MembraneSynth().connect(vols.drums);
    const snare = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
    }).connect(vols.drums);
    const hatFilter = new Tone.Filter(7000, "highpass").connect(vols.drums);
    const hat = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    }).connect(hatFilter);

    return {
        vols,
        melody,
        chords,
        bass,
        kick,
        snare,
        hat,
        all: [melody, chords, bass, kick, snare, hat, hatFilter, vols.melody, vols.chords, vols.bass, vols.drums, reverb],
    };
}

export function passDur(p: Project) {
    return (60 / p.tempo) * 4 * p.bars;
}

function schedulePass(p: Project, r: Rig, t0: number) {
    const beat = 60 / p.tempo;
    const eighth = beat / 2;
    const six = beat / 4;
    const bar = beat * 4;

    for (let b = 0; b < p.bars; b++) {
        const tb = t0 + b * bar;
        const d = p.chords[b];

        if (d >= 0) {
            // ----- Chords -----
            const names = [0, 2, 4].map((i) => midiName(scaleNote(p.mode, d + i, 48 + p.keyRoot)));
            const cs = p.tracks.chords.style;
            if (cs === "pad") {
                r.chords.triggerAttackRelease(names, bar * 0.98, tb);
            } else if (cs === "arpeggio") {
                const order = [0, 1, 2, 1];
                for (let i = 0; i < 8; i++) {
                    r.chords.triggerAttackRelease(names[order[i % 4]], eighth * 1.5, tb + i * eighth);
                }
            } else {
                for (let i = 0; i < 4; i++) {
                    names.forEach((n, k) => r.chords.triggerAttackRelease(n, beat * 0.9, tb + i * beat + k * 0.015));
                }
            }

            // ----- Bass -----
            const root = midiName(scaleNote(p.mode, d, 36 + p.keyRoot));
            const bs = p.tracks.bass.style;
            if (bs === "whole") {
                r.bass.triggerAttackRelease(root, bar * 0.95, tb);
            } else if (bs === "half") {
                [0, 4].forEach((s) => r.bass.triggerAttackRelease(root, eighth * 3.5, tb + s * eighth));
            } else if (bs === "quarter") {
                for (let i = 0; i < 4; i++) r.bass.triggerAttackRelease(root, beat * 0.9, tb + i * beat);
            } else {
                for (let i = 0; i < 8; i++) r.bass.triggerAttackRelease(root, eighth * 0.85, tb + i * eighth);
            }
        }

        // ----- Drums -----
        for (let s = 0; s < DRUM_STEPS; s++) {
            const t = tb + s * six;
            if (p.drums.kick[s]) r.kick.triggerAttackRelease("C1", 0.15, t);
            if (p.drums.snare[s]) r.snare.triggerAttackRelease(0.12, t);
            if (p.drums.hat[s]) r.hat.triggerAttackRelease(0.04, t, 0.5);
        }
    }

    // ----- Melody (එක row එකක් දිගටම තිබුණොත් දිගු note එකක්) -----
    const total = p.bars * STEPS;
    for (let c = 0; c < total; c++) {
        const row = p.melody[c];
        if (row < 0) continue;
        if (c > 0 && p.melody[c - 1] === row) continue;
        let len = 1;
        while (c + len < total && p.melody[c + len] === row) len++;
        r.melody.triggerAttackRelease(midiName(melodyMidi(p, row)), len * eighth * 0.95, t0 + c * eighth);
    }
}

// ================= Realtime engine =================
type Cur = {
    rig: Rig;
    p: Project;
    sig: string;
    next: number;
    passes: { start: number; dur: number }[];
};
let cur: Cur | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

const sigOf = (p: Project) =>
    [p.tracks.melody.instrument, p.tracks.chords.instrument, p.tracks.bass.instrument].join("|");

function pump() {
    if (!cur) return;
    const now = Tone.now();
    while (cur.next - now < 0.8) {
        const dur = passDur(cur.p);
        schedulePass(cur.p, cur.rig, cur.next);
        cur.passes.push({ start: cur.next, dur });
        cur.next += dur;
    }
    cur.passes = cur.passes.filter((x) => x.start + x.dur > now - 1);
}

export function stopEngine() {
    if (timer) clearInterval(timer);
    timer = null;
    if (cur) {
        cur.rig.all.forEach((n) => {
            try {
                n.dispose();
            } catch { }
        });
    }
    cur = null;
}

export async function startEngine(p: Project) {
    await Tone.start();
    stopEngine();
    const rig = await buildRig(p);
    cur = { rig, p, sig: sigOf(p), next: Tone.now() + 0.2, passes: [] };
    pump();
    timer = setInterval(pump, 100);
}

/** Play වෙද්දී වෙනස්කම් ක්ෂණිකව යෙදීම */
export async function updateProject(p: Project) {
    if (!cur) return;
    if (sigOf(p) !== cur.sig) {
        await startEngine(p);
        return;
    }
    cur.p = p;
    (Object.keys(cur.rig.vols) as TrackId[]).forEach((t) => {
        cur!.rig.vols[t].volume.value = p.tracks[t].volume;
        cur!.rig.vols[t].mute = p.tracks[t].muted;
    });
}

/** 0..1 : වර්තමාන loop එකේ කොතැනද */
export function getPlayhead(): number | null {
    if (!cur) return null;
    const now = Tone.now();
    const x = cur.passes.find((q) => q.start <= now && now < q.start + q.dur);
    return x ? (now - x.start) / x.dur : null;
}

// ================= Preview (කොටුවක් click කරද්දී) =================
let prev: Tone.PolySynth | null = null;
export async function previewNote(midi: number, instrument: string) {
    await Tone.start();
    try {
        prev?.dispose();
    } catch { }
    prev = createSynth(instrument).toDestination();
    prev.volume.value = -6;
    prev.triggerAttackRelease(midiName(midi), 0.35);
}

// ================= Offline render + Mix =================
async function renderBacking(p: Project, passes: number): Promise<AudioBuffer> {
    const pd = passDur(p);
    const buf = await Tone.Offline(async () => {
        const rig = await buildRig(p);
        for (let i = 0; i < passes; i++) schedulePass(p, rig, i * pd);
    }, passes * pd + 2);
    return buf.get() as AudioBuffer;
}

function bufferToWav(buffer: AudioBuffer): Blob {
    const numCh = 2;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const dataSize = length * numCh * 2;
    const ab = new ArrayBuffer(44 + dataSize);
    const v = new DataView(ab);
    const w = (o: number, s: string) => {
        for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    w(0, "RIFF");
    v.setUint32(4, 36 + dataSize, true);
    w(8, "WAVE");
    w(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, numCh, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * numCh * 2, true);
    v.setUint16(32, numCh * 2, true);
    v.setUint16(34, 16, true);
    w(36, "data");
    v.setUint32(40, dataSize, true);
    const L = buffer.getChannelData(0);
    const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
    let off = 44;
    for (let i = 0; i < length; i++) {
        for (const ch of [L, R]) {
            const s = Math.max(-1, Math.min(1, ch[i]));
            v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            off += 2;
        }
    }
    return new Blob([ab], { type: "audio/wav" });
}

export async function mixExport(p: Project, vocalBlob: Blob, vocalVolume: number, trimMs: number): Promise<Blob> {
    const ctx = new AudioContext();
    const vocal = await ctx.decodeAudioData(await vocalBlob.arrayBuffer());
    await ctx.close();

    const trim = trimMs / 1000;
    const vocalLen = Math.max(0.1, vocal.duration - trim);
    const passes = Math.max(1, Math.ceil(vocalLen / passDur(p)));
    const back = await renderBacking(p, passes);

    const sr = back.sampleRate;
    const total = Math.max(back.length, Math.ceil(vocalLen * sr));
    const off = new OfflineAudioContext(2, total, sr);

    const b = off.createBufferSource();
    b.buffer = back;
    b.connect(off.destination);
    b.start(0);

    const v = off.createBufferSource();
    v.buffer = vocal;
    const g = off.createGain();
    g.gain.value = vocalVolume;
    v.connect(g);
    g.connect(off.destination);
    v.start(0, trim);

    return bufferToWav(await off.startRendering());
}