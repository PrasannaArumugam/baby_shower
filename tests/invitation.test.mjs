import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { countdownTo, foldCalendarLine, isAppsScriptEndpoint, validateResponse } from "../lib.mjs";
import { translations } from "../translations.mjs";

const eventDate = "2027-01-20T10:30:00+05:30";
const response = {
  guestName: "Guest", attendance: "yes", gender: "girl",
  babyOne: "Name One", babyTwo: "Name Two",
  requestId: "7d0f9f8c-f5b0-4b89-9d62-2da6af451150",
};

test("countdown uses IST correctly, rolls over and stops at zero", () => {
  const start = Date.parse("2027-01-20T05:00:00Z");
  assert.deepEqual(countdownTo(eventDate, start - 90061000), { days: 1, hours: 1, minutes: 1, seconds: 1, started: false });
  assert.deepEqual(countdownTo(eventDate, start), { days: 0, hours: 0, minutes: 0, seconds: 0, started: true });
  assert.equal(countdownTo(eventDate, start + 5000).seconds, 0);
  assert.throws(() => countdownTo("invalid"), /invalid/);
});

test("both attendance choices and Tamil names are accepted; missing or invalid fields are rejected", () => {
  assert.equal(validateResponse(response), "");
  assert.equal(validateResponse({ ...response, attendance: "no", guestName: "நிவேதா" }), "");
  for (const change of [{ guestName: " " }, { guestName: "a".repeat(101) }, { attendance: "" }, { gender: "other" }, { babyOne: "" }, { babyTwo: "x".repeat(81) }]) {
    assert.notEqual(validateResponse({ ...response, ...change }), "");
  }
});

test("both languages render every invitation binding and validation error", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const keys = [...html.matchAll(/data-i18n(?:-placeholder|-aria-label|-title)?="([^"]+)"/g)].map((match) => match[1]);
  for (const change of [{ guestName: "" }, { attendance: "" }, { gender: "" }, { babyTwo: "" }]) {
    keys.push(validateResponse({ ...response, ...change }));
  }
  for (const copy of Object.values(translations)) {
    for (const key of keys) {
      assert.equal(typeof copy[key], "string", `Missing translation for ${key}`);
    }
    for (const change of [{ guestName: "" }, { attendance: "" }, { gender: "" }, { babyTwo: "" }]) {
      assert.ok(copy[validateResponse({ ...response, ...change })].trim());
    }
    assert.ok(readFileSync(new URL(`../${copy.artSource}`, import.meta.url)).length > 0, `Missing artwork for ${copy.pageTitle}`);
  }
});

test("calendar folding preserves Tamil text and the 75-byte UTF-8 line limit", () => {
  for (const copy of Object.values(translations)) {
    const original = `DESCRIPTION:${copy.calendarDescription}`;
    const folded = foldCalendarLine(original);
    assert.equal(folded.replace(/\r\n /g, ""), original);
    for (const line of folded.split("\r\n")) {
      assert.ok(Buffer.byteLength(line, "utf8") <= 75);
      assert.ok(!line.includes("\uFFFD"));
    }
  }
});

test("only deployed HTTPS Apps Script endpoints are accepted", () => {
  assert.equal(isAppsScriptEndpoint("https://script.google.com/macros/s/abc_123-456/exec"), true);
  for (const value of ["", "http://script.google.com/macros/s/a/exec", "https://evil.example/exec", "https://script.google.com.evil.example/macros/s/a/exec", "https://script.google.com/macros/s/a/dev"]) {
    assert.equal(isAppsScriptEndpoint(value), false);
  }
});

function backend(failWrite = false) {
  const rows = [["Received at", "Guest name", "Attending", "Name category", "Baby one", "Baby two", "Request ID"]];
  const errors = [];
  let locked = false;
  const sheet = {
    getLastRow: () => rows.length,
    getRange: (row, column, count, width) => row === 1
      ? { getValues: () => [rows[0]] }
      : {
        getValues: () => rows.slice(row - 1, row - 1 + count).map((r) => r.slice(column - 1, column - 1 + width)),
        createTextFinder: (id) => ({ matchEntireCell: () => ({ findNext: () => rows.some((r) => r[6] === id) || null }) }),
      },
    appendRow: (values) => { if (failWrite) throw new Error("Write failed"); rows.push(values); },
  };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => "sheet-id" }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush: () => {} },
    LockService: { getScriptLock: () => ({
      waitLock: () => { locked = true; }, hasLock: () => locked, releaseLock: () => { locked = false; },
    }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }) },
    console: { error: (message) => errors.push(message) },
  });
  vm.runInContext(readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8"), context);
  return { post: (data) => context.doPost({ postData: { contents: JSON.stringify(data) } }), rows, errors, locked: () => locked };
}

test("backend stores fields, neutralizes formulas, and deduplicates retries", () => {
  const app = backend();
  assert.equal(app.post({ ...response, guestName: "=IMPORTXML()", babyOne: "+formula" }).ok, true);
  assert.equal(app.rows[1][1], "'=IMPORTXML()");
  assert.equal(app.rows[1][4], "'+formula");
  assert.equal(app.rows[1][2], "yes");
  assert.equal(app.rows[1][3], "girl");
  assert.equal(app.post(response).ok, true);
  assert.equal(app.rows.length, 2);
  assert.equal(app.locked(), false);
});

test("backend rejects invalid or automated responses and explicitly reports storage errors", () => {
  const app = backend();
  for (const data of [{ ...response, gender: "" }, { ...response, website: "spam" }, { ...response, requestId: "bad" }, { ...response, babyTwo: " " }]) {
    assert.equal(app.post(data).ok, false);
  }
  assert.equal(app.rows.length, 1);
  const failed = backend(true);
  assert.equal(failed.post(response).ok, false);
  assert.equal(failed.errors.length, 1);
  assert.equal(failed.locked(), false);
});

test("RSVP results include all saved selections, including declines, without exposing guest details or counting retries twice", () => {
  const app = backend();
  assert.deepEqual(app.post(response).stats, { boy: 0, girl: 1 });
  const declined = { ...response, attendance: "no", gender: "boy", requestId: "8d0f9f8c-f5b0-4b89-9d62-2da6af451150" };
  const result = app.post(declined);
  assert.deepEqual(result, { ok: true, requestId: declined.requestId, stats: { boy: 1, girl: 1 } });
  assert.deepEqual(app.post(declined).stats, { boy: 1, girl: 1 });
  assert.equal(app.rows.length, 3);
  app.rows[1][3] = "boy";
  assert.deepEqual(app.post(declined).stats, { boy: 2, girl: 0 });
});
