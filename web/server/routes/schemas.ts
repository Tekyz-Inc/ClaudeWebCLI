import { z } from "zod";

// ─── Session schemas ─────────────────────────────────────────────────────────

export const CreateSessionBody = z.object({
  model: z.string().optional(),
  permissionMode: z.string().optional(),
  cwd: z.string().optional(),
  claudeBinary: z.string().optional(),
  allowedTools: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  envSlug: z.string().optional(),
  useWorktree: z.boolean().optional(),
  branch: z.string().optional(),
  createBranch: z.boolean().optional(),
  resumeCliId: z.string().optional(),
});

export const PatchSessionNameBody = z.object({
  name: z.string().min(1, "name is required"),
});

export const ArchiveSessionBody = z.object({
  force: z.boolean().optional(),
});

// ─── Filesystem schemas ───────────────────────────────────────────────────────

export const WriteFileBody = z.object({
  path: z.string().min(1, "path is required"),
  content: z.string(),
});

// ─── Git schemas ──────────────────────────────────────────────────────────────

export const EnsureWorktreeBody = z.object({
  repoRoot: z.string().min(1, "repoRoot is required"),
  branch: z.string().min(1, "branch is required"),
  baseBranch: z.string().optional(),
  createBranch: z.boolean().optional(),
});

export const RemoveWorktreeBody = z.object({
  repoRoot: z.string().min(1, "repoRoot is required"),
  worktreePath: z.string().min(1, "worktreePath is required"),
  force: z.boolean().optional(),
});

export const GitFetchBody = z.object({
  repoRoot: z.string().min(1, "repoRoot is required"),
});

export const GitPullBody = z.object({
  cwd: z.string().min(1, "cwd is required"),
});

// ─── Environment schemas ──────────────────────────────────────────────────────

export const CreateEnvBody = z.object({
  name: z.string().min(1, "name is required"),
  variables: z.record(z.string(), z.string()).optional().default({}),
});

export const UpdateEnvBody = z.object({
  name: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
});
