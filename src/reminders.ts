import type { ReminderConfig, TimeWindow } from "./config.js";
import { t } from "./i18n.js";

export type ChronoStatus = "stopped" | "working" | "paused" | "unknown";
export type ReminderRule = "morningStart" | "morningBreak" | "pauseOverdue" | "endOfDay" | "maximumWork" | "stoppedPending";

export interface ReminderSnapshot {
  status: ChronoStatus;
  loggedMinutes: number;
  scheduledMinutes?: number;
  isExceeded?: boolean;
  pauseStartedAt?: Date;
  stoppedStartedAt?: Date;
  isDayOff?: boolean;
  breakDoneToday?: boolean;
}

export interface ActiveReminder {
  rule: ReminderRule;
  title: string;
  message: string;
}

export function minutesSinceMidnight(date: Date, timeZone: string): number {
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

export function getLocalDateString(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function timeValue(time: string): number {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function getDayOfWeek(date: Date, timeZone: string): number {
  const weekdayStr = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const days: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };
  return days[weekdayStr] ?? date.getDay();
}

export function insideWindow(now: number, window: TimeWindow): boolean {
  const start = timeValue(window.start);
  const end = timeValue(window.end);
  return now >= start && now <= end;
}

function formatHM(minutes: number): string {
  const h = Math.floor(Math.max(0, minutes) / 60);
  const m = Math.max(0, minutes) % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function evaluateReminders(config: ReminderConfig, snapshot: ReminderSnapshot, now: Date): ActiveReminder[] {
  const dayOfWeek = getDayOfWeek(now, config.timeZone);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const hasScheduledWork = snapshot.scheduledMinutes !== undefined && snapshot.scheduledMinutes > 0;

  if (snapshot.isDayOff || (snapshot.scheduledMinutes !== undefined && snapshot.scheduledMinutes <= 0) || (isWeekend && !hasScheduledWork)) {
    return [];
  }
  const currentMinutes = minutesSinceMidnight(now, config.timeZone);
  const reminders: ActiveReminder[] = [];

  if (config.enabled.morningStart && currentMinutes >= timeValue(config.morningStart)
      && snapshot.status === "stopped" && snapshot.loggedMinutes === 0) {
    reminders.push({ rule: "morningStart", title: t("checkInReminderTitle"), message: t("checkInReminderMessage") });
  }
  if (config.enabled.morningBreak && insideWindow(currentMinutes, config.morningBreak)
      && snapshot.status === "working" && !snapshot.breakDoneToday) {
    reminders.push({ rule: "morningBreak", title: t("breakReminderTitle"), message: t("breakReminderMessage") });
  }
  if (config.enabled.pauseOverdue && snapshot.status === "paused" && snapshot.pauseStartedAt
      && (now.getTime() - snapshot.pauseStartedAt.getTime()) / 60000 > config.pauseMaximumMinutes) {
    reminders.push({ rule: "pauseOverdue", title: t("pauseOverdueTitle"), message: t("pauseOverdueMessage", String(config.pauseMaximumMinutes)) });
  }
  if (config.enabled.endOfDay && currentMinutes >= timeValue(config.endOfDayStart)
      && (snapshot.status === "working" || snapshot.status === "paused")
      ) {
    reminders.push({ rule: "endOfDay", title: t("endOfDayTitle"), message: t("endOfDayMessage") });
  }
  const reachedScheduled = Boolean(snapshot.isExceeded)
    || (snapshot.scheduledMinutes !== undefined && snapshot.scheduledMinutes > 0 && snapshot.loggedMinutes >= snapshot.scheduledMinutes);
  if (config.enabled.maximumWork && reachedScheduled
      && (snapshot.status === "working" || snapshot.status === "paused")
      ) {
    reminders.push({ rule: "maximumWork", title: t("maximumWorkTitle"), message: t("maximumWorkMessage") });
  }
  const pendingMinutes = (snapshot.scheduledMinutes !== undefined && snapshot.scheduledMinutes > 0)
    ? snapshot.scheduledMinutes - snapshot.loggedMinutes
    : 0;
  if (config.enabled.stoppedPending
      && snapshot.status === "stopped"
      && snapshot.loggedMinutes > 0
      && !snapshot.isExceeded
      && pendingMinutes >= config.stoppedPendingMinutes
      && snapshot.stoppedStartedAt
      && (now.getTime() - snapshot.stoppedStartedAt.getTime()) / 60000 > config.stoppedMaximumMinutes) {
    reminders.push({ rule: "stoppedPending", title: t("stoppedPendingTitle"), message: t("stoppedPendingMessage", formatHM(pendingMinutes)) });
  }
  return reminders;
}
