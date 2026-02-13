const TARGET_SAMPLE_RATE = 16_000;

export interface RawCapture {
  audioCtx: AudioContext;
  stream: MediaStream;
  samples: Float32Array[];
  /** Must retain reference to prevent GC from stopping audio processing */
  _processor: ScriptProcessorNode;
}

/**
 * Start capturing raw PCM audio from the microphone.
 * Uses ScriptProcessorNode to capture Float32Array samples directly,
 * bypassing MediaRecorder encode/decode which corrupts audio.
 */
export async function startRawCapture(): Promise<RawCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1 },
  });
  const audioCtx = new AudioContext();

  // Chrome may suspend AudioContext — must resume within user gesture
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  const source = audioCtx.createMediaStreamSource(stream);
  const samples: Float32Array[] = [];

  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (e) => {
    samples.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };

  // Connect through a silent gain node so mic audio doesn't play back
  const silencer = audioCtx.createGain();
  silencer.gain.value = 0;
  source.connect(processor);
  processor.connect(silencer);
  silencer.connect(audioCtx.destination);

  return { audioCtx, stream, samples, _processor: processor };
}

/**
 * Stop capturing and convert to Float32Array at 16kHz for Whisper.
 */
export async function stopRawCapture(
  capture: RawCapture,
): Promise<Float32Array> {
  const { audioCtx, stream, samples, _processor } = capture;

  // Disconnect processor first to stop capturing
  try { _processor.disconnect(); } catch { /* already disconnected */ }

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

  if (nativeSr === TARGET_SAMPLE_RATE) {
    return fullAudio;
  }

  // Resample to 16kHz using OfflineAudioContext
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
