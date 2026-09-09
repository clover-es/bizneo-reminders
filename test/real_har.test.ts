import { describe, expect, it } from "vitest";
import { parseChrono } from "../src/parser/chrono.js";

// Synthetic HTML fixtures representing Bizneo chrono responses
const pausedHtml = `
<div id="chronometer-wrapper">
  <div class="hub-chrono card is-small warning">
    <form action="/chrono/42" method="post" id="chrono-form-hub_chrono" class="chronometer" hx-put="/chrono/42">
      <input type="hidden" name="shift_id" value="shift_999">
      <button type="submit" name="pause" value="pause_888" data-gtm-action="chrono stop rest">Reanudar</button>
      <div id="dropdown-tooltip">
        <dd>8:00</dd>
        <dd>8:24</dd>
      </div>
    </form>
  </div>
</div>`;

const workingHtml = `
<div id="chronometer-wrapper">
  <div class="hub-chrono card is-small">
    <form action="/chrono/42" method="post" id="chrono-form-default_chrono" class="chronometer" hx-put="/chrono/42">
      <input type="hidden" name="kind" value="rest">
      <input type="hidden" name="shift_id" value="shift_999">
      <button type="submit" name="pause" value="pause_888" data-gtm-action="chrono pause">Comida (60 min.)</button>
      <div id="dropdown-tooltip">
        <dd>8:00</dd>
        <dd>8:24</dd>
      </div>
    </form>
  </div>
</div>`;

const stoppedHtml = `
<div id="chronometer-wrapper">
  <div class="hub-chrono card is-small">
    <form action="/chrono" method="post" id="chrono-form-default_chrono" class="chronometer" hx-post="/chrono">
      <input type="hidden" name="shift_id" value="shift_999">
      <div id="dropdown-tooltip">
        <dd>8:00</dd>
        <dd>8:24</dd>
      </div>
    </form>
  </div>
</div>`;

describe("Chrono HTML structure tests", () => {
  it("parses paused response structure", () => {
    const parsed = parseChrono(pausedHtml);
    expect(parsed.status).toBe("paused");
    expect(parsed.chronoId).toBe("pause_888");
    expect(parsed.shiftId).toBe("shift_999");
    expect(parsed.formId).toBe("chrono-form-hub_chrono");
    expect(parsed.loggedMinutes).toBe(504);
  });

  it("parses working response structure", () => {
    const parsed = parseChrono(workingHtml);
    expect(parsed.status).toBe("working");
    expect(parsed.chronoId).toBe("pause_888");
    expect(parsed.shiftId).toBe("shift_999");
    expect(parsed.formId).toBe("chrono-form-default_chrono");
    expect(parsed.loggedMinutes).toBe(504);
    expect(parsed.scheduledMinutes).toBe(480);
  });

  it("parses stopped response structure", () => {
    const parsed = parseChrono(stoppedHtml);
    expect(parsed.status).toBe("stopped");
    expect(parsed.chronoId).toBeUndefined();
    expect(parsed.shiftId).toBe("shift_999");
    expect(parsed.formId).toBe("chrono-form-default_chrono");
  });
});
