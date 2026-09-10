# Agent Directives and Guidelines - Bizneo Reminders

This document gathers critical rules, privacy directives, and operational knowledge about the repository and its tooling for any AI agent or developer working on this codebase.

---

## 1. PRIVACY AND SECURITY: ZERO DATA LEAKAGE TOLERANCE (CRITICAL)

> [!CAUTION]
> **UNDER NO CIRCUMSTANCES** should real user, company, tenant, or network capture data be introduced, committed, or persisted in this repository.

### Strict confidentiality rules:
1. **Never use real data in tests, mocks, or fixtures**:
   - Strictly forbidden to include real Bizneo tenant or subdomain names. Always use generic dummy values such as `"tenant"`, `"example"`, `"company"`.
   - Strictly forbidden to use real numerical IDs extracted from captures or APIs (user IDs, shift IDs `shift_id`, or pause IDs). Always use synthetic identifiers: `"user_42"`, `"shift_123"`, `"pause_99"`.
   - Strictly forbidden to include real session cookies, authentication tokens, passwords, or CSRF tokens (`_csrf_token`). Always use `"dummy_token"` or `"token"`.
2. **`.har` files and local network captures**:
   - `.har` files, network traces, backups, and capture archives are strictly private and ignored in `.gitignore`.
   - **NEVER** reference absolute or relative paths to local capture directories (e.g. `../.hars/...`, `/home/.../.hars/`).
   - Automated tests **MUST NEVER** depend on reading `.har` files or the local filesystem via `fs.readFileSync`. All tests must use self-contained, synthetic in-memory sample HTML strings.
3. **Pre-commit and finalization verification**:
   - Before suggesting or creating a commit, perform a global search using search tools (`ripgrep`/`grep_search`) to ensure no real identifiers were accidentally introduced.

---

## 2. TOOLING AND RUNTIME ENVIRONMENT

### Shell and Terminal Usage (`run_command`)
- **Avoid unnecessary shell command executions**: If an action can be completed using built-in IDE tools (`view_file`, `write_to_file`, `replace_file_content`, `grep_search`, `list_dir`), always prioritize those tools over launching shell processes.
- **Terminal freeze risk**: In this IDE environment, shared terminal sessions may freeze or block if interactive commands or pagers are invoked.
- **Non-interactive commands only**:
  - Always run fully non-interactive commands (e.g., `npm test`, `npm run build`, `git status`).
  - Never trigger pagers (`git log` must always include `-n <N>`, `git diff` must never invoke `less`).
  - Never run `cd` in the command line (always use the `Cwd` parameter).

### Project Scripts
- `npm test`: Runs Vitest in a JSDOM environment (`vitest run --environment jsdom`). All tests must be 100% independent of network and local filesystem access.
- `npm run build`: Static type validation with TypeScript (`tsc --noEmit`).
- `npm run bundle`: Bundles entry points (`service-worker.ts`, `options.ts`, `popup.ts`) with `esbuild` into `dist/`, copying static assets (`manifest.json`, HTML, CSS, `_locales/`, `res/`).
- `npm run package:crx`: Packages the extension into `.crx` and `.zip` archives within the `release/` directory.
- `./build.sh`: Comprehensive CI/CD script that installs dependencies (`npm ci`), runs tests, typechecks, bundles, and packages release artifacts.

### CI Compatibility (GitHub Actions)
- The workflow in `.github/workflows/build.yml` checks out a clean Ubuntu runner and executes `npm test` and `npm run build`.
- If a test attempts to access files outside the repository tree or assumes local files exist, the CI pipeline will fail immediately.

---

## 3. PROJECT ARCHITECTURE

Bizneo Reminders is a Manifest V3 extension for Chromium-based browsers (Microsoft Edge and Google Chrome).

### Key Components
1. **`src/service-worker.ts`**:
   - Background worker managed by Chrome alarms (`chrome.alarms`).
   - Periodically polls Bizneo status according to the configured interval (`reminderIntervalSeconds`).
   - Evaluates reminder rules and triggers notifications (`chrome.notifications`).
   - **Notification management**: To prevent Windows/macOS from grouping or silently adding alerts to the notification center without showing the popup banner, each notification is created with a unique timestamp ID (`bizneo-${rule}-${timestamp}`) and `requireInteraction: true`, after clearing any previous notification for the same rule.
   - Provides direct action buttons in the notification (clock in, pause, resume, snooze) and opens Bizneo upon clicking the notification body.
2. **`src/client.ts` (`BizneoClient`)**:
   - Communicates with the Bizneo API using the active browser cookie session via `credentials: "include"`.
   - Executes timer actions mimicking official HTMX requests (`hx-put`, `hx-post`, passing `shift_id`, `kind`, `pause`).
3. **`src/parser/chrono.ts` (`parseChrono`)**:
   - Parses the HTML returned by Bizneo (`hub_chrono`) to extract:
     - `status`: `"stopped" | "working" | "paused"`
     - `chronoId`: ID of the current or available pause
     - `shiftId`: ID of the active shift
     - `formId`: Form ID (`chrono-form-default_chrono` or `chrono-form-hub_chrono`)
     - `loggedMinutes`, `scheduledMinutes`, `isExceeded`
4. **`src/reminders.ts` (`evaluateReminders`)**:
   - Pure function that evaluates active alerts:
     - `morningStart`: Alert if the workday has not started after the configured time.
     - `morningBreak`: Alert to take the midday break within the configured window.
     - `pauseOverdue`: Alert when an active break exceeds the configured maximum minutes.
     - `endOfDay`: Alert upon reaching the scheduled end-of-day time.
     - `maximumWork`: Alert upon completing the expected daily workday duration reported by Bizneo.
     - `stoppedPending`: Alert if the clock is stopped, time was logged today, but workday time is still pending and the clock has been stopped longer than the configured threshold.
5. **`src/config.ts`**:
   - Extension configuration schema, default values (`defaultConfig`), and backward-compatible migration (`validateConfig`).
6. **`popup.html` & `src/popup.ts`**:
   - Extension popup UI: displays chronometer state, logged and pending time, manual timer action buttons, quick "Open Bizneo" shortcut, refresh, and settings button.
7. **`options.html` & `src/options.ts`**:
   - Settings page: account settings (Tenant, User ID, Time Zone), schedule windows, alert thresholds, rule toggles, and JSON import/export.
8. **Internationalization (`_locales/`)**:
   - Support for Spanish (`es`) and English (`en`). All visible strings must be registered in both `messages.json` catalogs.

---

## 4. DEFAULT CONFIGURATION VALUES

Standard configuration defaults must remain in sync with:
```json
{
  "version": 1,
  "tenant": "",
  "userId": "",
  "timeZone": "Europe/Madrid",
  "reminderIntervalSeconds": 60,
  "morningStart": "08:00",
  "morningBreak": {
    "start": "13:00",
    "end": "15:00"
  },
  "pauseMaximumMinutes": 60,
  "endOfDayStart": "18:00",
  "snoozeMinutes": 15,
  "stoppedMaximumMinutes": 15,
  "stoppedPendingMinutes": 30,
  "enabled": {
    "morningStart": true,
    "morningBreak": true,
    "pauseOverdue": true,
    "endOfDay": true,
    "maximumWork": true,
    "stoppedPending": true
  }
}
```
