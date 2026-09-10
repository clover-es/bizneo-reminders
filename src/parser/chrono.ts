import type { ChronoStatus } from "../reminders.js";

export interface ParsedChrono {
  status: ChronoStatus;
  chronoId?: string;
  shiftId?: string;
  csrfToken?: string;
  formId?: string;
  startedAt?: string;
  loggedMinutes?: number;
  scheduledMinutes?: number;
  isExceeded?: boolean;
}

function firstMatch(pattern: RegExp, html: string): string | undefined {
  return pattern.exec(html)?.[1];
}

function inputValue(name: string, html: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return firstMatch(new RegExp(`<input\\b(?=[^>]*\\bname=["']${escaped}["'])[^>]*\\bvalue=["']([^"']*)["']`, "i"), html)
    ?? firstMatch(new RegExp(`<input\\b(?=[^>]*\\bvalue=["']([^"']*)["'])[^>]*\\bname=["']${escaped}["']`, "i"), html);
}

function namedValue(name: string, html: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return firstMatch(new RegExp(`<(?:input|button)\\b(?=[^>]*\\bname=["']${escaped}["'])[^>]*\\bvalue=["']([^"']*)["']`, "i"), html)
    ?? firstMatch(new RegExp(`<(?:input|button)\\b(?=[^>]*\\bvalue=["']([^"']*)["'])[^>]*\\bname=["']${escaped}["']`, "i"), html);
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function parseHM(value: string | undefined): number | undefined {
  const match = value?.match(/^(\d{1,3}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}

export function parseBizneoDate(str: string | undefined): Date | undefined {
  if (!str) return undefined;
  const match = str.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) return undefined;
  const [, y, m, d, h = "0", min = "0", s = "0"] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s));
}

export function parseChrono(html: string): ParsedChrono {
  const wrapper = firstMatch(/<div\b[^>]*\bid=["']chronometer-wrapper["'][^>]*>([\s\S]*<\/div>)\s*$/i, html) ?? html;
  const form = firstMatch(/<form\b[^>]*>([\s\S]*?)<\/form>/i, wrapper) ?? wrapper;
  const formTag = firstMatch(/(<form\b[^>]*>)/i, wrapper) ?? "";
  const chronoId = namedValue("pause", form);
  const shiftId = inputValue("shift_id", form);
  const csrfToken = inputValue("_csrf_token", form);
  const formId = firstMatch(/\bid=["']([^"']+)["']/i, formTag);
  const startedAt = firstMatch(/data-timer\b[^>]*\bdata-from=["']([^"']+)["']/i, form)
    ?? firstMatch(/data-from=["']([^"']+)["'][^>]*\bdata-timer\b/i, form);
  const dropdownValues = [...form.matchAll(/<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)].map(match => stripTags(match[1] ?? ""));
  const loggedMinutes = parseHM(dropdownValues[1])
    ?? parseHM(firstMatch(/<div\b[^>]*class=["'][^"']*\brow\b[^"']*\btime\b[^"']*["'][^>]*>[\s\S]*?<b[^>]*>([^<]+)<\/b>/i, form));
  const scheduledMinutes = parseHM(dropdownValues[0]);
  const isResume = /data-gtm-action=["']chrono stop rest["']/i.test(form);
  const isStopped = /\bhx-post=["']\/chrono["']/i.test(formTag) || Boolean(inputValue("user_id", form) && !startedAt);
  const isWorking = !isResume && (namedValue("kind", form) === "rest" || /data-gtm-action=["']chrono pause["']/i.test(form));
  const status: ChronoStatus = isStopped ? "stopped" : isWorking ? "working" : chronoId || isResume ? "paused" : "unknown";
  const isExceeded = /exceeded|superad/i.test(firstMatch(/<div\b[^>]*id=["']dropdown-tooltip["'][^>]*>([\s\S]*?)<\/div>/i, form) ?? "");

  return { status, chronoId, shiftId, csrfToken, formId, startedAt, loggedMinutes, scheduledMinutes, isExceeded: isExceeded || undefined };
}
