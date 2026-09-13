import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { evaluateReminders, getLocalDateString, getDayOfWeek } from "../src/reminders.js";

const madrid = (hour: number, minute: number): Date => new Date(Date.UTC(2026, 8, 7, hour - 2, minute));

describe("evaluateReminders", () => {
  it("reminds about missing morning check-in after the configured start time", () => {
    const result = evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0 }, madrid(9, 0));
    expect(result.map(item => item.rule)).toEqual(["morningStart"]);
  });

  it("does not remind before the morning start time", () => {
    const result = evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0 }, madrid(7, 59));
    expect(result).toEqual([]);
  });

  it("does not treat a finished earlier session as a missing morning check-in", () => {
    const result = evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 240 }, madrid(9, 0));
    expect(result).toEqual([]);
  });

  it("reminds for the unfinished midday break", () => {
    const result = evaluateReminders(defaultConfig(), { status: "working", loggedMinutes: 240 }, madrid(14, 0));
    expect(result.map(item => item.rule)).toEqual(["morningBreak"]);
  });

  it("does not remind for midday break when already done today", () => {
    const result = evaluateReminders(defaultConfig(), { status: "working", loggedMinutes: 240, breakDoneToday: true }, madrid(14, 0));
    expect(result).toEqual([]);
  });

  it("uses a strict greater-than comparison for the pause threshold", () => {
    const now = madrid(15, 0);
    expect(evaluateReminders(defaultConfig(), { status: "paused", loggedMinutes: 240, pauseStartedAt: new Date(now.getTime() - 60 * 60000) }, now)).toEqual([]);
    expect(evaluateReminders(defaultConfig(), { status: "paused", loggedMinutes: 240, pauseStartedAt: new Date(now.getTime() - 61 * 60000) }, now).map(item => item.rule)).toEqual(["pauseOverdue"]);
  });

  it("reminds to finish at the configured end time while still active", () => {
    const result = evaluateReminders(defaultConfig(), { status: "working", loggedMinutes: 420 }, madrid(18, 0));
    expect(result.map(item => item.rule)).toEqual(["endOfDay"]);
  });

  it("reminds when reaching the scheduled work duration even before the end-of-day window", () => {
    const result = evaluateReminders(defaultConfig(), { status: "working", loggedMinutes: 480, scheduledMinutes: 480 }, madrid(16, 0));
    expect(result.map(item => item.rule)).toEqual(["maximumWork"]);
  });

  it("reminds when workday is marked as exceeded even before the end-of-day window", () => {
    const result = evaluateReminders(defaultConfig(), { status: "working", loggedMinutes: 400, isExceeded: true }, madrid(16, 0));
    expect(result.map(item => item.rule)).toEqual(["maximumWork"]);
  });

  it("allows independently toggling endOfDay and maximumWork reminders", () => {
    const bothConfig = defaultConfig();
    const noMaxConfig = { ...defaultConfig(), enabled: { ...defaultConfig().enabled, maximumWork: false } };
    const noEndConfig = { ...defaultConfig(), enabled: { ...defaultConfig().enabled, endOfDay: false } };

    const snapshot = { status: "working" as const, loggedMinutes: 480, scheduledMinutes: 480 };
    expect(evaluateReminders(bothConfig, snapshot, madrid(18, 30)).map(item => item.rule)).toEqual(["endOfDay", "maximumWork"]);
    expect(evaluateReminders(noMaxConfig, snapshot, madrid(18, 30)).map(item => item.rule)).toEqual(["endOfDay"]);
    expect(evaluateReminders(noEndConfig, snapshot, madrid(18, 30)).map(item => item.rule)).toEqual(["maximumWork"]);
  });

  it("does not remind when day off or scheduledMinutes is 0", () => {
    const resultWorking = evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0, scheduledMinutes: 480 }, madrid(9, 0));
    expect(resultWorking).toHaveLength(1);

    const zeroScheduled = evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0, scheduledMinutes: 0 }, madrid(9, 0));
    expect(zeroScheduled).toEqual([]);

    const dayOff = evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0, isDayOff: true }, madrid(9, 0));
    expect(dayOff).toEqual([]);
  });

  it("reminds when stopped with pending workday after the stopped threshold", () => {
    const now = madrid(15, 0);
    const snapshot15 = {
      status: "stopped" as const,
      loggedMinutes: 240,
      scheduledMinutes: 480,
      stoppedStartedAt: new Date(now.getTime() - 15 * 60000)
    };
    expect(evaluateReminders(defaultConfig(), snapshot15, now)).toEqual([]);

    const snapshot16 = {
      ...snapshot15,
      stoppedStartedAt: new Date(now.getTime() - 16 * 60000)
    };
    const active = evaluateReminders(defaultConfig(), snapshot16, now);
    expect(active.map(item => item.rule)).toEqual(["stoppedPending"]);
    expect(active[0]?.message).toContain("04:00");

    const snapshotNearlyDone = {
      ...snapshot16,
      loggedMinutes: 460
    };
    expect(evaluateReminders(defaultConfig(), snapshotNearlyDone, now)).toEqual([]);

    const disabledConfig = { ...defaultConfig(), enabled: { ...defaultConfig().enabled, stoppedPending: false } };
    expect(evaluateReminders(disabledConfig, snapshot16, now)).toEqual([]);
  });

  it("does not remind on weekends unless a shift is scheduled", () => {
    const sat = (h: number, m: number) => new Date(Date.UTC(2026, 8, 12, h - 2, m));
    const sun = (h: number, m: number) => new Date(Date.UTC(2026, 8, 13, h - 2, m));

    // Saturday with no scheduled shift or 0 hours -> no reminder
    expect(evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0 }, sat(9, 0))).toEqual([]);
    expect(evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0, scheduledMinutes: 0 }, sat(9, 0))).toEqual([]);

    // Sunday with no scheduled shift or 0 hours -> no reminder
    expect(evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0 }, sun(9, 0))).toEqual([]);
    expect(evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0, scheduledMinutes: 0 }, sun(9, 0))).toEqual([]);

    // Weekend WITH scheduled work -> reminders should evaluate normally
    const satWithShift = evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0, scheduledMinutes: 240 }, sat(9, 0));
    expect(satWithShift.map(item => item.rule)).toEqual(["morningStart"]);
  });

  it("calculates day of the week accurately respecting time zones", () => {
    // 2026-09-07 is Monday, 2026-09-12 is Saturday, 2026-09-13 is Sunday
    expect(getDayOfWeek(new Date(Date.UTC(2026, 8, 7, 12, 0)), "Europe/Madrid")).toBe(1); // Monday
    expect(getDayOfWeek(new Date(Date.UTC(2026, 8, 12, 12, 0)), "Europe/Madrid")).toBe(6); // Saturday
    expect(getDayOfWeek(new Date(Date.UTC(2026, 8, 13, 12, 0)), "Europe/Madrid")).toBe(0); // Sunday

    // Boundary test: Sunday 23:30 UTC is Monday 01:30 in Europe/Madrid (+2 in summer)
    const lateSundayUtc = new Date(Date.UTC(2026, 8, 13, 23, 30));
    expect(getDayOfWeek(lateSundayUtc, "Europe/Madrid")).toBe(1); // Monday in Madrid
    expect(getDayOfWeek(lateSundayUtc, "UTC")).toBe(0); // Sunday in UTC
  });

  it("formats local date string as YYYY-MM-DD", () => {
    const d = new Date(Date.UTC(2026, 8, 10, 12, 0, 0));
    expect(getLocalDateString(d, "Europe/Madrid")).toBe("2026-09-10");
  });
});
