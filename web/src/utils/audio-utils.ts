const TARGET_SAMPLE_RATE = 16_000;

/**
 * Start capturing audio from the microphone.
 * Returns a MediaRecorder and the underlying stream.
 */
export async function startAudioCapture(): Promise<{
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
}> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: TARGET_SAMPLE_RATE,
    },
  });
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(250); // Collect chunks every 250ms
  return { recorder, stream, chunks };
}

/**
 * Stop recording and convert captured audio to Float32Array at 16kHz.
 * This is the format Whisper expects.
 */
export async function stopAndConvert(
  recorder: MediaRecorder,
  stream: MediaStream,
  chunks: Blob[],
): Promise<Float32Array> {
  // Stop recording and wait for final data
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.stop();
  });

  // Stop all tracks to release microphone
  for (const track of stream.getTracks()) {
    track.stop();
  }

  // Decode audio blob to AudioBuffer
  const blob = new Blob(chunks, { type: recorder.mimeType });
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Extract mono PCM Float32 data
  const pcm = audioBuffer.getChannelData(0);

  // Resample if AudioContext didn't honor our sampleRate request
  if (audioBuffer.sampleRate !== TARGET_SAMPLE_RATE) {
    const ratio = audioBuffer.sampleRate / TARGET_SAMPLE_RATE;
    const newLength = Math.round(pcm.length / ratio);
    const resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      resampled[i] = pcm[Math.round(i * ratio)] ?? 0;
    }
    await audioCtx.close();
    return resampled;
  }

  await audioCtx.close();
  return pcm;
}
