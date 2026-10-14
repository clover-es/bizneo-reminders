import { describe, expect, it } from "vitest";
import { parseChrono, parseBizneoDate } from "../src/parser/chrono.js";
import { defaultConfig, validateConfig } from "../src/config.js";

describe("parseChrono", () => {
  it("recognizes stopped, working and paused forms", () => {
    const stopped = `
      <div id="chronometer-wrapper"><form id="chrono-form-default_chrono" hx-post="/chrono">
        <input name="_csrf_token" value="token"><input name="user_id" value="42">
        <input name="shift_id" value="shift_123"><b>0:00</b>
      </form></div>`;
    const stoppedParsed = parseChrono(stopped);
    expect(stoppedParsed.status).toBe("stopped");
    expect(stoppedParsed.chronoId).toBeUndefined();
    expect(stoppedParsed.shiftId).toBe("shift_123");
    expect(stoppedParsed.formId).toBe("chrono-form-default_chrono");

    const working = `
      <div id="chronometer-wrapper"><form id="chrono-form-default_chrono" hx-put="/chrono/42">
        <input name="_csrf_token" value="token"><input name="shift_id" value="shift_123">
        <input type="hidden" name="kind" value="rest"><span data-timer data-from="2026-09-07 08:00:00"></span>
        <button type="submit" name="pause" value="pause_123" data-gtm-action="chrono pause">Comida</button>
        <div id="dropdown-tooltip"><dd>8:00</dd><dd>4:30</dd></div>
      </form></div>`;
    const workingParsed = parseChrono(working);
    expect(workingParsed.status).toBe("working");
    expect(workingParsed.chronoId).toBe("pause_123");
    expect(workingParsed.shiftId).toBe("shift_123");
    expect(workingParsed.formId).toBe("chrono-form-default_chrono");
    expect(workingParsed.loggedMinutes).toBe(270);
    expect(workingParsed.scheduledMinutes).toBe(480);

    const paused = `
      <div id="chronometer-wrapper"><form id="chrono-form-hub_chrono" hx-put="/chrono/42">
        <input type="hidden" name="kind" value="working_time"><button type="submit" name="pause" value="pause_123">Pause</button><input name="shift_id" value="shift_123">
        <span data-timer data-from="2026-09-07 08:00:00"></span>
      </form></div>`;
    const pausedParsed = parseChrono(paused);
    expect(pausedParsed.status).toBe("paused");
    expect(pausedParsed.chronoId).toBe("pause_123");
    expect(pausedParsed.shiftId).toBe("shift_123");
    expect(pausedParsed.formId).toBe("chrono-form-hub_chrono");
  });

  it("accepts arbitrary reminder intervals in seconds and migrates old minutes", () => {
    expect(validateConfig({ ...defaultConfig(), reminderIntervalSeconds: 37 }).reminderIntervalSeconds).toBe(37);
    const legacy = { ...defaultConfig(), reminderIntervalMinutes: 2 } as Record<string, unknown>;
    delete legacy.reminderIntervalSeconds;
    expect(validateConfig(legacy).reminderIntervalSeconds).toBe(120);
    expect(() => validateConfig({ ...defaultConfig(), reminderIntervalSeconds: 29 })).toThrow();
  });

  it("migrates legacy configs with workingDays and maximumWorkMinutes cleanly", () => {
    const legacyConfig = {
      ...defaultConfig(),
      workingDays: [1, 2, 3, 4, 5],
      maximumWorkMinutes: 480
    } as Record<string, unknown>;
    const migrated = validateConfig(legacyConfig) as unknown as Record<string, unknown>;
    expect(migrated.workingDays).toBeUndefined();
    expect(migrated.maximumWorkMinutes).toBeUndefined();
    expect(migrated.pauseMaximumMinutes).toBe(60);
  });

  it("migrates legacy morningStart range and sets defaults for snoozeMinutes, maximumWork, and stoppedPending", () => {
    const legacyConfig = {
      ...defaultConfig(),
      morningStart: { start: "08:30", end: "10:00" }
    } as Record<string, unknown>;
    delete legacyConfig.snoozeMinutes;
    delete legacyConfig.stoppedMaximumMinutes;
    delete legacyConfig.stoppedPendingMinutes;
    (legacyConfig.enabled as Record<string, unknown>).maximumWork = undefined;
    (legacyConfig.enabled as Record<string, unknown>).stoppedPending = undefined;

    const migrated = validateConfig(legacyConfig);
    expect(migrated.morningStart).toBe("08:30");
    expect(migrated.snoozeMinutes).toBe(15);
    expect(migrated.stoppedMaximumMinutes).toBe(15);
    expect(migrated.stoppedPendingMinutes).toBe(30);
    expect(migrated.enabled.maximumWork).toBe(true);
    expect(migrated.enabled.stoppedPending).toBe(true);
  });

  it("parses Bizneo date formats accurately", () => {
    const d1 = parseBizneoDate("2026-9-7 17:47:26");
    expect(d1?.getFullYear()).toBe(2026);
    expect(d1?.getMonth()).toBe(8);
    expect(d1?.getDate()).toBe(7);
    expect(d1?.getHours()).toBe(17);
    expect(d1?.getMinutes()).toBe(47);
    expect(d1?.getSeconds()).toBe(26);

    const d2 = parseBizneoDate("2026-09-07 08:00:00");
    expect(d2?.getHours()).toBe(8);

    expect(parseBizneoDate(undefined)).toBeUndefined();
    expect(parseBizneoDate("invalid-date")).toBeUndefined();
  });

  it("detects day-off and zero scheduled hours", () => {
    const zeroHoursHtml = `
      <div id="chronometer-wrapper"><form id="chrono-form-default_chrono" hx-post="/chrono">
        <input name="_csrf_token" value="dummy_token"><input name="user_id" value="user_42">
        <input name="shift_id" value="shift_123">
        <div id="dropdown-tooltip"><dd>0:00</dd><dd>0:00</dd></div>
      </form></div>`;
    const zeroParsed = parseChrono(zeroHoursHtml);
    expect(zeroParsed.status).toBe("stopped");
    expect(zeroParsed.scheduledMinutes).toBe(0);
    expect(zeroParsed.isDayOff).toBe(true);

    const dashHoursHtml = `
      <div id="chronometer-wrapper"><form id="chrono-form-default_chrono" hx-post="/chrono">
        <input name="_csrf_token" value="dummy_token"><input name="user_id" value="user_42">
        <div id="dropdown-tooltip"><dd>-</dd><dd>-</dd></div>
      </form></div>`;
    const dashParsed = parseChrono(dashHoursHtml);
    expect(dashParsed.scheduledMinutes).toBe(0);
    expect(dashParsed.isDayOff).toBe(true);

    const stoppedChronoHtml = `
      <div id="chronometer-wrapper"><form id="chrono-form-hub_chrono" hx-post="/chrono">
        <input name="_csrf_token" value="dummy_token"><input name="user_id" value="user_42">
        <input type="hidden" name="shift_id" value="">
        <div id="time-row"><span class="timer-time-hours-minutes">00:00</span></div>
      </form></div>`;
    const stoppedParsed = parseChrono(stoppedChronoHtml);
    expect(stoppedParsed.status).toBe("stopped");
    expect(stoppedParsed.shiftId).toBeUndefined();
    expect(stoppedParsed.scheduledMinutes).toBeUndefined();
    expect(stoppedParsed.loggedMinutes).toBe(0);
    expect(stoppedParsed.isDayOff).toBeUndefined();
  });
});
