import os
import tempfile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.analysis import analyze_song

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

    # Temporary file එකක් ලෙස save කරලා analyze කරනවා
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = analyze_song(tmp_path)
    except Exception as e:
        raise HTTPException(500, f"Analysis අසාර්ථකයි: {e}")
    finally:
        os.remove(tmp_path)  # මුල් file එක වහාම මකනවා

    return result