import { pipeline, env } from "@huggingface/transformers";

// Disable local model check — always use remote/cached
env.allowLocalModels = false;

const MODEL_ID = "onnx-community/whisper-tiny";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let whisperPipeline: any = null;

interface WorkerMessage {
  type: "load" | "transcribe";
  audio?: Float32Array;
}

interface WorkerResponse {
  type: "progress" | "ready" | "result" | "error";
  data?: unknown;
}

function post(msg: WorkerResponse): void {
  self.postMessage(msg);
}

async function loadModel(): Promise<void> {
  try {
    whisperPipeline = await pipeline(
      "automatic-speech-recognition",
      MODEL_ID,
      {
        dtype: "q4" as const,
        device: "webgpu" as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress_callback: (progress: any) => {
          if (typeof progress?.progress === "number") {
            post({ type: "progress", data: progress.progress });
          }
        },
      },
    );
    post({ type: "ready" });
  } catch (webgpuError) {
    // Fallback to WASM if WebGPU fails
    console.warn("[whisper-worker] WebGPU failed, falling back to WASM:", webgpuError);
    try {
      whisperPipeline = await pipeline(
        "automatic-speech-recognition",
        MODEL_ID,
        {
          dtype: "q4" as const,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          progress_callback: (progress: any) => {
            if (typeof progress?.progress === "number") {
              post({ type: "progress", data: progress.progress });
            }
          },
        },
      );
      post({ type: "ready" });
    } catch (wasmError) {
      post({ type: "error", data: String(wasmError) });
    }
  }
}

async function transcribe(audio: Float32Array): Promise<void> {
  if (!whisperPipeline) {
    post({ type: "error", data: "Model not loaded" });
    return;
  }
  try {
    const result = await whisperPipeline(audio, {
      language: "en",
      task: "transcribe",
    });
    // Result can be string or object with .text
    const text = typeof result === "string"
      ? result
      : (result as { text: string }).text ?? "";
    post({ type: "result", data: text.trim() });
  } catch (err) {
    post({ type: "error", data: String(err) });
  }
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, audio } = e.data;
  if (type === "load") {
    loadModel();
  } else if (type === "transcribe" && audio) {
    transcribe(audio);
  }
};
