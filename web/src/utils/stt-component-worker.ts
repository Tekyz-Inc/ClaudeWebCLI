/**
 * Local worker entry for @tekyzinc/stt-component.
 *
 * The npm package bundles the worker into index.js, but Web Workers
 * need a standalone file. This duplicates the component's worker logic
 * so Vite can serve it as a module worker.
 *
 * TODO: Remove once @tekyzinc/stt-component ships the worker as a
 * separate export (e.g. @tekyzinc/stt-component/worker).
 */
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;

interface WorkerConfig {
  model: string;
  backend: string;
  language: string;
  dtype: string;
  chunkLengthS: number;
  strideLengthS: number;
}

interface WorkerMessage {
  type: "load" | "transcribe" | "cancel";
  audio?: Float32Array;
  config?: WorkerConfig;
}

interface WorkerResponse {
  type: "progress" | "ready" | "result" | "error";
  data?: unknown;
}

const MODEL_MAP: Record<string, string> = {
  tiny: "onnx-community/whisper-tiny",
  base: "onnx-community/whisper-base",
  small: "onnx-community/whisper-small",
  medium: "onnx-community/whisper-medium",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let whisperPipeline: any = null;
let cancelledId = 0;
let currentTranscribeId = 0;
let storedConfig: WorkerConfig | undefined;

function post(msg: WorkerResponse): void {
  self.postMessage(msg);
}

function filterArtifacts(raw: string): string {
  return raw
    .trim()
    .replace(/\[[^\]]*\]/g, "")
    .replace(
      /\([^)]*(?:typing|clicking|silence|music|applause|laughter|coughing|breathing|sighing|sneezing)[^)]*\)/gi,
      "",
    )
    .trim();
}

async function loadModel(config?: WorkerConfig): Promise<void> {
  const modelId = MODEL_MAP[config?.model ?? "tiny"] ?? MODEL_MAP.tiny;
  const dtype = (config?.dtype ?? "q4") as "q4";
  const requestedBackend = config?.backend ?? "auto";

  const opts = {
    dtype,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    progress_callback: (p: any) => {
      if (typeof p?.progress === "number") {
        post({ type: "progress", data: p.progress });
      }
    },
  };

  if (requestedBackend === "wasm") {
    try {
      whisperPipeline = await pipeline(
        "automatic-speech-recognition", modelId, opts,
      );
      post({ type: "ready" });
    } catch (err) {
      post({ type: "error", data: String(err) });
    }
    return;
  }

  try {
    whisperPipeline = await pipeline(
      "automatic-speech-recognition", modelId,
      { ...opts, device: "webgpu" as const },
    );
    post({ type: "ready" });
  } catch {
    try {
      whisperPipeline = await pipeline(
        "automatic-speech-recognition", modelId, opts,
      );
      post({ type: "ready" });
    } catch (wasmError) {
      post({ type: "error", data: String(wasmError) });
    }
  }
}

async function transcribe(
  audio: Float32Array, config?: WorkerConfig,
): Promise<void> {
  if (!whisperPipeline) {
    post({ type: "error", data: "Model not loaded" });
    return;
  }

  const myId = ++currentTranscribeId;

  try {
    const result = await whisperPipeline(audio, {
      language: config?.language ?? "en",
      task: "transcribe",
      chunk_length_s: config?.chunkLengthS ?? 30,
      stride_length_s: config?.strideLengthS ?? 5,
    });

    if (cancelledId >= myId) return;

    const raw = typeof result === "string"
      ? result
      : ((result as { text: string }).text ?? "");
    post({ type: "result", data: filterArtifacts(raw) });
  } catch (err) {
    if (cancelledId >= myId) return;
    post({ type: "error", data: String(err) });
  }
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, audio, config } = e.data;
  if (type === "load") {
    storedConfig = config;
    loadModel(config);
  } else if (type === "transcribe" && audio) {
    transcribe(audio, storedConfig);
  } else if (type === "cancel") {
    cancelledId = currentTranscribeId;
  }
};
