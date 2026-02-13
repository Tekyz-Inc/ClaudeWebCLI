const TARGET_SAMPLE_RATE = 16_000;

export interface RawCapture {
  audioCtx: AudioContext;
  stream: MediaStream;
  samples: Float32Array[];
}

/**
 * Start capturing raw PCM audio from the microphone.
 * Uses ScriptProcessorNode to capture Float32Array samples directly,
 * bypassing MediaRecorder encode/decode which corrupts audio on some systems.
 */
export async function startRawCapture(): Promise<RawCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1 },
  });
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const samples: Float32Array[] = [];

  // ScriptProcessorNode captures raw PCM — deprecated but reliable
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (e) => {
    // Must copy — the buffer is reused by the browser
    samples.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };

  source.connect(processor);
  // ScriptProcessor requires connection to destination to fire events
  processor.connect(audioCtx.destination);

  return { audioCtx, stream, samples };
}

/**
 * Stop capturing and convert to Float32Array at 16kHz for Whisper.
 */
export async function stopRawCapture(
  capture: RawCapture,
): Promise<Float32Array> {
  const { audioCtx, stream, samples } = capture;

  // Stop microphone
  for (const track of stream.getTracks()) {
    track.stop();
  }

  // Concatenate all captured samples
  const totalLength = samples.reduce((sum, s) => sum + s.length, 0);
  if (totalLength === 0) {
    await audioCtx.close();
    return new Float32Array(0);
  }

  const fullAudio = new Float32Array(totalLength);
  let offset = 0;
  for (const s of samples) {
    fullAudio.set(s, offset);
    offset += s.length;
  }

  const nativeSr = audioCtx.sampleRate;
  await audioCtx.close();

  // Already at target rate
  if (nativeSr === TARGET_SAMPLE_RATE) {
    return fullAudio;
  }

  // Resample to 16kHz using OfflineAudioContext (proper sinc interpolation)
  const duration = fullAudio.length / nativeSr;
  const outLength = Math.round(duration * TARGET_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, outLength, TARGET_SAMPLE_RATE);
  const buffer = offline.createBuffer(1, fullAudio.length, nativeSr);
  buffer.getChannelData(0).set(fullAudio);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start(0);
  const resampled = await offline.startRendering();
  return resampled.getChannelData(0);
}
