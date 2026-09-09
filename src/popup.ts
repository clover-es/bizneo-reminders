import type { ParsedChrono } from "./parser/chrono.js";
import { localizeDocument, t } from "./i18n.js";

type Action = "checkIn" | "pause" | "resume" | "checkOut";
interface ChronoResponse { ok: boolean; chrono?: ParsedChrono; error?: string; }

const status = document.querySelector<HTMLElement>("#status")!;
const logged = document.querySelector<HTMLElement>("#logged")!;
const connection = document.querySelector<HTMLElement>("#connection")!;
const message = document.querySelector<HTMLElement>("#message")!;
const icon = document.querySelector<HTMLElement>("#status-icon")!;
const configurationStatus = document.querySelector<HTMLElement>("#configuration-status")!;
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-action]"));
localizeDocument();

function label(value: ParsedChrono["status"]): string {
  return value === "working" ? t("working") : value === "paused" ? t("paused") : value === "stopped" ? t("stopped") : t("unknown");
}

function formatMinutes(value: number | undefined): string {
  const minutes = Math.max(0, value ?? 0);
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

function render(chrono: ParsedChrono): void {
  status.textContent = label(chrono.status);
  const registered = chrono.loggedMinutes ?? 0;
  const remaining = chrono.scheduledMinutes === undefined ? undefined : Math.max(0, chrono.scheduledMinutes - registered);
  logged.textContent = remaining === undefined
    ? t("registeredTime", formatMinutes(registered))
    : `${t("registeredTime", formatMinutes(registered))} · ${t("remainingTime", formatMinutes(remaining))}`;
  icon.className = chrono.status;
  connection.textContent = "Conectado";
  configurationStatus.hidden = true;
  const sessionButton = document.querySelector<HTMLButtonElement>("#session-action")!;
  const breakButton = document.querySelector<HTMLButtonElement>("#break-action")!;
  sessionButton.textContent = chrono.status === "stopped" ? t("start") : t("stop");
  sessionButton.dataset.action = chrono.status === "stopped" ? "checkIn" : "checkOut";
  sessionButton.classList.toggle("danger", chrono.status !== "stopped");
  sessionButton.disabled = chrono.status !== "stopped" && chrono.status !== "working" && chrono.status !== "paused";
  breakButton.textContent = chrono.status === "paused" ? t("resume") : t("pause");
  breakButton.dataset.action = chrono.status === "paused" ? "resume" : "pause";
  breakButton.disabled = chrono.status !== "working" && chrono.status !== "paused";
}

async function request(action?: Action): Promise<void> {
  buttons.forEach(button => { button.disabled = true; });
  message.textContent = "";
  const response = await chrome.runtime.sendMessage(action ? { type: "chrono-action", action } : { type: "check-now" }) as ChronoResponse & { status?: string; loggedMinutes?: number };
  if (!response.ok) {
      const incomplete = response.error?.includes("tenant") || response.error?.includes("userId");
      configurationStatus.hidden = !incomplete;
      message.textContent = response.error ?? t("queryFailed");
      connection.textContent = t("error");
    return;
  }
  if (response.chrono) render(response.chrono);
  else {
    connection.textContent = t("connected");
    status.textContent = response.status ? label(response.status as ParsedChrono["status"]) : status.textContent;
    if (response.loggedMinutes !== undefined) logged.textContent = t("registeredTime", formatMinutes(response.loggedMinutes));
    buttons.forEach(button => { button.disabled = false; });
  }
}

buttons.forEach(button => button.addEventListener("click", () => {
  const action = button.dataset.action as Action;
  if (action === "checkOut" && !window.confirm(t("stopConfirmation"))) return;
  void request(action);
}));
document.querySelector("#open-bizneo")!.addEventListener("click", async () => {
  const stored = (await chrome.storage.local.get("reminderConfig"))["reminderConfig"];
  const tenant = stored?.tenant?.trim();
  if (tenant) {
    await chrome.tabs.create({ url: `https://${tenant}.bizneohr.com/` });
  } else {
    await chrome.runtime.openOptionsPage();
  }
});
document.querySelector("#refresh")!.addEventListener("click", () => { void request(); });
document.querySelector("#settings")!.addEventListener("click", () => { void chrome.runtime.openOptionsPage(); });
void request();