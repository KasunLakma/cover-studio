import pretty_midi

NOTE_INDEX = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
}

# General MIDI instrument numbers
PROGRAMS = {
    'guitar': 25,   # Acoustic Guitar (steel)
    'piano': 0,     # Acoustic Grand Piano
}


def _parse_chord(name: str):
    """'Dm' -> (root=2, tones=[0, 3, 7])"""
    if len(name) > 1 and name[1] == '#':
        root, quality = name[:2], name[2:]
    else:
        root, quality = name[0], name[1:]
    tones = [0, 3, 7] if quality == 'm' else [0, 4, 7]
    return NOTE_INDEX[root], tones


def build_midi(tempo: float, chords: list, instrument: str = 'guitar') -> pretty_midi.PrettyMIDI:
    pm = pretty_midi.PrettyMIDI(initial_tempo=tempo)
    inst = pretty_midi.Instrument(program=PROGRAMS[instrument])
    beat = 60.0 / tempo  # එක beat එකක කාලය (තත්පර)

    for c in chords:
        root, tones = _parse_chord(c['chord'])
        base = 48 + root  # octave 3
        t = c['start']
        end = c['end']

        if instrument == 'guitar':
            # Strum: beat එකක් පාසා chord එක ගහනවා
            while t < end:
                for k, interval in enumerate(tones + [12]):
                    start = t + k * 0.015  # තන් එකින් එක ගහන ආචරණය
                    if start >= end:
                        break
                    inst.notes.append(pretty_midi.Note(
                        velocity=80,
                        pitch=base + interval,
                        start=start,
                        end=min(t + beat * 0.9, end),
                    ))
                t += beat
        else:
            # Piano: arpeggio (ස්වර එකින් එක)
            i = 0
            while t < end:
                pitch = base + 12 + tones[i % 3]
                inst.notes.append(pretty_midi.Note(
                    velocity=75,
                    pitch=pitch,
                    start=t,
                    end=min(t + beat * 0.9, end),
                ))
                t += beat / 2
                i += 1

    pm.instruments.append(inst)
    return pm