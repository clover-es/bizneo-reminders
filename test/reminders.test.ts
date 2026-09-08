import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { evaluateReminders } from "../src/reminders.js";

const madrid = (hour: number, minute: number): Date => new Date(Date.UTC(2026, 8, 7, hour - 2, minute));

describe("evaluateReminders", () => {
  it("reminds about missing morning check-in inside the configured window", () => {
    const result = evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0 }, madrid(9, 0));
    expect(result.map(item => item.rule)).toEqual(["morningStart"]);
  });

  it("does not remind after the morning window", () => {
    const result = evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0 }, madrid(10, 1));
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

  it("uses a strict greater-than comparison for the pause threshold", () => {
    const now = madrid(15, 0);
    expect(evaluateReminders(defaultConfig(), { status: "paused", loggedMinutes: 240, pauseStartedAt: new Date(now.getTime() - 55 * 60000) }, now)).toEqual([]);
    expect(evaluateReminders(defaultConfig(), { status: "paused", loggedMinutes: 240, pauseStartedAt: new Date(now.getTime() - 56 * 60000) }, now).map(item => item.rule)).toEqual(["pauseOverdue"]);
  });

  it("reminds to finish at the configured end time while still active", () => {
    const result = evaluateReminders(defaultConfig(), { status: "working", loggedMinutes: 420 }, madrid(17, 0));
    expect(result.map(item => item.rule)).toEqual(["endOfDay"]);
  });

  it("reminds at the maximum work duration even before the end-of-day window", () => {
    const result = evaluateReminders(defaultConfig(), { status: "working", loggedMinutes: 480 }, madrid(16, 0));
    expect(result.map(item => item.rule)).toEqual(["endOfDay"]);
  });

  it("does not remind on a configured non-working day", () => {
    const result = evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0 }, madrid(9, 0));
    expect(result).toHaveLength(1);
    const sunday = new Date(Date.UTC(2026, 8, 6, 7, 0));
    expect(evaluateReminders(defaultConfig(), { status: "stopped", loggedMinutes: 0 }, sunday)).toEqual([]);
  });
});
