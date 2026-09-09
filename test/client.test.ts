import { describe, expect, it, vi } from "vitest";
import { BizneoClient } from "../src/client.js";
import { defaultConfig } from "../src/config.js";

const workingChrono = `
  <div id="chronometer-wrapper"><form id="chrono-form-default_chrono" hx-put="/chrono/42">
    <input name="_csrf_token" value="token"><input name="shift_id" value="shift">
    <input name="kind" type="hidden" value="rest"><span data-timer data-from="2026-09-07 08:00:00"></span>
    <button type="submit" name="pause" value="123" data-gtm-action="chrono pause">Comida (60 min.)</button>
  </form></div>`;

const workingChronoNoPause = `
  <div id="chronometer-wrapper"><form id="chrono-form-default_chrono" hx-put="/chrono/42">
    <input name="_csrf_token" value="token"><input name="shift_id" value="shift">
    <input name="kind" type="hidden" value="rest"><span data-timer data-from="2026-09-07 08:00:00"></span>
  </form></div>`;

const pausedChrono = `
  <div id="chronometer-wrapper"><form id="chrono-form-hub_chrono" hx-put="/chrono/42">
    <input name="_csrf_token" value="token"><input name="shift_id" value="shift">
    <button type="submit" name="pause" value="99" data-gtm-action="chrono stop rest">Resume</button>
    <span data-timer data-from="2026-09-07 08:00:00"></span>
  </form></div>`;

const stoppedChrono = `
  <div id="chronometer-wrapper"><form id="chrono-form-default_chrono" hx-post="/chrono">
    <input name="_csrf_token" value="token"><input name="user_id" value="42">
    <input name="shift_id" value="shift">
  </form></div>`;

function response(body: string): Response {
  return new Response(body, { status: 200 });
}

describe("BizneoClient.performChrono", () => {
  it("matches Bizneo's pause request by sending rest with pause ID", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(workingChrono))
      .mockResolvedValueOnce(response(pausedChrono));

    await new BizneoClient({ ...defaultConfig(), tenant: "tenant", userId: "42" }).performChrono("pause");

    const request = fetchMock.mock.calls[1]?.[1];
    const body = request?.body as URLSearchParams;
    expect(body.get("kind")).toBe("rest");
    expect(body.get("pause")).toBe("123");
    expect(request?.headers).toMatchObject({
      "HX-Current-URL": "https://tenant.bizneohr.com/",
      "HX-Trigger": "chrono-form-default_chrono"
    });
    fetchMock.mockRestore();
  });

  it("throws when trying to pause without available pause option", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(workingChronoNoPause));

    await expect(new BizneoClient({ ...defaultConfig(), tenant: "tenant", userId: "42" }).performChrono("pause"))
      .rejects.toThrow();

    fetchMock.mockRestore();
  });

  it("sends the pause id when resuming", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(pausedChrono))
      .mockResolvedValueOnce(response(workingChrono));

    await new BizneoClient({ ...defaultConfig(), tenant: "tenant", userId: "42" }).performChrono("resume");

    const request = fetchMock.mock.calls[1]?.[1];
    const body = request?.body as URLSearchParams;
    expect(body.get("kind")).toBe("working_time");
    expect(body.get("pause")).toBe("99");
    expect(request?.headers).toMatchObject({ "HX-Trigger": "chrono-form-hub_chrono" });
    fetchMock.mockRestore();
  });

  it("matches Bizneo's checkOut request by sending rest without pause ID", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(workingChrono))
      .mockResolvedValueOnce(response(stoppedChrono));

    await new BizneoClient({ ...defaultConfig(), tenant: "tenant", userId: "42" }).performChrono("checkOut");

    const request = fetchMock.mock.calls[1]?.[1];
    const body = request?.body as URLSearchParams;
    expect(body.get("kind")).toBe("rest");
    expect(body.has("pause")).toBe(false);
    expect(request?.headers).toMatchObject({ "HX-Trigger": "chrono-form-default_chrono" });
    fetchMock.mockRestore();
  });

  it("matches Bizneo's checkIn request via POST /chrono", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(stoppedChrono))
      .mockResolvedValueOnce(response(workingChrono));

    await new BizneoClient({ ...defaultConfig(), tenant: "tenant", userId: "42" }).performChrono("checkIn");

    const [url, request] = fetchMock.mock.calls[1] ?? [];
    expect(url).toBe("https://tenant.bizneohr.com/chrono");
    expect(request?.method).toBe("POST");
    const body = request?.body as URLSearchParams;
    expect(body.get("kind")).toBe("working_time");
    expect(body.get("user_id")).toBe("42");
    fetchMock.mockRestore();
  });
});