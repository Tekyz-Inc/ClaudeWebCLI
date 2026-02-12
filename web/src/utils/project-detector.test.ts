import { describe, it, expect } from "vitest";
import { detectProject } from "./project-detector.js";

describe("detectProject", () => {
  it("detects node project from package.json", () => {
    const result = detectProject(["package.json", ".git", "src"], "/home/user/my-app");
    expect(result).toEqual({
      name: "my-app",
      type: "node",
      markers: ["package.json", ".git"],
    });
  });

  it("detects python project from pyproject.toml", () => {
    const result = detectProject(["pyproject.toml", ".git"], "/projects/mylib");
    expect(result).toEqual({
      name: "mylib",
      type: "python",
      markers: ["pyproject.toml", ".git"],
    });
  });

  it("detects python project from setup.py", () => {
    const result = detectProject(["setup.py"], "/projects/oldlib");
    expect(result).toEqual({
      name: "oldlib",
      type: "python",
      markers: ["setup.py"],
    });
  });

  it("detects rust project from Cargo.toml", () => {
    const result = detectProject(["Cargo.toml", ".git"], "/projects/rustapp");
    expect(result).toEqual({
      name: "rustapp",
      type: "rust",
      markers: ["Cargo.toml", ".git"],
    });
  });

  it("detects generic project from .git only", () => {
    const result = detectProject([".git", "README.md"], "/repos/misc");
    expect(result).toEqual({
      name: "misc",
      type: "generic",
      markers: [".git"],
    });
  });

  it("includes CLAUDE.md and .claude as markers", () => {
    const result = detectProject(["package.json", "CLAUDE.md", ".claude"], "/app");
    expect(result?.markers).toContain("CLAUDE.md");
    expect(result?.markers).toContain(".claude");
  });

  it("returns null when no project markers found", () => {
    const result = detectProject(["notes.txt", "photo.jpg"], "/random");
    expect(result).toBeNull();
  });

  it("returns null for empty directory", () => {
    const result = detectProject([], "/empty");
    expect(result).toBeNull();
  });

  it("handles Windows-style paths", () => {
    const result = detectProject(["package.json"], "C:\\Users\\dev\\project");
    expect(result?.name).toBe("project");
  });

  it("prioritizes first detected project type", () => {
    // node detected first even if rust also present
    const result = detectProject(["package.json", "Cargo.toml"], "/hybrid");
    expect(result?.type).toBe("node");
  });
});
