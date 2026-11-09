import * as Tone from "tone";

export type Instrument = "guitar" | "piano" | "flute" | "strings";
export type ChordItem = { start: number; end: number; chord: string };

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

let synth: Tone.PolySynth | null = null;
let reverb: Tone.Reverb | null = null;
let eventIds: number[] = [];

export function stop() {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    eventIds = [];
    synth?.releaseAll();
    synth?.dispose();
    reverb?.dispose();
    synth = null;
    reverb = null;
}

export async function play(
    chords: ChordItem[],
    tempo: number,
    instrument: Instrument,
    onEnd: () => void,
    originalTempo: number = 136
) {
    await Tone.start();
    stop();

    reverb = new Tone.Reverb({ decay: 2.5, wet: 0.25 }).toDestination();
    synth = makeSynth(instrument);
    synth.volume.value = -8;
    synth.connect(reverb);

    const beat = 60 / tempo;
    // මුල් සිංදුවේ කාලය අනුව නෙවෙයි, tempo අනුව beats 4ක් බැගින් chord එකක් වාදනය කරනවා
    const base = chords[0]?.start ?? 0;


    chords.forEach((c) => {
        const at = ((c.start - base) * originalTempo) / tempo;
        const dur = Math.max(((c.end - c.start) * originalTempo) / tempo, beat);
        const notes = chordNotes(c.chord, instrument === "flute" ? 5 : 3);

        Tone.getTransport().schedule((time) => {
            if (!synth) return;
            if (instrument === "guitar") {
                // Strum: beat එකක් පාසා ගහනවා
                for (let t = 0; t < dur; t += beat) {
                    notes.forEach((n, k) => {
                        synth!.triggerAttackRelease(n, beat * 0.9, time + t + k * 0.02);
                    });
                }
            } else if (instrument === "piano") {
                // Arpeggio
                let i = 0;
                for (let t = 0; t < dur; t += beat / 2) {
                    synth.triggerAttackRelease(notes[i % 3], beat * 0.45, time + t);
                    i++;
                }
            } else {
                // Flute / Strings: දිගු chord
                synth.triggerAttackRelease(notes, dur * 0.98, time);
            }
        }, at);
    });

    const last = chords[chords.length - 1];
    const total = ((last.end - base) * originalTempo) / tempo;
    Tone.getTransport().schedule(() => {
        stop();
        onEnd();
    }, total + 0.5);

    Tone.getTransport().start();
}