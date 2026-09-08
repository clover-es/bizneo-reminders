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
  workingDays: number[];
  morningStart: TimeWindow;
  morningBreak: TimeWindow;
  pauseMaximumMinutes: number;
  endOfDayStart: string;
  maximumWorkMinutes: number;
  enabled: {
    morningStart: boolean;
    morningBreak: boolean;
    pauseOverdue: boolean;
    endOfDay: boolean;
  };
}

export const defaultConfig = (): ReminderConfig => ({
  version: 1,
  tenant: "",
  userId: "",
  timeZone: "Europe/Madrid",
  reminderIntervalSeconds: 600,
  workingDays: [1, 2, 3, 4, 5],
  morningStart: { start: "08:00", end: "10:00" },
  morningBreak: { start: "13:00", end: "15:00" },
  pauseMaximumMinutes: 55,
  endOfDayStart: "17:00",
  maximumWorkMinutes: 480,
  enabled: {
    morningStart: true,
    morningBreak: true,
    pauseOverdue: true,
    endOfDay: true
  }
});

const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateConfig(input: unknown): ReminderConfig {
  if (!input || typeof input !== "object") {
    throw new Error(t("configObject"));
  }
  const value = input as Partial<ReminderConfig>;
  if (value.version !== 1) throw new Error(t("unsupportedConfigVersion"));
  if (typeof value.tenant !== "string" || typeof value.userId !== "string") {
    throw new Error(t("tenantUserRequired"));
  }
  if (typeof value.timeZone !== "string" || !value.timeZone) {
    throw new Error(t("timeZoneRequired"));
  }
  const legacyMinutes = (value as { reminderIntervalMinutes?: unknown }).reminderIntervalMinutes;
  const intervalSeconds = value.reminderIntervalSeconds
    ?? (typeof legacyMinutes === "number" ? legacyMinutes * 60 : undefined);
  if (!Number.isInteger(intervalSeconds) || (intervalSeconds ?? 0) < 30) {
    throw new Error(t("intervalInvalid"));
  }
  if (!Array.isArray(value.workingDays) || value.workingDays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error(t("workingDaysInvalid"));
  }
  const windows = [value.morningStart, value.morningBreak];
  for (const window of windows) {
    if (!window || !validTime.test(window.start) || !validTime.test(window.end)) {
      throw new Error(t("windowInvalid"));
    }
  }
  if (!validTime.test(value.endOfDayStart ?? "")) throw new Error(t("endOfDayInvalid"));
  if (!Number.isInteger(value.pauseMaximumMinutes) || (value.pauseMaximumMinutes ?? 0) < 1) {
    throw new Error(t("pauseMaximumInvalid"));
  }
  if (!Number.isInteger(value.maximumWorkMinutes) || (value.maximumWorkMinutes ?? 0) < 1) {
    throw new Error(t("maximumWorkInvalid"));
  }
  if (!value.enabled || Object.values(value.enabled).some(flag => typeof flag !== "boolean")) {
    throw new Error(t("enabledInvalid"));
  }
  const config = structuredClone(value) as ReminderConfig;
  config.reminderIntervalSeconds = intervalSeconds!;
  return config;
}
