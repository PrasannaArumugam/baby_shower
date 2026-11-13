import { config } from "./config.js";
import { countdownTo, foldCalendarLine, isAppsScriptEndpoint, validateResponse } from "./lib.mjs";
import { translations } from "./translations.mjs";

let language = "en";
let currentStatus;

function updateCountdown() {
  const remaining = countdownTo(config.eventDate);
  for (const unit of ["days", "hours", "minutes", "seconds"]) {
    document.getElementById(unit).textContent = String(remaining[unit]).padStart(2, "0");
  }
  if (remaining.started) {
    clearInterval(countdownInterval);
  }
  document.getElementById("countdown-note").textContent =
    translations[language][remaining.started ? "celebrationStarted" : "countdownNote"];
}
let countdownInterval;
updateCountdown();
if (Date.now() < Date.parse(config.eventDate)) countdownInterval = setInterval(updateCountdown, 1000);

const form = document.getElementById("rsvp-form");
const status = document.getElementById("form-status");
const submitButton = form.querySelector('button[type="submit"]');
let pendingSubmission;
let submitting = false;

function showStatus(key, state) {
  currentStatus = { key, state };
  status.textContent = translations[language][key];
  status.dataset.state = state;
}

function setLanguage(nextLanguage) {
  if (!Object.hasOwn(translations, nextLanguage)) throw new Error("Unsupported invitation language.");
  language = nextLanguage;
  const copy = translations[language];
  document.documentElement.lang = language;
  document.title = copy.pageTitle;
  document.querySelector('meta[name="theme-color"]').content = copy.themeColor;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = copy[element.dataset.i18n];
  });
  for (const attribute of ["placeholder", "aria-label", "title"]) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach((element) => {
      element.setAttribute(attribute, copy[element.getAttribute(`data-i18n-${attribute}`)]);
    });
  }
  document.querySelector(".language-switch").setAttribute("aria-label", copy.languageLabel);
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  });
  const artwork = document.querySelector(".twins-art");
  artwork.src = copy.artSource;
  artwork.alt = copy.artAlt;
  if (currentStatus) showStatus(currentStatus.key, currentStatus.state);
  updateCountdown();
}

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
});
setLanguage(language);

if (!isAppsScriptEndpoint(config.rsvpEndpoint)) {
  showStatus("notConnected", "info");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting) return;
  if (!isAppsScriptEndpoint(config.rsvpEndpoint)) {
    showStatus("notSaved", "error");
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  for (const key of ["guestName", "babyOne", "babyTwo"]) data[key] = data[key].trim();
  const validation = validateResponse(data);
  if (validation) {
    showStatus(validation, "error");
    return;
  }
  const signature = JSON.stringify(data);
  if (!pendingSubmission || pendingSubmission.signature !== signature) {
    pendingSubmission = { signature, requestId: crypto.randomUUID() };
  }
  submitting = true;
  submitButton.disabled = true;
  showStatus("sending", "info");
  try {
    const response = await fetch(config.rsvpEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...data, requestId: pendingSubmission.requestId }),
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
      credentials: "omit",
    });
    if (!response.ok) throw new Error("The guest list service is unavailable.");
    const result = await response.json();
    if (result.ok !== true || result.requestId !== pendingSubmission.requestId) {
      throw new Error("The guest list did not confirm your response.");
    }
    showStatus(data.attendance === "yes" ? "savedYes" : "savedNo", "success");
    form.reset();
    pendingSubmission = undefined;
  } catch (error) {
    console.error("RSVP submission could not be confirmed:", error);
    showStatus("saveError", "error");
  } finally {
    submitting = false;
    submitButton.disabled = false;
  }
});

document.getElementById("calendar-button").addEventListener("click", () => {
  const start = new Date(config.eventDate).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const calendar = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NP Baby Shower//EN",
    "BEGIN:VEVENT", "UID:nivetha-prasanna-baby-shower-20270120",
    `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, "")}`,
    `DTSTART:${start}`, `SUMMARY:${translations[language].calendarSummary}`,
    "LOCATION:Mathsya Adyar\\, Gandhi Nagar 1st Main Road\\, Chennai 600020",
    `DESCRIPTION:${translations[language].calendarDescription}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].map(foldCalendarLine).join("\r\n");
  const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "nivetha-prasanna-baby-shower.ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
