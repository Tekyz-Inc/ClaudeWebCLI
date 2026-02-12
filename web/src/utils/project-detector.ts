export interface ProjectInfo {
  name: string;
  type: "node" | "python" | "rust" | "generic";
  markers: string[];
}

const PROJECT_MARKERS: Array<{ file: string; type: ProjectInfo["type"] }> = [
  { file: "package.json", type: "node" },
  { file: "pyproject.toml", type: "python" },
  { file: "setup.py", type: "python" },
  { file: "Cargo.toml", type: "rust" },
];

const GENERIC_MARKERS = [".git", "CLAUDE.md", ".claude"];

/**
 * Detect project type from a directory listing.
 * Returns null if no project markers found.
 */
export function detectProject(
  dirContents: string[],
  dirPath: string,
): ProjectInfo | null {
  const files = new Set(dirContents);
  const foundMarkers: string[] = [];
  let detectedType: ProjectInfo["type"] | null = null;

  for (const marker of PROJECT_MARKERS) {
    if (files.has(marker.file)) {
      foundMarkers.push(marker.file);
      if (!detectedType) detectedType = marker.type;
    }
  }

  for (const marker of GENERIC_MARKERS) {
    if (files.has(marker)) foundMarkers.push(marker);
  }

  if (foundMarkers.length === 0) return null;

  const name = dirPath.replace(/\\/g, "/").split("/").pop() || dirPath;

  return {
    name,
    type: detectedType || "generic",
    markers: foundMarkers,
  };
}
