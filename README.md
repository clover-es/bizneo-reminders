# bizneo-reminders

> Time-tracking reminders for Bizneo on Chrome and Microsoft Edge.

[![License: MIT](https://img.shields.io/badge/License-MIT-176b63.svg)](LICENSE)
[![Manifest](https://img.shields.io/badge/Manifest-V3-153f4a.svg)](manifest.json)

## Why it exists

Recording working hours is an important obligation for companies and employees in Spain. Article 34.9 of the Spanish Workers' Statute, introduced by Royal Decree-Law 8/2019, requires employers to guarantee a daily record of working time, including the specific start and end time, and to retain those records for four years.

Although the official record is the company's responsibility, in practice employees still need to remember to start the clock, begin their break, return from it and finish the workday. Forgetting one of these actions can lead to incomplete records and later corrections. **bizneo-reminders** was created to reduce that problem: it watches the Bizneo clock state and reminds the employee at the appropriate time, without requiring a Bizneo tab to remain open.

The extension does not replace the official time-recording system, modify records automatically or provide legal advice. It supports daily compliance through reminders while keeping manual actions under the employee's control.

> The legal reference above explains the motivation for this project and is not legal advice. Specific obligations may depend on current legislation, collective agreements and each company's policies.

## Features

- Reads the clock state: stopped, recording workday or on break.
- Displays registered and remaining time in `HH:MM` format.
- Lets the user start/stop and pause/resume the workday from the popup.
- Reminds the user when the morning check-in is missing.
- Reminds the user when the midday break has not started.
- Reminds the user when the break exceeds the configured limit.
- Reminds the user when the workday should end or the maximum duration is reached.
- Repeats reminders using a configurable interval in seconds.
- Runs in the background through `chrome.alarms`.
- Provides grouped settings with JSON import and export.
- Includes visual help for finding the Tenant ID and User ID in Bizneo.
- Provides English and Spanish UI and notifications according to the browser language.

## How it works

The extension is a Manifest V3 application made up of:

- `service-worker.js`: queries Bizneo, evaluates rules, schedules alarms and sends notifications.
- `popup.html`: displays the current state and provides manual clock actions.
- `options.html`: configures the account, schedule, rules and notifications.
- `src/parser/`: parses the HTML from the `hub_chrono` widget.
- `_locales/`: translation catalogs.
- `res/`: visual resources used by the configuration help.

Authentication reuses the browser session cookies through `credentials: include`. Cookies and tokens are not stored in the repository. Bizneo's internal routes and selectors may change without notice.

## Requirements

- Node.js 20 or newer.
- npm.
- Chrome or Microsoft Edge.
- An active Bizneo session.
- The account's Tenant ID and User ID.

## Development

Install dependencies and run validation:

```bash
npm ci
npm test
npm run build
```

Build the loadable extension:

```bash
npm run bundle
```

The output is placed in `dist/`. In Edge, open `edge://extensions`, enable developer mode and click **Load unpacked**, selecting `dist/`.

You can also run the complete process with:

```bash
./build.sh
```

The script runs tests, type checking, bundling and CRX packaging.

## Configuration

Open **Settings** from the popup or from the extension details page. The configuration screen is divided into:

- **Account**: Tenant ID, User ID and IANA time zone.
- **Work schedule**: morning and break windows, working days and maximum work duration.
- **Reminders**: individual rule switches and the maximum break duration.
- **Notifications**: check interval in seconds.
- **Advanced JSON**: editing and exchanging the complete configuration.

Minimal example:

```json
{
  "version": 1,
  "tenant": "your-tenant",
  "userId": "123456",
  "timeZone": "Europe/Madrid",
  "reminderIntervalSeconds": 600,
  "workingDays": [1, 2, 3, 4, 5],
  "morningStart": { "start": "08:00", "end": "10:00" },
  "morningBreak": { "start": "13:00", "end": "15:00" },
  "pauseMaximumMinutes": 55,
  "endOfDayStart": "17:00",
  "maximumWorkMinutes": 480,
  "enabled": {
    "morningStart": true,
    "morningBreak": true,
    "pauseOverdue": true,
    "endOfDay": true
  }
}
```

The options page warns you when you try to close it with unsaved changes. Times are normalized to `HH:MM`. The minimum interval is 30 seconds, although Edge may group very short alarms.

## CRX packaging

Create a signed build and a distributable ZIP with:

```bash
npm run package:crx
```

This creates:

- `release/bizneo-reminders.crx`: CRX3 package.
- `release/bizneo-reminders.zip`: compressed extension.
- `release/bizneo-reminders.pem`: private signing key.

Keep the PEM key for future versions: changing it changes the extension ID. Do not publish or send it to third parties.

Edge may block manual installation of a local CRX on Windows. For regular distribution, publish the extension through Edge Add-ons, use an enterprise policy, or load `dist/` with developer mode during development.

## Testing

The current tests cover:

- Stopped, working and paused clock-state parsing.
- Configurable intervals and migration from the old minutes field.
- Reminder time windows.
- Break and maximum-work thresholds.
- Non-working days.

```bash
npm test
npm run build
```

Validation against a real Bizneo account should use a test account. Do not commit cookies, tokens or HTML containing personal data to the repository.

## Privacy and security

- The extension only requests access to `https://*.bizneohr.com/*`.
- Bizneo credentials are not included in the configuration or repository.
- Retrieved data is used to calculate the current state and display reminders.
- The user confirms manual workday stop actions.
- The alarms do not perform automatic clock actions.

## License

Distributed under the [MIT License](LICENSE). Copyright (c) 2026 Guillermo Rodríguez.
