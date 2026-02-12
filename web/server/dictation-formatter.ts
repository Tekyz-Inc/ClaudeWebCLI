const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const TIMEOUT_MS = 5_000;
const MAX_INPUT_LENGTH = 2_000;

let resolvedBinary: string | null = null;

async function resolveClaudeBinary(): Promise<string> {
  if (resolvedBinary) return resolvedBinary;
  try {
    const proc = Bun.spawn(["which", "claude"], { stdout: "pipe", stderr: "pipe" });
    await proc.exited;
    const out = await new Response(proc.stdout).text();
    resolvedBinary = out.trim() || "claude";
  } catch {
    resolvedBinary = "claude";
  }
  return resolvedBinary;
}

export interface FormatResult {
  formatted: string;
  changed: boolean;
}

const SYSTEM_PROMPT = [
  "You are a dictation formatter. The user spoke text into a microphone and it was transcribed literally.",
  "Your job: add punctuation, fix capitalization, and format numbers. Preserve every word exactly.",
  "Rules:",
  "- Add periods, commas, question marks, exclamation marks where appropriate",
  "- Capitalize sentence starts and proper nouns",
  "- Format spoken numbers (e.g. 'eight colon zero zero' → '8:00')",
  "- 'period' at end of a sentence = '.' punctuation",
  "- 'period' as a noun (e.g. 'school period', 'time period') = keep the word",
  "- Same logic for 'comma', 'colon', 'semicolon', 'question mark', 'exclamation point'",
  "- Output ONLY the formatted text. No explanation, no quotes.",
].join("\n");

/**
 * Format raw dictated text using a one-shot Claude CLI call.
 * Returns null on failure (timeout, CLI error, etc.)
 */
export async function formatDictation(
  text: string,
  model?: string,
): Promise<FormatResult | null> {
  const trimmed = text.trim();
  if (!trimmed) return { formatted: text, changed: false };

  const input = trimmed.slice(0, MAX_INPUT_LENGTH);
  const binary = await resolveClaudeBinary();
  const useModel = model || DEFAULT_MODEL;

  const prompt = `Format this dictated text:\n\n${input}`;

  try {
    const proc = Bun.spawn(
      [binary, "-p", prompt, "--model", useModel, "--output-format", "json",
       "--system-prompt", SYSTEM_PROMPT],
      { stdout: "pipe", stderr: "pipe", env: process.env },
    );

    let timer: ReturnType<typeof setTimeout>;
    await Promise.race([
      proc.exited,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          proc.kill("SIGTERM");
          reject(new Error("Formatting timed out"));
        }, TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timer!);

    const stdout = await new Response(proc.stdout).text();
    return parseCliOutput(stdout, input);
  } catch (err) {
    console.warn("[dictation-formatter] Format failed:", err);
    return null;
  }
}

function parseCliOutput(
  stdout: string,
  originalInput: string,
): FormatResult | null {
  try {
    const parsed = JSON.parse(stdout);
    const result = (parsed.result || "").trim();
    if (result) {
      return { formatted: result, changed: result !== originalInput };
    }
  } catch {
    const raw = stdout.trim();
    if (raw) {
      return { formatted: raw, changed: raw !== originalInput };
    }
  }
  return null;
}
