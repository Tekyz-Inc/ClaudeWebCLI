const TARGET_SAMPLE_RATE = 16_000;

/**
 * Start capturing audio from the microphone.
 * Captures at the device's native sample rate (NOT 16kHz)
 * to avoid browser constraint issues. Resampling happens in stopAndConvert.
 */
export async function startAudioCapture(): Promise<{
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
}> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1 },
  });
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(250);
  return { recorder, stream, chunks };
}

/**
 * Stop recording and convert captured audio to Float32Array at 16kHz.
 * Uses OfflineAudioContext for proper resampling from native rate.
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

  // Decode audio blob at native sample rate
  const blob = new Blob(chunks, { type: recorder.mimeType });
  const arrayBuffer = await blob.arrayBuffer();
  const decodeCtx = new AudioContext();
  const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  await decodeCtx.close();

  const nativeSr = audioBuffer.sampleRate;
  const mono = audioBuffer.getChannelData(0);

  // Already at target rate — return directly
  if (nativeSr === TARGET_SAMPLE_RATE) {
    return mono;
  }

  // Resample to 16kHz using OfflineAudioContext (proper sinc interpolation)
  const duration = mono.length / nativeSr;
  const outLength = Math.round(duration * TARGET_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, outLength, TARGET_SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(offline.destination);
  src.start(0);
  const resampled = await offline.startRendering();
  return resampled.getChannelData(0);
}
