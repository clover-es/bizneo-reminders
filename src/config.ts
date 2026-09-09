import { t } from "./i18n.js";

export interface TimeWindow {
  start: string;
  end: string;
}

export interface ReminderConfig {
  version: 1;
  tenant: string;
  userId: string;
  timeZone: string;
  reminderIntervalSeconds: number;
  morningStart: string;
  morningBreak: TimeWindow;
  pauseMaximumMinutes: number;
  endOfDayStart: string;
  snoozeMinutes: number;
  stoppedMaximumMinutes: number;
  stoppedPendingMinutes: number;
  enabled: {
    morningStart: boolean;
    morningBreak: boolean;
    pauseOverdue: boolean;
    endOfDay: boolean;
    maximumWork: boolean;
    stoppedPending: boolean;
  };
}

export const defaultConfig = (): ReminderConfig => ({
  version: 1,
  tenant: "",
  userId: "",
  timeZone: "Europe/Madrid",
  reminderIntervalSeconds: 60,
  morningStart: "08:00",
  morningBreak: { start: "13:00", end: "15:00" },
  pauseMaximumMinutes: 60,
  endOfDayStart: "18:00",
  snoozeMinutes: 15,
  stoppedMaximumMinutes: 15,
  stoppedPendingMinutes: 30,
  enabled: {
    morningStart: true,
    morningBreak: true,
    pauseOverdue: true,
    endOfDay: true,
    maximumWork: true,
    stoppedPending: true
  }
});

const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateConfig(input: unknown): ReminderConfig {
  if (!input || typeof input !== "object") {
    throw new Error(t("configObject"));
  }
  const value = input as Partial<ReminderConfig> & {
    reminderIntervalMinutes?: unknown;
    workingDays?: unknown;
    maximumWorkMinutes?: unknown;
  };
  if (value.version !== 1) throw new Error(t("unsupportedConfigVersion"));
  if (typeof value.tenant !== "string" || typeof value.userId !== "string") {
    throw new Error(t("tenantUserRequired"));
  }
  if (typeof value.timeZone !== "string" || !value.timeZone) {
    throw new Error(t("timeZoneRequired"));
  }
  const legacyMinutes = value.reminderIntervalMinutes;
  const intervalSeconds = value.reminderIntervalSeconds
    ?? (typeof legacyMinutes === "number" ? legacyMinutes * 60 : undefined);
  if (!Number.isInteger(intervalSeconds) || (intervalSeconds ?? 0) < 30) {
    throw new Error(t("intervalInvalid"));
  }

  // Support migrating morningStart from legacy TimeWindow { start, end } to single string
  let morningStart = "";
  if (typeof value.morningStart === "string") {
    morningStart = value.morningStart;
  } else if (value.morningStart && typeof value.morningStart === "object" && "start" in value.morningStart) {
    morningStart = String((value.morningStart as { start?: unknown }).start ?? "");
  }
  if (!validTime.test(morningStart)) {
    throw new Error(t("windowInvalid"));
  }

  const breakWindow = value.morningBreak;
  if (!breakWindow || !validTime.test(breakWindow.start) || !validTime.test(breakWindow.end)) {
    throw new Error(t("windowInvalid"));
  }

  if (!validTime.test(value.endOfDayStart ?? "")) throw new Error(t("endOfDayInvalid"));
  if (!Number.isInteger(value.pauseMaximumMinutes) || (value.pauseMaximumMinutes ?? 0) < 1) {
    throw new Error(t("pauseMaximumInvalid"));
  }

  const snoozeMinutes = typeof value.snoozeMinutes === "number" && Number.isInteger(value.snoozeMinutes) && value.snoozeMinutes >= 1
    ? value.snoozeMinutes
    : 15;

  const stoppedMaximumMinutes = typeof value.stoppedMaximumMinutes === "number" && Number.isInteger(value.stoppedMaximumMinutes) && value.stoppedMaximumMinutes >= 1
    ? value.stoppedMaximumMinutes
    : 15;

  const stoppedPendingMinutes = typeof value.stoppedPendingMinutes === "number" && Number.isInteger(value.stoppedPendingMinutes) && value.stoppedPendingMinutes >= 0
    ? value.stoppedPendingMinutes
    : 30;

  if (!value.enabled || typeof value.enabled !== "object") {
    throw new Error(t("enabledInvalid"));
  }

  const enabledObj = value.enabled as Record<string, unknown>;
  for (const key of ["morningStart", "morningBreak", "pauseOverdue", "endOfDay"] as const) {
    if (typeof enabledObj[key] !== "boolean") {
      throw new Error(t("enabledInvalid"));
    }
  }
  if (enabledObj.maximumWork !== undefined && typeof enabledObj.maximumWork !== "boolean") {
    throw new Error(t("enabledInvalid"));
  }
  if (enabledObj.stoppedPending !== undefined && typeof enabledObj.stoppedPending !== "boolean") {
    throw new Error(t("enabledInvalid"));
  }

  return {
    version: 1,
    tenant: value.tenant,
    userId: value.userId,
    timeZone: value.timeZone,
    reminderIntervalSeconds: intervalSeconds!,
    morningStart,
    morningBreak: { start: breakWindow.start, end: breakWindow.end },
    pauseMaximumMinutes: value.pauseMaximumMinutes!,
    endOfDayStart: value.endOfDayStart!,
    snoozeMinutes,
    stoppedMaximumMinutes,
    stoppedPendingMinutes,
    enabled: {
      morningStart: Boolean(value.enabled.morningStart),
      morningBreak: Boolean(value.enabled.morningBreak),
      pauseOverdue: Boolean(value.enabled.pauseOverdue),
      endOfDay: Boolean(value.enabled.endOfDay),
      maximumWork: enabledObj.maximumWork !== undefined ? Boolean(enabledObj.maximumWork) : Boolean(value.enabled.endOfDay),
      stoppedPending: enabledObj.stoppedPending !== undefined ? Boolean(enabledObj.stoppedPending) : true
    }
  };
}
