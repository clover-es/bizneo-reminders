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
  lastNotified?: Partial<Record<string, string>>;
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

async function loadConfig(): Promise<ReminderConfig> {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  if (!stored) return defaultConfig();
  return validateConfig(stored);
}

async function loadRuntime(): Promise<RuntimeState> {
  return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] ?? {};
}

async function checkReminders(): Promise<CheckResult> {
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
    const snapshot: ReminderSnapshot = {
      status: chrono.status,
      loggedMinutes: chrono.loggedMinutes ?? 0,
      pauseStartedAt: runtime.pauseStartedAt ? new Date(runtime.pauseStartedAt) : undefined
    };
    const active = evaluateReminders(config, snapshot, now);
    const nextNotifications = { ...runtime.lastNotified };
    for (const reminder of active) {
      const last = nextNotifications[reminder.rule];
      const due = !last || now.getTime() - new Date(last).getTime() >= config.reminderIntervalSeconds * 1000;
      if (!due) continue;
      await chrome.notifications.create(`bizneo-${reminder.rule}`, {
        type: "basic",
        iconUrl: "res/icons/icon.png",
        title: reminder.title,
        message: reminder.message,
        priority: 2,
        buttons: [{ title: t("openBizneo") }]
      });
      nextNotifications[reminder.rule] = now.toISOString();
    }
    const activeRules = new Set(active.map(reminder => reminder.rule));
    for (const rule of Object.keys(nextNotifications) as ReminderRule[]) {
      if (!activeRules.has(rule)) delete nextNotifications[rule];
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
      lastNotified: nextNotifications,
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
chrome.notifications.onButtonClicked.addListener(() => {
  void loadConfig().then(config => chrome.tabs.create({ url: `https://${config.tenant}.bizneohr.com/` }));
});
chrome.runtime.onMessage.addListener((message: { type?: string; action?: string }, _sender, sendResponse) => {
  if (message.type === "check-now") {
    void checkReminders().then(sendResponse).catch(error => sendResponse({ ok: false, error: String(error) }));
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
