export function countdownTo(eventDate, now = Date.now()) {
  const timestamp = Date.parse(eventDate);
  if (!Number.isFinite(timestamp)) throw new Error("The event date is invalid.");
  const remaining = Math.max(0, Math.floor((timestamp - now) / 1000));
  return {
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
    started: now >= timestamp,
  };
}

export function validateResponse(data) {
  if (typeof data.guestName !== "string" || !data.guestName.trim() || data.guestName.trim().length > 100) {
    return "guestNameError";
  }
  if (!["yes", "no"].includes(data.attendance)) return "attendanceError";
  if (!["boy", "girl"].includes(data.gender)) return "genderError";
  for (const key of ["babyOne", "babyTwo"]) {
    if (typeof data[key] !== "string" || !data[key].trim() || data[key].trim().length > 80) {
      return "babyNamesError";
    }
  }
  return "";
}

export function isAppsScriptEndpoint(value) {
  try {
    const url = new URL(value);
    return url.origin === "https://script.google.com" && /^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname) && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function foldCalendarLine(line) {
  const encoder = new TextEncoder();
  let folded = "";
  let width = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (width + bytes > 75) {
      folded += "\r\n ";
      width = 1;
    }
    folded += character;
    width += bytes;
  }
  return folded;
}
