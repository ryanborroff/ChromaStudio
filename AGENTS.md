# Agent Notes

## Git & Branching Workflow

This codebase is simultaneously being edited and tested live in Replit. To prevent file conflicts, overwritten work, and broken live environments, follow these rules for every task:

1. **Never commit directly to `main` or `master`.**
   - Always start on `main`, run `git pull origin main`, then check out a new dedicated feature branch before making any file changes or running installation commands.
   - Branch naming convention: `devin/<short-task-description>` (e.g., `devin/add-auth-middleware`, `devin/fix-player-layout`).

2. **Scoping & Clean Commits:**
   - Keep changes strictly focused on the requested task.
   - Write clear, concise commit messages outlining what was changed.

3. **Completing Tasks via Pull Request:**
   - Push your branch: `git push origin devin/<task-name>`.
   - Open a Pull Request (PR) against `main` on GitHub.
   - Include a clear title and a brief bulleted summary of:
     - What was added/changed.
     - How it was tested.
     - Any new environment variables or setup steps required.

4. **Final State:**
   - Do **not** automatically merge your own PR into `main` unless explicitly instructed.
   - Leave the PR open for review so it can be merged and pulled into Replit safely.
