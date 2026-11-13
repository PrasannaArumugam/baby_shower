const HEADERS = ["Received at", "Guest name", "Attending", "Name category", "Baby one", "Baby two", "Request ID"];
const TAB_NAME = "Responses";

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("Set the SPREADSHEET_ID script property first.");
  return SpreadsheetApp.openById(id);
}

// Run once as the sheet owner before deploying the web app.
function setup() {
  const spreadsheet = getSpreadsheet_();
  spreadsheet.setSpreadsheetTimeZone("Asia/Kolkata");
  const sheet = spreadsheet.getSheetByName(TAB_NAME) || spreadsheet.insertSheet(TAB_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.autoResizeColumns(1, HEADERS.length);
  } else {
    checkHeaders_(sheet);
  }
}

function checkHeaders_(sheet) {
  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (HEADERS.some(function (header, index) { return actual[index] !== header; })) {
    throw new Error("The Responses tab has unexpected headers. Restore the original headers.");
  }
}

function validate_(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid response.");
  if (data.website) throw new Error("Invalid response.");
  if (typeof data.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestId)) {
    throw new Error("Invalid request ID.");
  }
  [["guestName", 100], ["babyOne", 80], ["babyTwo", 80]].forEach(function (field) {
    if (typeof data[field[0]] !== "string" || !data[field[0]].trim() || data[field[0]].trim().length > field[1]) {
      throw new Error("Invalid name field.");
    }
    data[field[0]] = data[field[0]].trim();
  });
  if (["yes", "no"].indexOf(data.attendance) === -1) throw new Error("Invalid attendance.");
  if (["boy", "girl"].indexOf(data.gender) === -1) throw new Error("Invalid name category.");
  return data;
}

function safeCell_(value) {
  return /^[=+\-@\t\r\n]/.test(value) ? "'" + value : value;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(event) {
  let lock;
  try {
    if (!event || !event.postData || event.postData.contents.length > 4000) throw new Error("Invalid request body.");
    const data = validate_(JSON.parse(event.postData.contents));
    lock = LockService.getScriptLock();
    lock.waitLock(15000);
    const sheet = getSpreadsheet_().getSheetByName(TAB_NAME);
    if (!sheet) throw new Error("Run setup before accepting responses.");
    checkHeaders_(sheet);
    const lastRow = sheet.getLastRow();
    const existing = lastRow > 1
      ? sheet.getRange(2, 7, lastRow - 1, 1).createTextFinder(data.requestId).matchEntireCell(true).findNext()
      : null;
    if (!existing) {
      sheet.appendRow([
        new Date(), safeCell_(data.guestName), data.attendance, data.gender,
        safeCell_(data.babyOne), safeCell_(data.babyTwo), data.requestId,
      ]);
      SpreadsheetApp.flush();
    }
    return json_({ ok: true, requestId: data.requestId });
  } catch (error) {
    console.error("RSVP save failed: " + error.message);
    return json_({ ok: false, error: "Unable to save response. Please retry or contact the hosts." });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
