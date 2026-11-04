import os
import tempfile
from typing import List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.analysis import analyze_song
from app.arranger import build_midi

app = FastAPI(title="Cover Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXT = {".mp3", ".wav"}
MAX_SIZE_MB = 100


@app.get("/")
def root():
    return {"message": "Cover Studio API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, "MP3 හෝ WAV files පමණයි")

    content = await file.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File size {MAX_SIZE_MB}MB ට වඩා අඩු විය යුතුයි")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = analyze_song(tmp_path)
    except Exception as e:
        raise HTTPException(500, f"Analysis අසාර්ථකයි: {e}")
    finally:
        os.remove(tmp_path)

    return result


class ChordItem(BaseModel):
    start: float
    end: float
    chord: str


class GenerateRequest(BaseModel):
    tempo: float
    chords: List[ChordItem]
    instrument: str = "guitar"


@app.post("/generate")
def generate(req: GenerateRequest):
    if req.instrument not in ("guitar", "piano"):
        raise HTTPException(400, "instrument එක guitar හෝ piano විය යුතුයි")

    try:
        pm = build_midi(req.tempo, [c.model_dump() for c in req.chords], req.instrument)
    except Exception as e:
        raise HTTPException(500, f"Generate අසාර්ථකයි: {e}")

    out_dir = os.path.join(tempfile.gettempdir(), "cover_studio")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"backing_{req.instrument}.mid")
    pm.write(out_path)

    return FileResponse(out_path, media_type="audio/midi", filename=f"backing_{req.instrument}.mid")