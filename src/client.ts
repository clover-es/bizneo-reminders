import { parseChrono, type ParsedChrono } from "./parser/chrono.js";
import type { ReminderConfig } from "./config.js";
import { t } from "./i18n.js";

export class BizneoClient {
  constructor(private readonly config: ReminderConfig) {}

  async fetchChrono(): Promise<ParsedChrono> {
    if (!this.config.tenant || !this.config.userId) {
      throw new Error(t("configBeforeQuery"));
    }
    const url = `https://${this.config.tenant}.bizneohr.com/chrono/${encodeURIComponent(this.config.userId)}/hub_chrono`;
    const response = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      headers: {
        "Accept": "*/*",
        "HX-Current-URL": `https://${this.config.tenant}.bizneohr.com/`,
        "HX-Request": "true",
        "HX-Target": "chronometer-wrapper",
        "HX-Trigger": "chronometer-wrapper"
      }
    });
    if (!response.ok || response.redirected || /\/users\/sign_in|\/welcome/.test(response.url)) {
      throw new Error(response.status === 401 || response.status === 403 ? t("notAuthenticated") : t("httpError", String(response.status)));
    }
    const html = await response.text();
    if (html.includes('id="new_user"') || html.includes("Sign in to your account")) {
      throw new Error(t("notAuthenticated"));
    }
    return parseChrono(html);
  }

  async performChrono(action: "checkIn" | "pause" | "resume" | "checkOut"): Promise<ParsedChrono> {
    const state = await this.fetchChrono();
    const csrf = state.csrfToken ?? "";
    const shift = state.shiftId ?? "";
    const userId = this.config.userId;
    const body = new URLSearchParams();
    body.set("_csrf_token", csrf);
    body.set("location_id", "");
    body.set("shift_id", shift);

    let method = "PUT";
    let path = `/chrono/${encodeURIComponent(userId)}`;
    if (action === "checkIn") {
      method = "POST";
      path = "/chrono";
      body.set("user_id", userId);
      body.set("kind", "working_time");
    } else if (action === "pause") {
      if (!state.chronoId) {
        throw new Error(t("noPauseConfigured"));
      }
      body.set("_method", "put");
      body.set("kind", "rest");
      body.set("comment", "");
      body.set("pause", state.chronoId);
    } else if (action === "resume") {
      body.set("_method", "put");
      body.set("kind", "working_time");
      body.set("comment", "");
      if (state.chronoId) body.set("pause", state.chronoId);
    } else {
      body.set("_method", "put");
      body.set("kind", "rest");
      body.set("comment", "");
    }

    const trigger = state.formId ?? (action === "resume" ? "chrono-form-hub_chrono" : "chrono-form-default_chrono");

    const response = await fetch(`https://${this.config.tenant}.bizneohr.com${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      headers: {
        "Accept": "*/*",
        "Content-Type": "application/x-www-form-urlencoded",
        "HX-Current-URL": `https://${this.config.tenant}.bizneohr.com/`,
        "HX-Request": "true",
        "HX-Target": "chronometer-wrapper",
        "HX-Trigger": trigger,
        ...(csrf ? { "X-CSRF-Token": csrf } : {})
      },
      body
    });
    if (!response.ok) throw new Error(t("httpError", String(response.status)));
    return parseChrono(await response.text());
  }
}
