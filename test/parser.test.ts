import { describe, expect, it } from "vitest";
import { parseChrono } from "../src/parser/chrono.js";
import { defaultConfig, validateConfig } from "../src/config.js";

describe("parseChrono", () => {
  it("recognizes stopped, working and paused forms", () => {
    const stopped = `
      <div id="chronometer-wrapper"><form hx-post="/chrono">
        <input name="_csrf_token" value="token"><input name="user_id" value="42">
        <input name="shift_id" value="shift"><b>0:00</b>
      </form></div>`;
    expect(parseChrono(stopped).status).toBe("stopped");

    const working = `
      <div id="chronometer-wrapper"><form id="chrono-form" hx-put="/chrono/42">
        <input name="_csrf_token" value="token"><input name="shift_id" value="shift">
        <input name="kind" type="hidden" value="rest"><span data-timer data-from="2026-09-07 08:00:00"></span>
        <div id="dropdown-tooltip"><dd>8:00</dd><dd>4:30</dd></div>
      </form></div>`;
    expect(parseChrono(working).status).toBe("working");
    expect(parseChrono(working).loggedMinutes).toBe(270);

    const paused = `
      <div id="chronometer-wrapper"><form hx-put="/chrono/42">
        <input name="pause" value="99"><input name="shift_id" value="shift">
        <span data-timer data-from="2026-09-07 08:00:00"></span>
      </form></div>`;
    expect(parseChrono(paused).status).toBe("paused");
    expect(parseChrono(paused).chronoId).toBe("99");
  });

  it("accepts arbitrary reminder intervals in seconds and migrates old minutes", () => {
    expect(validateConfig({ ...defaultConfig(), reminderIntervalSeconds: 37 }).reminderIntervalSeconds).toBe(37);
    const legacy = { ...defaultConfig(), reminderIntervalMinutes: 2 } as Record<string, unknown>;
    delete legacy.reminderIntervalSeconds;
    expect(validateConfig(legacy).reminderIntervalSeconds).toBe(120);
    expect(() => validateConfig({ ...defaultConfig(), reminderIntervalSeconds: 29 })).toThrow();
  });
});
