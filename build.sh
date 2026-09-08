#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

npm ci
npm test
npm run build
npm run bundle
npm run package:crx

printf '\nBuild complete.\n'
printf '%s\n' "  Extension: $ROOT_DIR/dist/"
printf '%s\n' "  CRX:       $ROOT_DIR/release/bizneo-reminders.crx"
printf '%s\n' "  ZIP:       $ROOT_DIR/release/bizneo-reminders.zip"
printf '%s\n' "  Key:       $ROOT_DIR/release/bizneo-reminders.pem"
