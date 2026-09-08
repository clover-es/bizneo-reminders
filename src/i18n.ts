const englishFallback: Record<string, string> = {
  extensionName: "Bizneo Reminders", extensionDescription: "Configurable reminders for the Bizneo time clock.", bizneo: "Bizneo",
  checking: "Checking...", connected: "Connected", error: "Error", loading: "Loading",
  working: "Recording workday", paused: "On break", stopped: "Stopped", unknown: "Unknown",
  start: "Start", stop: "Stop", pause: "Pause", resume: "Resume", refresh: "Refresh",
  queryFailed: "Could not query Bizneo", stopConfirmation: "Do you want to stop the workday?",
  registeredTime: "Registered: $TIME$", remainingTime: "Remaining: $TIME$",
  configTitle: "Bizneo Reminders", configIntro: "Configure the rules and save the JSON in the browser profile.", configJsonLabel: "JSON configuration",
  save: "Save", checkNow: "Check now", importJson: "Import JSON", exportJson: "Export JSON",
  configSaved: "Configuration saved.", checkingBizneo: "Checking Bizneo...", checkComplete: "Check complete.",
  checkFailed: "Check failed: $ERROR$", unknownError: "unknown error", jsonImported: "JSON imported. Press Save to apply it.", jsonExported: "JSON exported.",
  invalidStoredConfig: "Saved configuration is invalid: $ERROR$", configObject: "Configuration must be a JSON object", unsupportedConfigVersion: "Unsupported configuration version",
  tenantUserRequired: "tenant and userId are required", timeZoneRequired: "timeZone is required", intervalInvalid: "reminderIntervalSeconds must be an integer of at least 30 seconds",
  workingDaysInvalid: "workingDays must contain days from 0 to 6", windowInvalid: "Time windows must use HH:MM", endOfDayInvalid: "endOfDayStart must use HH:MM",
  pauseMaximumInvalid: "pauseMaximumMinutes must be positive", maximumWorkInvalid: "maximumWorkMinutes must be positive", enabledInvalid: "enabled must contain booleans for every rule",
  configBeforeQuery: "Configure tenant and userId before querying Bizneo", notAuthenticated: "Bizneo session is not authenticated", httpError: "Bizneo returned HTTP $STATUS$", invalidAction: "Invalid time clock action",
  checkInReminderTitle: "Check-in pending", checkInReminderMessage: "You have not started the clock yet.", breakReminderTitle: "Break pending", breakReminderMessage: "The midday break has not started yet.",
  pauseOverdueTitle: "Break exceeded", pauseOverdueMessage: "The break is longer than $MINUTES$ minutes.", endOfDayTitle: "End of workday", endOfDayMessage: "Your workday is ready to be finished.", openBizneo: "Open Bizneo"
};

function substitute(value: string, substitutions?: string | string[]): string {
  if (typeof substitutions === "string") return value.replace(/\$\w+\$/g, substitutions);
  let index = 0;
  return value.replace(/\$\w+\$/g, match => substitutions?.[index++] ?? match);
}

export function t(key: string, substitutions?: string | string[]): string {
  const value = typeof chrome !== "undefined" && chrome.i18n
    ? chrome.i18n.getMessage(key, substitutions)
    : "";
  return substitute(value || englishFallback[key] || key, substitutions);
}

export function localizeDocument(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach(element => {
    const key = element.dataset.i18n;
    if (key) element.textContent = t(key);
  });
}
