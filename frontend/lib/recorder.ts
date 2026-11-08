let mediaRecorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let chunks: Blob[] = [];

export async function startRecording() {
    stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
        },
    });

    chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.start();
}

export function stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
        if (!mediaRecorder) return resolve(new Blob());
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || "audio/webm" });
            stream?.getTracks().forEach((t) => t.stop());
            mediaRecorder = null;
            stream = null;
            resolve(blob);
        };
        mediaRecorder.stop();
    });
}