import { defaultConfig, validateConfig, type ReminderConfig } from "./config.js";
import { BizneoClient } from "./client.js";
import type { ParsedChrono } from "./parser/chrono.js";
import { t } from "./i18n.js";
import { evaluateReminders, type ReminderRule, type ReminderSnapshot } from "./reminders.js";

const ALARM_NAME = "bizneo-reminder-check";
const STORAGE_KEY = "reminderConfig";
const STATE_KEY = "reminderRuntime";

interface RuntimeState {
  pauseStartedAt?: string;
  stoppedStartedAt?: string;
  lastNotified?: Partial<Record<string, string>>;
  snoozedUntil?: Partial<Record<string, string>>;
  lastCheckAt?: string;
  lastStatus?: string;
  lastLoggedMinutes?: number;
  activeRules?: string[];
  lastError?: string;
}

interface CheckResult {
  ok: boolean;
  checkedAt: string;
  status?: string;
  loggedMinutes?: number;
  activeRules?: string[];
  chrono?: ParsedChrono;
  error?: string;
}

function ruleToAction(rule: ReminderRule): "checkIn" | "pause" | "resume" | "checkOut" | undefined {
  switch (rule) {
    case "morningStart":
    case "stoppedPending": return "checkIn";
    case "morningBreak": return "pause";
    case "pauseOverdue": return "resume";
    case "endOfDay":
    case "maximumWork": return "checkOut";
    default: return undefined;
  }
}

function actionButtonTitle(rule: ReminderRule): string {
  switch (rule) {
    case "morningStart":
    case "stoppedPending": return t("actionCheckIn");
    case "morningBreak": return t("actionPause");
    case "pauseOverdue": return t("actionResume");
    case "endOfDay":
    case "maximumWork": return t("actionCheckOut");
    default: return t("start");
  }
}

function parseNotificationRule(notificationId: string): ReminderRule | undefined {
  if (!notificationId.startsWith("bizneo-")) return undefined;
  const parts = notificationId.slice("bizneo-".length).split("-");
  return parts[0] as ReminderRule;
}

function getAllNotifications(): Promise<Record<string, unknown>> {
  return new Promise(resolve => {
    chrome.notifications.getAll(notifications => {
      resolve((notifications ?? {}) as Record<string, unknown>);
    });
  });
}

function clearNotification(notificationId: string): Promise<boolean> {
  return new Promise(resolve => {
    chrome.notifications.clear(notificationId, wasCleared => {
      resolve(Boolean(wasCleared));
    });
  });
}

function createNotification(notificationId: string, options: chrome.notifications.NotificationOptions<true>): Promise<string> {
  return new Promise(resolve => {
    chrome.notifications.create(notificationId, options, id => {
      resolve(id ?? notificationId);
    });
  });
}

async function clearNotificationsWithPrefix(prefix: string): Promise<void> {
  const all = await getAllNotifications();
  for (const id of Object.keys(all)) {
    if (id === prefix || id.startsWith(`${prefix}-`)) {
      await clearNotification(id);
    }
  }
}

async function loadConfig(): Promise<ReminderConfig> {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  if (!stored) return defaultConfig();
  return validateConfig(stored);
}

async function loadRuntime(): Promise<RuntimeState> {
  return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] ?? {};
}

async function checkReminders(force = false): Promise<CheckResult> {
  const config = await loadConfig();
  const checkedAt = new Date().toISOString();
  if (!config.tenant || !config.userId) {
    return { ok: false, checkedAt, error: t("configBeforeQuery") };
  }

  const runtime = await loadRuntime();
  try {
    const chrono = await new BizneoClient(config).fetchChrono();
    const now = new Date();
    if (chrono.status === "paused" && !runtime.pauseStartedAt) runtime.pauseStartedAt = now.toISOString();
    if (chrono.status !== "paused") delete runtime.pauseStartedAt;
    if (chrono.status === "stopped" && (chrono.loggedMinutes ?? 0) > 0) {
      if (!runtime.stoppedStartedAt) runtime.stoppedStartedAt = now.toISOString();
    } else {
      delete runtime.stoppedStartedAt;
    }
    const snapshot: ReminderSnapshot = {
      status: chrono.status,
      loggedMinutes: chrono.loggedMinutes ?? 0,
      scheduledMinutes: chrono.scheduledMinutes,
      isExceeded: chrono.isExceeded,
      pauseStartedAt: runtime.pauseStartedAt ? new Date(runtime.pauseStartedAt) : undefined,
      stoppedStartedAt: runtime.stoppedStartedAt ? new Date(runtime.stoppedStartedAt) : undefined
    };
    const active = evaluateReminders(config, snapshot, now);
    const nextNotifications = { ...runtime.lastNotified };
    const nextSnoozed = { ...runtime.snoozedUntil };

    for (const reminder of active) {
      const snoozedAt = nextSnoozed[reminder.rule];
      if (snoozedAt) {
        if (now.getTime() < new Date(snoozedAt).getTime()) {
          continue;
        }
        delete nextSnoozed[reminder.rule];
      }
      const last = nextNotifications[reminder.rule];
      const minIntervalMs = Math.max(10000, config.reminderIntervalSeconds * 1000 - 5000);
      const due = force || !last || (now.getTime() - new Date(last).getTime()) >= minIntervalMs;
      if (!due) continue;

      const actionTitle = actionButtonTitle(reminder.rule);
      const snoozeTitle = t("snoozeButton", String(config.snoozeMinutes));

      const prefix = `bizneo-${reminder.rule}`;
      await clearNotificationsWithPrefix(prefix);

      const notificationId = `${prefix}-${now.getTime()}`;
      await createNotification(notificationId, {
        type: "basic",
        iconUrl: "res/icons/icon.png",
        title: reminder.title,
        message: reminder.message,
        priority: 2,
        requireInteraction: true,
        buttons: [
          { title: actionTitle },
          { title: snoozeTitle }
        ]
      });
      nextNotifications[reminder.rule] = now.toISOString();
    }
    const activeRules = new Set(active.map(reminder => reminder.rule));
    for (const rule of Object.keys(nextNotifications) as ReminderRule[]) {
      if (!activeRules.has(rule)) {
        delete nextNotifications[rule];
        delete nextSnoozed[rule];
        await clearNotificationsWithPrefix(`bizneo-${rule}`);
      }
    }
    const result: CheckResult = {
      ok: true,
      checkedAt: now.toISOString(),
      status: chrono.status,
      loggedMinutes: snapshot.loggedMinutes,
      activeRules: active.map(reminder => reminder.rule),
      chrono
    };
    await chrome.storage.local.set({ [STATE_KEY]: {
      pauseStartedAt: runtime.pauseStartedAt,
      stoppedStartedAt: runtime.stoppedStartedAt,
      lastNotified: nextNotifications,
      snoozedUntil: nextSnoozed,
      lastCheckAt: result.checkedAt,
      lastStatus: result.status,
      lastLoggedMinutes: result.loggedMinutes,
      activeRules: result.activeRules,
      lastError: undefined
    } });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await chrome.storage.local.set({ [STATE_KEY]: { ...runtime, lastCheckAt: checkedAt, lastError: message } });
    return { ok: false, checkedAt, error: message };
  }
}

async function schedule(): Promise<void> {
  const config = await loadConfig();
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: Math.max(0.5, config.reminderIntervalSeconds / 60) });
}

chrome.runtime.onInstalled.addListener(() => { void schedule(); });
chrome.runtime.onStartup.addListener(() => { void schedule(); });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM_NAME) void checkReminders(); });

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  const rule = parseNotificationRule(notificationId);
  if (!rule) return;
  const config = await loadConfig();

  if (buttonIndex === 0) {
    const action = ruleToAction(rule);
    if (action) {
      try {
        await new BizneoClient(config).performChrono(action);
      } catch (e) {
        console.error("Failed to perform chrono action from notification:", e);
      }
    }
    await chrome.notifications.clear(notificationId);
    void checkReminders();
  } else if (buttonIndex === 1) {
    const runtime = await loadRuntime();
    const snoozedUntil = { ...runtime.snoozedUntil };
    snoozedUntil[rule] = new Date(Date.now() + config.snoozeMinutes * 60000).toISOString();
    await chrome.storage.local.set({ [STATE_KEY]: { ...runtime, snoozedUntil } });
    await chrome.notifications.clear(notificationId);
  }
});

chrome.notifications.onClicked.addListener(async notificationId => {
  if (!notificationId.startsWith("bizneo-")) return;
  const config = await loadConfig();
  if (config.tenant) {
    await chrome.tabs.create({ url: `https://${config.tenant}.bizneohr.com/` });
  }
  await chrome.notifications.clear(notificationId);
});

chrome.runtime.onMessage.addListener((message: { type?: string; action?: string }, _sender, sendResponse) => {
  if (message.type === "check-now") {
    void checkReminders(true).then(sendResponse).catch(error => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message.type === "config-changed") {
    void schedule().then(() => sendResponse({ ok: true })).catch(error => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (message.type === "chrono-action") {
    const action = message.action as "checkIn" | "pause" | "resume" | "checkOut" | undefined;
    if (!action) {
      sendResponse({ ok: false, error: t("invalidAction") });
      return false;
    }
    void loadConfig().then(config => new BizneoClient(config).performChrono(action))
      .then(chrono => sendResponse({ ok: true, chrono }))
      .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }
  return false;
});
