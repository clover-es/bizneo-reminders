import { describe, expect, it } from "vitest";
import { parseChrono } from "../src/parser/chrono.js";
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
});
