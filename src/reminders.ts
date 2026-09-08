import type { ReminderConfig, TimeWindow } from "./config.js";
import { t } from "./i18n.js";

export type ChronoStatus = "stopped" | "working" | "paused" | "unknown";
export type ReminderRule = "morningStart" | "morningBreak" | "pauseOverdue" | "endOfDay";

export interface ReminderSnapshot {
  status: ChronoStatus;
  loggedMinutes: number;
  pauseStartedAt?: Date;
  isDayOff?: boolean;
}

export interface ActiveReminder {
  rule: ReminderRule;
  title: string;
  message: string;
}

function minutesSinceMidnight(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const hour = Number(parts.find(part => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find(part => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function weekday(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

function timeValue(time: string): number {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function insideWindow(now: number, window: TimeWindow): boolean {
  const start = timeValue(window.start);
  const end = timeValue(window.end);
  return now >= start && now <= end;
}

export function evaluateReminders(config: ReminderConfig, snapshot: ReminderSnapshot, now: Date): ActiveReminder[] {
  if (snapshot.isDayOff || !config.workingDays.includes(weekday(now, config.timeZone))) return [];
  const currentMinutes = minutesSinceMidnight(now, config.timeZone);
  const reminders: ActiveReminder[] = [];

  if (config.enabled.morningStart && insideWindow(currentMinutes, config.morningStart)
      && snapshot.status === "stopped" && snapshot.loggedMinutes === 0) {
    reminders.push({ rule: "morningStart", title: t("checkInReminderTitle"), message: t("checkInReminderMessage") });
  }
  if (config.enabled.morningBreak && insideWindow(currentMinutes, config.morningBreak)
      && snapshot.status === "working") {
    reminders.push({ rule: "morningBreak", title: t("breakReminderTitle"), message: t("breakReminderMessage") });
  }
  if (config.enabled.pauseOverdue && snapshot.status === "paused" && snapshot.pauseStartedAt
      && (now.getTime() - snapshot.pauseStartedAt.getTime()) / 60000 > config.pauseMaximumMinutes) {
    reminders.push({ rule: "pauseOverdue", title: t("pauseOverdueTitle"), message: t("pauseOverdueMessage", String(config.pauseMaximumMinutes)) });
  }
  if (config.enabled.endOfDay && (currentMinutes >= timeValue(config.endOfDayStart)
      || snapshot.loggedMinutes >= config.maximumWorkMinutes)
      && (snapshot.status === "working" || snapshot.status === "paused")
      ) {
    reminders.push({ rule: "endOfDay", title: t("endOfDayTitle"), message: t("endOfDayMessage") });
  }
  return reminders;
}
