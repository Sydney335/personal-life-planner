# Persistent Codex instructions — Personal Life Planner

These instructions apply to every Codex task working in this repository. Read them before editing. The application already exists: **do not scaffold a second app**.

## Repository identity and preflight

1. Before making changes, inspect the current working directory and Git state:
   - `pwd`
   - `git rev-parse --show-toplevel`
   - `git remote -v`
   - `git branch --show-current`
   - `git status --short --branch`
   - `git log -1 --oneline`
2. Confirm you are working on the existing **`Sydney335/personal-life-planner`** repository. Accept the corresponding HTTPS or SSH Git remote. Check that the repository contains its existing React/TypeScript/Vite project (for example `package.json`, `src/`, and Vite configuration), rather than an empty or unrelated directory.
3. Confirm that the task starts from the intended base branch; use `main` unless the user explicitly specifies another base. Work on a task-specific branch or the Codex-managed task branch. Do not force-reset an existing checkout or overwrite uncommitted user changes.
4. If the repository, Git remote, base branch, or existing project files cannot be verified, **stop before writing code**, report the discrepancy, and ask how to proceed. Do not silently initialize a new repository or create another application.

## Implement safely and verify

- Work incrementally in the existing architecture. Preserve current user data, migrations, cloud sync, offline storage, and existing features unless changes are explicitly requested.
- For tasks with multiple substantial features, split work into logical milestones. After each completed major feature, run applicable tests/checks, report failures truthfully, inspect the diff, and create a focused Git commit.
- Keep a concise progress record for long tasks (in the task reply and, when helpful, a tracked progress document) identifying completed milestones, tests actually run, known problems, and remaining work.
- Do not commit passwords, tokens, private keys, personal notes, production exports, or local environment files. Never ask users to paste secrets into chat.
- Do not merge into `main`, apply production database migrations, or change live deployment settings without the user's explicit approval. Propose a pull request for review when possible.

## Usage limits, interruptions, and recovery

- A usage cap, context limit, capacity error, or task interruption can happen unexpectedly. **Do not claim to know the user's remaining quota or promise that a final action will run at the exact moment the quota runs out.**
- Reduce potential loss *before* an interruption: checkpoint meaningful progress after each major milestone with tests where feasible and a Git commit. When authorized and supported, push the task branch so commits are available outside the temporary workspace; make clear whether a commit is only local or has actually been pushed.
- When a task is nearing a natural stopping point, becomes blocked, or is interrupted, provide the best available handoff:
  - Repository path, remote, working branch, and base branch
  - Completed features and incomplete work
  - Latest commit SHA and whether it was pushed
  - Any uncommitted changes and whether they are recoverable
  - Tests run and results (including tests not run)
  - Pending database migrations, credentials/configuration, and deployment steps
  - Exact safe next steps for resuming **in the same task/workspace** when possible
- Do not claim that uncommitted or unpushed changes are safely preserved between cloud tasks. A new cloud task may have a separate workspace; consult Git commits and documented handoff status rather than assuming state transfers.
- If the allowance is exhausted and further actions are blocked, stop and report what is actually saved. Do not silently start fresh work, imply background continuation, or merge/deploy without authorization.

## End-of-task summary

Before ending each substantial task, give a concise status report separating **verified complete**, **unfinished**, and **not verified**. Include branch/commit/PR information, any required migrations, actual test outcomes, and next steps. Prefer Chinese for the user-facing summary unless the user requests another language.
