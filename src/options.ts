import { defaultConfig, validateConfig, type ReminderConfig } from "./config.js";
import { localizeDocument, t } from "./i18n.js";

const STORAGE_KEY = "reminderConfig";
const editor = document.querySelector<HTMLTextAreaElement>("#config")!;
const status = document.querySelector<HTMLOutputElement>("#status")!;
const diagnostics = document.querySelector<HTMLElement>("#diagnostics")!;
const fileInput = document.querySelector<HTMLInputElement>("#file")!;
const form = document.querySelector<HTMLFormElement>("#settings-form")!;
const dayNames = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const dayValues = [1, 2, 3, 4, 5, 6, 0];
let dirty = false;
localizeDocument();

function populateTimeZones(): void {
  const select = document.querySelector<HTMLSelectElement>("#timeZone")!;
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["Europe/Madrid", "UTC"];
  select.replaceChildren(...zones.map(zone => { const option = new Option(zone, zone); option.textContent = zone; return option; }));
}

function showStatus(message: string, error = false): void { status.textContent = message; status.style.color = error ? "#a51d2d" : "#176b63"; }
function input(id: string): HTMLInputElement { return document.querySelector<HTMLInputElement>(`#${id}`)!; }
function timeValue(id: string): string { return input(id).value.slice(0, 5); }
function renderDays(config: ReminderConfig): void {
  const root = document.querySelector<HTMLElement>("#workingDays")!;
  root.replaceChildren(...dayNames.map((name, day) => {
    const actualDay = dayValues[day] ?? 0;
    const label = document.createElement("label"); label.className = "day";
    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.dataset.day = String(actualDay); checkbox.checked = config.workingDays.includes(actualDay);
    const text = document.createElement("span"); text.textContent = t(`day_${name}`); label.append(checkbox, text); return label;
  }));
}
function renderForm(config: ReminderConfig): void {
  input("tenant").value = config.tenant; input("userId").value = config.userId; document.querySelector<HTMLSelectElement>("#timeZone")!.value = config.timeZone;
  input("morningStartStart").value = config.morningStart.start.slice(0, 5); input("morningStartEnd").value = config.morningStart.end.slice(0, 5);
  input("morningBreakStart").value = config.morningBreak.start.slice(0, 5); input("morningBreakEnd").value = config.morningBreak.end.slice(0, 5);
  input("endOfDayStart").value = config.endOfDayStart.slice(0, 5); input("maximumWorkMinutes").value = String(config.maximumWorkMinutes);
  input("pauseMaximumMinutes").value = String(config.pauseMaximumMinutes); input("reminderIntervalSeconds").value = String(config.reminderIntervalSeconds);
  input("enabledMorningStart").checked = config.enabled.morningStart; input("enabledMorningBreak").checked = config.enabled.morningBreak;
  input("enabledPauseOverdue").checked = config.enabled.pauseOverdue; input("enabledEndOfDay").checked = config.enabled.endOfDay;
  renderDays(config); editor.value = JSON.stringify(config, null, 2);
}
function readForm(): ReminderConfig {
  return validateConfig({
    version: 1, tenant: input("tenant").value.trim(), userId: input("userId").value.trim(), timeZone: document.querySelector<HTMLSelectElement>("#timeZone")!.value,
    reminderIntervalSeconds: Number(input("reminderIntervalSeconds").value),
    workingDays: Array.from(document.querySelectorAll<HTMLInputElement>("#workingDays input:checked")).map(item => Number(item.dataset.day)),
    morningStart: { start: timeValue("morningStartStart"), end: timeValue("morningStartEnd") },
    morningBreak: { start: timeValue("morningBreakStart"), end: timeValue("morningBreakEnd") },
    pauseMaximumMinutes: Number(input("pauseMaximumMinutes").value), endOfDayStart: timeValue("endOfDayStart"),
    maximumWorkMinutes: Number(input("maximumWorkMinutes").value),
    enabled: { morningStart: input("enabledMorningStart").checked, morningBreak: input("enabledMorningBreak").checked, pauseOverdue: input("enabledPauseOverdue").checked, endOfDay: input("enabledEndOfDay").checked }
  });
}
function render(config: ReminderConfig): void { renderForm(config); }
function markDirty(): void { dirty = true; }
async function load(): Promise<void> {
  const stored = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY];
  try { render(stored ? validateConfig(stored) : defaultConfig()); dirty = false; } catch (error) { render(defaultConfig()); dirty = false; showStatus(t("invalidStoredConfig", String(error)), true); }
}
async function readEditor(): Promise<ReminderConfig> { return validateConfig(JSON.parse(editor.value) as unknown); }

form.addEventListener("submit", event => {
  event.preventDefault();
  void Promise.resolve().then(readForm).then(async config => { await chrome.storage.local.set({ [STORAGE_KEY]: config }); await chrome.runtime.sendMessage({ type: "config-changed" }); render(config); dirty = false; showStatus(t("configSaved")); }).catch(error => showStatus(String(error), true));
});
document.querySelector("#check")!.addEventListener("click", () => {
  showStatus(t("checkingBizneo"));
  void chrome.runtime.sendMessage({ type: "check-now" }).then((result: { ok: boolean; checkedAt: string; status?: string; loggedMinutes?: number; activeRules?: string[]; error?: string }) => { diagnostics.textContent = JSON.stringify(result, null, 2); showStatus(result.ok ? t("checkComplete") : t("checkFailed", result.error ?? t("unknownError")), !result.ok); }).catch(error => showStatus(String(error), true));
});
document.querySelector("#import")!.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => { const file = fileInput.files?.[0]; if (!file) return; void file.text().then(content => { render(validateConfig(JSON.parse(content) as unknown)); dirty = true; showStatus(t("jsonImported")); }).catch(error => showStatus(String(error), true)); });
document.querySelector("#export")!.addEventListener("click", () => { void Promise.resolve().then(readForm).then(config => { const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "bizneo-reminders.json"; link.click(); URL.revokeObjectURL(url); showStatus(t("jsonExported")); }).catch(error => showStatus(String(error), true)); });
document.querySelectorAll<HTMLButtonElement>("[data-help]").forEach(button => button.addEventListener("click", () => {
  const dialog = document.querySelector<HTMLDialogElement>("#help-dialog")!; const isTenant = button.dataset.help === "tenant";
  document.querySelector("#help-title")!.textContent = t(isTenant ? "tenantHelpTitle" : "userIdHelpTitle");
  document.querySelector("#help-content")!.innerHTML = `<p>${t(isTenant ? "tenantHelpIntro" : "userIdHelpIntro")}</p><ol class="help-list"><li>${t("helpStepProfile")}</li><li>${t("helpStepIdentity")}</li><li>${t(isTenant ? "helpStepTenant" : "helpStepUserId")}</li></ol>`;
  document.querySelector("#help-images")!.innerHTML = isTenant ? "" : `<img class="help-shot profile-shot" src="res/my_profile.png" alt=""><img class="help-shot id-shot" src="res/user-id.png" alt="">`;
  dialog.showModal();
}));
document.querySelector("[data-close-help]")!.addEventListener("click", () => document.querySelector<HTMLDialogElement>("#help-dialog")!.close());
form.addEventListener("input", markDirty);
editor.addEventListener("input", markDirty);
window.addEventListener("beforeunload", event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});
populateTimeZones();
void load();
