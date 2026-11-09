import * as Tone from "tone";
import type { ChordItem, Instrument } from "./player";

const NOTE_INDEX: Record<string, number> = {
    C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
    "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function chordNotes(chord: string, octave: number): string[] {
    const root = chord.length > 1 && chord[1] === "#" ? chord.slice(0, 2) : chord[0];
    const minor = chord.slice(root.length) === "m";
    const r = NOTE_INDEX[root];
    const intervals = minor ? [0, 3, 7] : [0, 4, 7];
    return intervals.map((iv) => {
        const n = r + iv;
        return NAMES[n % 12] + (octave + Math.floor(n / 12));
    });
}

function makeSynth(instrument: Instrument): Tone.PolySynth {
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
                envelope: { attack: 0.12, decay: 0.1, sustain: 0.8, release: 0.5 },
            });
        case "strings":
            return new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "sawtooth" },
                envelope: { attack: 0.5, decay: 0.2, sustain: 0.8, release: 1.5 },
            });
    }
}

// Backing track එක audio buffer එකක් ලෙස render කිරීම
async function renderBacking(
    chords: ChordItem[],
    tempo: number,
    originalTempo: number,
    instrument: Instrument,
    musicVolume: number
): Promise<Tone.ToneAudioBuffer> {
    const base = chords[0]?.start ?? 0;
    const last = chords[chords.length - 1];
    const total = ((last.end - base) * originalTempo) / tempo + 2;
    const beat = 60 / tempo;

    return Tone.Offline(async () => {
        const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.25 }).toDestination();
        await reverb.ready;
        const synth = makeSynth(instrument);
        synth.volume.value = musicVolume;
        synth.connect(reverb);

        chords.forEach((c) => {
            const at = ((c.start - base) * originalTempo) / tempo;
            const dur = Math.max(((c.end - c.start) * originalTempo) / tempo, beat);
            const notes = chordNotes(c.chord, instrument === "flute" ? 5 : 3);

            if (instrument === "guitar") {
                for (let t = 0; t < dur; t += beat) {
                    notes.forEach((n, k) => {
                        synth.triggerAttackRelease(n, beat * 0.9, at + t + k * 0.02);
                    });
                }
            } else if (instrument === "piano") {
                let i = 0;
                for (let t = 0; t < dur; t += beat / 2) {
                    synth.triggerAttackRelease(notes[i % 3], beat * 0.45, at + t);
                    i++;
                }
            } else {
                synth.triggerAttackRelease(notes, dur * 0.98, at);
            }
        });
    }, total);
}

// AudioBuffer -> WAV file
function bufferToWav(buffer: AudioBuffer): Blob {
    const numCh = 2;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const dataSize = length * numCh * 2;
    const ab = new ArrayBuffer(44 + dataSize);
    const v = new DataView(ab);

    const writeStr = (o: number, s: string) => {
        for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    v.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, numCh, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * numCh * 2, true);
    v.setUint16(32, numCh * 2, true);
    v.setUint16(34, 16, true);
    writeStr(36, "data");
    v.setUint32(40, dataSize, true);

    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    let offset = 44;
    for (let i = 0; i < length; i++) {
        for (const ch of [left, right]) {
            const s = Math.max(-1, Math.min(1, ch[i]));
            v.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            offset += 2;
        }
    }
    return new Blob([ab], { type: "audio/wav" });
}

export async function mixAndExport(opts: {
    chords: ChordItem[];
    tempo: number;
    originalTempo: number;
    instrument: Instrument;
    vocalBlob: Blob;
    vocalVolume: number; // 0 - 2
    musicVolume: number; // dB
    vocalOffsetMs: number;
}): Promise<Blob> {
    const backing = await renderBacking(
        opts.chords,
        opts.tempo,
        opts.originalTempo,
        opts.instrument,
        opts.musicVolume
    );

    const ctx = new AudioContext();
    const vocalBuf = await ctx.decodeAudioData(await opts.vocalBlob.arrayBuffer());
    const backBuf = backing.get() as AudioBuffer;
    const sr = backBuf.sampleRate;

    const offsetSamples = Math.max(0, Math.round((opts.vocalOffsetMs / 1000) * sr));
    const vocalLen = Math.round(vocalBuf.duration * sr) + offsetSamples;
    const totalLen = Math.max(backBuf.length, vocalLen);

    const offline = new OfflineAudioContext(2, totalLen, sr);

    const b = offline.createBufferSource();
    b.buffer = backBuf;
    b.connect(offline.destination);
    b.start(0);

    const v = offline.createBufferSource();
    v.buffer = vocalBuf;
    const gain = offline.createGain();
    gain.gain.value = opts.vocalVolume;
    v.connect(gain).connect(offline.destination);
    v.start(offsetSamples / sr);

    const rendered = await offline.startRendering();
    await ctx.close();
    return bufferToWav(rendered);
}