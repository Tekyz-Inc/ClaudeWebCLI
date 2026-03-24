import type { WorktreeTracker } from "../worktree-tracker.js";
import * as gitUtils from "../git-utils.js";

/** Shared worktree cleanup logic used by session delete and archive routes. */
export async function cleanupWorktree(
  sessionId: string,
  force?: boolean,
  worktreeTracker?: WorktreeTracker,
): Promise<{ cleaned?: boolean; dirty?: boolean; path?: string } | undefined> {
  if (!worktreeTracker) return undefined;
  const mapping = worktreeTracker.getBySession(sessionId);
  if (!mapping) return undefined;

  if (worktreeTracker.isWorktreeInUse(mapping.worktreePath, sessionId)) {
    worktreeTracker.removeBySession(sessionId);
    return { cleaned: false, path: mapping.worktreePath };
  }

  const dirty = await gitUtils.isWorktreeDirty(mapping.worktreePath);
  if (dirty && !force) {
    console.log(`[routes] Worktree ${mapping.worktreePath} is dirty, not auto-removing`);
    return { cleaned: false, dirty: true, path: mapping.worktreePath };
  }

  const branchToDelete = mapping.actualBranch && mapping.actualBranch !== mapping.branch
    ? mapping.actualBranch
    : undefined;
  const result = await gitUtils.removeWorktree(mapping.repoRoot, mapping.worktreePath, { force: dirty, branchToDelete });
  if (result.removed) {
    worktreeTracker.removeBySession(sessionId);
    console.log(`[routes] ${dirty ? "Force-removed dirty" : "Auto-removed clean"} worktree ${mapping.worktreePath}`);
  }
  return { cleaned: result.removed, path: mapping.worktreePath };
}
