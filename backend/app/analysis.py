import librosa
import numpy as np

NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

# Krumhansl-Schmuckler key profiles
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def _chord_templates():
    templates, names = [], []
    for i in range(12):
        major = np.zeros(12)
        major[[i, (i + 4) % 12, (i + 7) % 12]] = 1
        minor = np.zeros(12)
        minor[[i, (i + 3) % 12, (i + 7) % 12]] = 1
        templates += [major, minor]
        names += [NOTES[i], NOTES[i] + 'm']
    return np.array(templates), names


def _detect_key(chroma):
    mean = chroma.mean(axis=1)
    best, best_score = "", -2
    for i in range(12):
        for profile, mode in [(MAJOR_PROFILE, 'major'), (MINOR_PROFILE, 'minor')]:
            score = np.corrcoef(mean, np.roll(profile, i))[0, 1]
            if score > best_score:
                best, best_score = f"{NOTES[i]} {mode}", score
    return best


def analyze_song(path: str) -> dict:
    # 1. Audio load කිරීම (mono, 22kHz)
    y, sr = librosa.load(path, sr=22050, mono=True)
    duration = float(len(y) / sr)

    # 2. Tempo සහ beats
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(np.atleast_1d(tempo)[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    # 3. Chroma (harmonic කොටස පමණක්)
    y_harm = librosa.effects.harmonic(y)
    chroma = librosa.feature.chroma_cqt(y=y_harm, sr=sr)

    # 4. Key
    key = _detect_key(chroma)

    # 5. Beat එකකට chroma එකක් (beat-synchronous)
    chroma_sync = librosa.util.sync(chroma, beat_frames, aggregate=np.median)

    # 6. Chord template matching
    templates, names = _chord_templates()
    sim = templates @ chroma_sync
    sim = sim / (np.linalg.norm(templates, axis=1)[:, None] *
                 (np.linalg.norm(chroma_sync, axis=0)[None, :] + 1e-9))

    # 7. Viterbi smoothing (chords නිතර වෙනස් වීම අඩු කරයි)
    probs = np.exp(sim * 8)
    probs = probs / probs.sum(axis=0)
    transition = np.full((24, 24), 0.2 / 23)
    np.fill_diagonal(transition, 0.8)
    best_path = librosa.sequence.viterbi_discriminative(probs, transition)

    # 8. Chords list එක හදන්න (එකම chord එකට එක් කරනවා)
    bounds = np.concatenate([[0.0], beat_times, [duration]])
    chords = []
    for i, idx in enumerate(best_path):
        start = float(bounds[i])
        end = float(bounds[i + 1]) if i + 1 < len(bounds) else duration
        name = names[idx]
        if chords and chords[-1]["chord"] == name:
            chords[-1]["end"] = round(end, 2)
        else:
            chords.append({"start": round(start, 2), "end": round(end, 2), "chord": name})

    return {
        "tempo": round(tempo, 1),
        "key": key,
        "duration": round(duration, 1),
        "chords": chords,
    }