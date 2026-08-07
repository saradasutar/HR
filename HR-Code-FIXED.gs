/**
 * ADG(B) HR Dashboard backend
 * Google Apps Script + Google Sheets + Google Drive
 *
 * Run setupHRDashboard() once, then deploy as a Web app:
 * Execute as: Me | Who has access: Anyone
 */

var HR_CONFIG = Object.freeze({
  VERSION: "1.0.0",
  EMPLOYEE_SHEET: "Employees",
  LOG_SHEET: "Activity Log",
  FOLDER_NAME: "ADG(B) HR Dashboard Data",
  SPREADSHEET_NAME: "ADG(B) HR Employee Master",
  SESSION_SECONDS: 21600,
  CACHE_SECONDS: 300,
  CHANNEL: "ADG_HR_API_V1",
  DEFAULT_GITHUB_ORIGIN: "https://saradasutar.github.io",
  MAX_IMPORT_ROWS: 1000,
  HEADERS: [
    "Sl No.", "Employee Name", "Employee Code", "Designation", "Grp",
    "REMARK ADMN", "DoB", "DoR", "Cat", "DoJ Govt", "DoJ in ADG",
    "Present/Permanent", "Mob", "Email", "AGE"
  ]
});

/**
 * FIRST-TIME SETUP
 * 1. Change the two default passwords below.
 * 2. Run this function and allow permissions.
 * 3. The Sheet and Drive folder URLs appear in the execution log.
 */
function setupHRDashboard() {
  var properties = PropertiesService.getScriptProperties();
  var folder = getOrCreateDataFolder_();
  var spreadsheet = getOrCreateSpreadsheet_(folder);
  ensureEmployeeSheet_(spreadsheet);
  ensureLogSheet_(spreadsheet);

  if (!properties.getProperty("ALLOWED_ORIGINS")) {
    properties.setProperty("ALLOWED_ORIGINS", JSON.stringify([HR_CONFIG.DEFAULT_GITHUB_ORIGIN]));
  }
  if (!properties.getProperty("USERS_JSON")) {
    saveUsers_([
      makeUser_("admin", "ChangeAdmin@2026", "Administrator", "admin"),
      makeUser_("viewer", "ViewOnly@2026", "HR Viewer", "viewer")
    ]);
  }
  if (!properties.getProperty("SESSION_SECRET")) {
    properties.setProperty("SESSION_SECRET", Utilities.getUuid() + Utilities.getUuid());
  }

  var result = {
    message: "HR Dashboard setup completed",
    spreadsheetUrl: spreadsheet.getUrl(),
    driveFolderUrl: folder.getUrl(),
    allowedOrigin: JSON.parse(properties.getProperty("ALLOWED_ORIGINS"))
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * OPTIONAL: Reset the administrator and viewer credentials.
 * Change all four values first, then run this function once.
 */
function setHRDashboardSecurityCodes() {
  var ADMIN_USERNAME = "admin";
  var ADMIN_PASSWORD = "ChangeAdmin@2026";
  var VIEWER_USERNAME = "viewer";
  var VIEWER_PASSWORD = "ViewOnly@2026";

  saveUsers_([
    makeUser_(ADMIN_USERNAME, ADMIN_PASSWORD, "Administrator", "admin"),
    makeUser_(VIEWER_USERNAME, VIEWER_PASSWORD, "HR Viewer", "viewer")
  ]);
  CacheService.getScriptCache().removeAll(["employees:v1"]);
  console.log("HR Dashboard usernames and passwords have been reset.");
}

/**
 * OPTIONAL: Change this if the GitHub account or custom domain changes.
 * Enter only the origin, without a repository path or trailing slash.
 */
function setAllowedGitHubOrigin() {
  var GITHUB_ORIGIN = "https://saradasutar.github.io";
  PropertiesService.getScriptProperties().setProperty("ALLOWED_ORIGINS", JSON.stringify([normalizeOrigin_(GITHUB_ORIGIN)]));
  console.log("Allowed GitHub origin: " + GITHUB_ORIGIN);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    service: "ADG(B) HR Dashboard API",
    version: HR_CONFIG.VERSION
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Cross-origin bridge: GitHub Pages submits an HTTPS form to this web app.
 * The response is a tiny iframe page that returns data with postMessage.
 * This avoids fragile cross-origin fetch redirects.
 */
function doPost(e) {
  var request = {};
  var requestId = "";
  var origin = "";
  try {
    var payloadText = e && e.parameter && e.parameter.payload ? e.parameter.payload : "";
    if (!payloadText && e && e.postData && e.postData.contents) payloadText = e.postData.contents;
    request = JSON.parse(payloadText || "{}");
    requestId = cleanText_(request.requestId).substring(0, 100);
    origin = normalizeOrigin_(request.origin);
    if (!isAllowedOrigin_(origin)) throwApi_("ORIGIN_BLOCKED", "This website is not allowed to use the HR backend.");
    var data = routeRequest_(request);
    return bridgeResponse_(origin, requestId, true, data, "", "");
  } catch (error) {
    var code = error && error.apiCode ? error.apiCode : "SERVER_ERROR";
    var message = error && error.message ? error.message : "The server could not complete the request.";
    console.error(code + ": " + message + (error && error.stack ? "\n" + error.stack : ""));
    return bridgeResponse_(origin || "*", requestId, false, null, code, message);
  }
}

function routeRequest_(request) {
  var action = cleanText_(request.action);
  var data = request.data || {};
  var token = cleanText_(request.token);
  if (action === "login") return login_(data);
  if (action === "logout") return logout_(token);

  var session = requireSession_(token);
  if (action === "getEmployees") return { employees: getEmployees_(Boolean(data.force)), role: session.role };
  if (action === "changePassword") return changePassword_(session, token, data);

  requireAdmin_(session);
  if (action === "saveEmployee") return saveEmployee_(session, data);
  if (action === "deleteEmployee") return deleteEmployee_(session, data);
  if (action === "importEmployees") return importEmployees_(session, data);
  if (action === "createBackup") return createBackup_(session);
  throwApi_("UNKNOWN_ACTION", "Unknown dashboard action.");
}

function login_(data) {
  var username = cleanText_(data.username).toLowerCase();
  var password = String(data.password || "");
  if (!username || !password) throwApi_("INVALID_LOGIN", "Incorrect username or password.");
  enforceLoginLimit_(username);
  var users = getUsers_();
  var user = null;
  for (var i = 0; i < users.length; i++) if (users[i].username === username) user = users[i];
  if (!user || !safeEqual_(hashPassword_(password, user.salt), user.passwordHash)) {
    recordFailedLogin_(username);
    throwApi_("INVALID_LOGIN", "Incorrect username or password.");
  }
  CacheService.getScriptCache().remove("login:" + shortHash_(username));
  var token = createSession_(user);
  return {
    token: token,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    expiresInSeconds: HR_CONFIG.SESSION_SECONDS
  };
}

function logout_(token) {
  if (token) CacheService.getScriptCache().remove("session:" + token);
  return { loggedOut: true };
}

function changePassword_(session, token, data) {
  var currentPassword = String(data.currentPassword || "");
  var newPassword = String(data.newPassword || "");
  if (newPassword.length < 10) throwApi_("WEAK_PASSWORD", "New password must contain at least 10 characters.");
  var users = getUsers_();
  var changed = false;
  for (var i = 0; i < users.length; i++) {
    if (users[i].username === session.username) {
      if (!safeEqual_(hashPassword_(currentPassword, users[i].salt), users[i].passwordHash)) throwApi_("INVALID_CURRENT_PASSWORD", "Current password is incorrect.");
      users[i].salt = Utilities.getUuid();
      users[i].passwordHash = hashPassword_(newPassword, users[i].salt);
      changed = true;
    }
  }
  if (!changed) throwApi_("USER_NOT_FOUND", "User account not found.");
  saveUsers_(users);
  CacheService.getScriptCache().remove("session:" + token);
  logActivity_(session.username, "PASSWORD_CHANGED", "", "Password changed by user");
  return { changed: true };
}

function getEmployees_(forceRefresh) {
  var cache = CacheService.getScriptCache();
  if (forceRefresh) cache.remove("employees:v1");
  var cached = cache.get("employees:v1");
  if (cached) {
    try { return JSON.parse(cached); } catch (ignore) {}
  }
  var sheet = getSpreadsheet_().getSheetByName(HR_CONFIG.EMPLOYEE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HR_CONFIG.HEADERS.length).getDisplayValues();
  var employees = values.filter(function(row) { return row.some(function(value) { return value !== ""; }); }).map(function(row) {
    var item = {};
    HR_CONFIG.HEADERS.forEach(function(header, index) { item[header] = row[index] || ""; });
    item.AGE = calculateAge_(item.DoB);
    return item;
  });
  var json = JSON.stringify(employees);
  if (json.length < 90000) cache.put("employees:v1", json, HR_CONFIG.CACHE_SECONDS);
  return employees;
}

function saveEmployee_(session, data) {
  var employee = normalizeEmployee_(data.employee || {});
  var originalCode = cleanText_(data.originalEmployeeCode);
  validateEmployee_(employee);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSpreadsheet_().getSheetByName(HR_CONFIG.EMPLOYEE_SHEET);
    var rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, HR_CONFIG.HEADERS.length).getDisplayValues() : [];
    var targetRow = -1;
    var duplicateRow = -1;
    for (var i = 0; i < rows.length; i++) {
      if (cleanText_(rows[i][2]).toLowerCase() === originalCode.toLowerCase() && originalCode) targetRow = i + 2;
      if (cleanText_(rows[i][2]).toLowerCase() === employee["Employee Code"].toLowerCase()) duplicateRow = i + 2;
    }
    if (duplicateRow > 0 && duplicateRow !== targetRow) throwApi_("DUPLICATE_CODE", "Employee code already exists.");
    if (targetRow < 0 && originalCode) throwApi_("NOT_FOUND", "Original employee record was not found.");
    var isNew = targetRow < 0;
    if (isNew) targetRow = sheet.getLastRow() + 1;
    employee["Sl No."] = isNew ? targetRow - 1 : sheet.getRange(targetRow, 1).getDisplayValue();
    sheet.getRange(targetRow, 1, 1, HR_CONFIG.HEADERS.length).setValues([toSheetRow_(employee)]);
    resequenceEmployees_(sheet);
    clearEmployeeCache_();
    logActivity_(session.username, isNew ? "EMPLOYEE_CREATED" : "EMPLOYEE_UPDATED", employee["Employee Code"], employee["Employee Name"]);
    return { saved: true, created: isNew, employeeCode: employee["Employee Code"] };
  } finally { lock.releaseLock(); }
}

function deleteEmployee_(session, data) {
  var employeeCode = cleanText_(data.employeeCode);
  if (!employeeCode) throwApi_("INVALID_DATA", "Employee code is required.");
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSpreadsheet_().getSheetByName(HR_CONFIG.EMPLOYEE_SHEET);
    var row = findRowByCode_(sheet, employeeCode);
    if (row < 2) throwApi_("NOT_FOUND", "Employee record was not found.");
    var name = sheet.getRange(row, 2).getDisplayValue();
    sheet.deleteRow(row);
    resequenceEmployees_(sheet);
    clearEmployeeCache_();
    logActivity_(session.username, "EMPLOYEE_DELETED", employeeCode, name);
    return { deleted: true };
  } finally { lock.releaseLock(); }
}

function importEmployees_(session, data) {
  var incoming = data.employees;
  if (!Array.isArray(incoming) || !incoming.length) throwApi_("INVALID_DATA", "No employee rows were supplied.");
  if (incoming.length > HR_CONFIG.MAX_IMPORT_ROWS) throwApi_("TOO_MANY_ROWS", "Import a maximum of " + HR_CONFIG.MAX_IMPORT_ROWS + " rows at a time.");
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSpreadsheet_().getSheetByName(HR_CONFIG.EMPLOYEE_SHEET);
    var existing = getEmployees_();
    var byCode = {};
    existing.forEach(function(employee) { byCode[cleanText_(employee["Employee Code"]).toLowerCase()] = employee; });
    var created = 0, updated = 0, skipped = 0;
    incoming.forEach(function(raw) {
      try {
        var employee = normalizeEmployee_(raw || {});
        validateEmployee_(employee);
        var key = employee["Employee Code"].toLowerCase();
        if (byCode[key]) { employee["Sl No."] = byCode[key]["Sl No."]; updated++; }
        else { employee["Sl No."] = ""; created++; }
        byCode[key] = employee;
      } catch (error) { skipped++; }
    });
    var all = Object.keys(byCode).map(function(key) { return byCode[key]; });
    all.sort(function(a, b) {
      var an = Number(a["Sl No."]) || 999999;
      var bn = Number(b["Sl No."]) || 999999;
      return an - bn || a["Employee Name"].localeCompare(b["Employee Name"]);
    });
    all.forEach(function(employee, index) { employee["Sl No."] = String(index + 1); });
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, HR_CONFIG.HEADERS.length).clearContent();
    if (all.length) sheet.getRange(2, 1, all.length, HR_CONFIG.HEADERS.length).setValues(all.map(toSheetRow_));
    clearEmployeeCache_();
    logActivity_(session.username, "CSV_IMPORT", "", created + " created, " + updated + " updated, " + skipped + " skipped");
    return { created: created, updated: updated, skipped: skipped, total: all.length };
  } finally { lock.releaseLock(); }
}

function createBackup_(session) {
  var employees = getEmployees_();
  var rows = [HR_CONFIG.HEADERS].concat(employees.map(function(employee) { return HR_CONFIG.HEADERS.map(function(header) { return employee[header] || ""; }); }));
  var csv = rows.map(function(row) { return row.map(csvEscape_).join(","); }).join("\r\n");
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  var file = getOrCreateDataFolder_().createFile("HR_Employee_Backup_" + stamp + ".csv", "\uFEFF" + csv, MimeType.CSV);
  logActivity_(session.username, "BACKUP_CREATED", "", file.getName());
  return { created: true, fileName: file.getName(), fileUrl: file.getUrl() };
}

function getOrCreateDataFolder_() {
  var properties = PropertiesService.getScriptProperties();
  var folderId = properties.getProperty("DATA_FOLDER_ID");
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (ignore) {}
  }
  var folders = DriveApp.getFoldersByName(HR_CONFIG.FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(HR_CONFIG.FOLDER_NAME);
  properties.setProperty("DATA_FOLDER_ID", folder.getId());
  return folder;
}

function getOrCreateSpreadsheet_(folder) {
  var properties = PropertiesService.getScriptProperties();
  var spreadsheetId = properties.getProperty("SPREADSHEET_ID");
  if (spreadsheetId) {
    try { return SpreadsheetApp.openById(spreadsheetId); } catch (ignore) {}
  }
  var spreadsheet = SpreadsheetApp.create(HR_CONFIG.SPREADSHEET_NAME);
  DriveApp.getFileById(spreadsheet.getId()).moveTo(folder);
  properties.setProperty("SPREADSHEET_ID", spreadsheet.getId());
  return spreadsheet;
}

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throwApi_("NOT_SETUP", "Run setupHRDashboard() before using the web app.");
  try { return SpreadsheetApp.openById(id); } catch (error) { throwApi_("SHEET_UNAVAILABLE", "The employee spreadsheet could not be opened."); }
}

function ensureEmployeeSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(HR_CONFIG.EMPLOYEE_SHEET) || spreadsheet.getSheets()[0];
  sheet.setName(HR_CONFIG.EMPLOYEE_SHEET);
  sheet.getRange(1, 1, 1, HR_CONFIG.HEADERS.length).setValues([HR_CONFIG.HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HR_CONFIG.HEADERS.length).setBackground("#075985").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), HR_CONFIG.HEADERS.length).setVerticalAlignment("middle");
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), HR_CONFIG.HEADERS.length).setNumberFormat("@");
  var widths = [65, 220, 120, 170, 90, 250, 105, 105, 75, 110, 110, 150, 120, 230, 70];
  widths.forEach(function(width, index) { sheet.setColumnWidth(index + 1, width); });
  sheet.setRowHeight(1, 36);
}

function ensureLogSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(HR_CONFIG.LOG_SHEET) || spreadsheet.insertSheet(HR_CONFIG.LOG_SHEET);
  var headers = ["Timestamp", "Username", "Action", "Employee Code", "Details"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setBackground("#0f766e").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 5, 180);
}

function normalizeEmployee_(raw) {
  var employee = {};
  HR_CONFIG.HEADERS.forEach(function(header) { employee[header] = cleanText_(raw[header]); });
  employee["Employee Name"] = employee["Employee Name"].substring(0, 100);
  employee["Employee Code"] = employee["Employee Code"].substring(0, 30);
  employee.Designation = employee.Designation.substring(0, 80);
  employee["REMARK ADMN"] = employee["REMARK ADMN"].substring(0, 500);
  employee.Email = employee.Email.substring(0, 120);
  employee.Mob = employee.Mob.substring(0, 15);
  employee.DoB = normalizeDate_(employee.DoB);
  employee.DoR = normalizeDate_(employee.DoR) || calculateRetirementDate_(employee.DoB);
  employee["DoJ Govt"] = normalizeDate_(employee["DoJ Govt"]);
  employee["DoJ in ADG"] = normalizeDate_(employee["DoJ in ADG"]);
  employee.AGE = calculateAge_(employee.DoB);
  return employee;
}

function validateEmployee_(employee) {
  if (!employee["Employee Name"] || !employee["Employee Code"]) throwApi_("INVALID_DATA", "Employee name and employee code are required.");
  if (employee.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.Email)) throwApi_("INVALID_EMAIL", "Enter a valid email address.");
}

function toSheetRow_(employee) {
  return HR_CONFIG.HEADERS.map(function(header) { return safeSheetText_(employee[header] == null ? "" : employee[header]); });
}

function findRowByCode_(sheet, employeeCode) {
  if (sheet.getLastRow() < 2) return -1;
  var codes = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getDisplayValues();
  var target = employeeCode.toLowerCase();
  for (var i = 0; i < codes.length; i++) if (cleanText_(codes[i][0]).toLowerCase() === target) return i + 2;
  return -1;
}

function resequenceEmployees_(sheet) {
  var count = Math.max(0, sheet.getLastRow() - 1);
  if (!count) return;
  var values = [];
  for (var i = 1; i <= count; i++) values.push([String(i)]);
  sheet.getRange(2, 1, count, 1).setValues(values);
}

function logActivity_(username, action, employeeCode, details) {
  try {
    var sheet = getSpreadsheet_().getSheetByName(HR_CONFIG.LOG_SHEET);
    sheet.appendRow([new Date(), safeSheetText_(username), safeSheetText_(action), safeSheetText_(employeeCode), safeSheetText_(details)]);
  } catch (error) { console.error("Activity log failed: " + error.message); }
}

function getUsers_() {
  var text = PropertiesService.getScriptProperties().getProperty("USERS_JSON");
  if (!text) throwApi_("NOT_SETUP", "Run setupHRDashboard() before signing in.");
  try { return JSON.parse(text); } catch (error) { throwApi_("USER_CONFIG_ERROR", "The user configuration is damaged."); }
}

function saveUsers_(users) {
  PropertiesService.getScriptProperties().setProperty("USERS_JSON", JSON.stringify(users));
}

function makeUser_(username, password, displayName, role) {
  username = cleanText_(username).toLowerCase();
  if (!username || String(password).length < 10) throw new Error("Each username needs a password of at least 10 characters.");
  var salt = Utilities.getUuid();
  return { username: username, displayName: cleanText_(displayName), role: role, salt: salt, passwordHash: hashPassword_(String(password), salt) };
}

function hashPassword_(password, salt) {
  var value = salt + "|" + password;
  for (var i = 0; i < 1200; i++) {
    value = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8));
  }
  return value;
}

function safeEqual_(a, b) {
  a = String(a || ""); b = String(b || "");
  var mismatch = a.length ^ b.length;
  var length = Math.max(a.length, b.length);
  for (var i = 0; i < length; i++) mismatch |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  return mismatch === 0;
}

function createSession_(user) {
  var secret = PropertiesService.getScriptProperties().getProperty("SESSION_SECRET") || "";
  var raw = Utilities.getUuid() + Utilities.getUuid() + new Date().getTime();
  var token = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, secret + raw, Utilities.Charset.UTF_8)).replace(/=/g, "");
  var session = { username: user.username, displayName: user.displayName, role: user.role, expiresAt: new Date().getTime() + HR_CONFIG.SESSION_SECONDS * 1000 };
  CacheService.getScriptCache().put("session:" + token, JSON.stringify(session), HR_CONFIG.SESSION_SECONDS);
  return token;
}

function requireSession_(token) {
  if (!token) throwApi_("SESSION_EXPIRED", "Please sign in again.");
  var text = CacheService.getScriptCache().get("session:" + token);
  if (!text) throwApi_("SESSION_EXPIRED", "Your session expired. Please sign in again.");
  var session = JSON.parse(text);
  if (!session.expiresAt || session.expiresAt < new Date().getTime()) {
    CacheService.getScriptCache().remove("session:" + token);
    throwApi_("SESSION_EXPIRED", "Your session expired. Please sign in again.");
  }
  return session;
}

function requireAdmin_(session) {
  if (!session || session.role !== "admin") throwApi_("FORBIDDEN", "Administrator access is required.");
}

function enforceLoginLimit_(username) {
  var key = "login:" + shortHash_(username);
  var text = CacheService.getScriptCache().get(key);
  if (!text) return;
  var attempt = JSON.parse(text);
  if (attempt.blockedUntil && attempt.blockedUntil > new Date().getTime()) throwApi_("LOGIN_BLOCKED", "Too many failed attempts. Please wait 10 minutes.");
}

function recordFailedLogin_(username) {
  var cache = CacheService.getScriptCache();
  var key = "login:" + shortHash_(username);
  var attempt = { count: 0, blockedUntil: 0 };
  try { attempt = JSON.parse(cache.get(key) || "{}") || attempt; } catch (ignore) {}
  attempt.count = Number(attempt.count || 0) + 1;
  if (attempt.count >= 5) attempt.blockedUntil = new Date().getTime() + 10 * 60 * 1000;
  cache.put(key, JSON.stringify(attempt), 600);
}

function shortHash_(text) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8)).substring(0, 28);
}

function bridgeResponse_(origin, requestId, ok, data, code, message) {
  var envelope = { channel: HR_CONFIG.CHANNEL, requestId: requestId || "", ok: ok, data: data || null, code: code || "", message: message || "" };
  var envelopeText = JSON.stringify(envelope).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  var targetOrigin = origin || "*";
  var html = "<!doctype html><html><head><meta charset='utf-8'><meta name='robots' content='noindex'><meta http-equiv='Cache-Control' content='no-store'></head><body><script>" +
    "var packet=JSON.parse(" + JSON.stringify(envelopeText) + ");" +
    "var target=" + JSON.stringify(targetOrigin) + ";" +
    "try{window.top.postMessage(packet,target);}catch(e){}" +
    "try{window.parent.postMessage(packet,target);}catch(e){}" +
    "<\/script></body></html>";
  return HtmlService.createHtmlOutput(html).setTitle("HR API response").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function isAllowedOrigin_(origin) {
  if (!origin) return false;
  var text = PropertiesService.getScriptProperties().getProperty("ALLOWED_ORIGINS") || "[]";
  var allowed = [];
  try { allowed = JSON.parse(text); } catch (ignore) {}
  return allowed.indexOf(origin) !== -1;
}

function normalizeOrigin_(value) {
  var text = cleanText_(value).replace(/\/$/, "");
  var match = text.match(/^(https:\/\/[A-Za-z0-9.-]+(?::\d+)?|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)$/);
  return match ? match[1] : "";
}

function normalizeDate_(value) {
  var text = cleanText_(value);
  if (!text) return "";
  var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
  var indian = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (indian) return indian[3] + "-" + ("0" + indian[2]).slice(-2) + "-" + ("0" + indian[1]).slice(-2);
  return "";
}

function parseIsoDate_(value) {
  var match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isNaN(date.getTime()) ? null : date;
}

function calculateAge_(dobText) {
  var dob = parseIsoDate_(normalizeDate_(dobText));
  if (!dob) return "";
  var today = new Date();
  var age = today.getFullYear() - dob.getFullYear();
  if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? String(age) : "";
}

function calculateRetirementDate_(dobText) {
  var dob = parseIsoDate_(normalizeDate_(dobText));
  if (!dob) return "";
  var year = dob.getFullYear() + 60;
  var month = dob.getMonth();
  var retirement = dob.getDate() === 1 ? new Date(year, month, 0) : new Date(year, month + 1, 0);
  return retirement.getFullYear() + "-" + ("0" + (retirement.getMonth() + 1)).slice(-2) + "-" + ("0" + retirement.getDate()).slice(-2);
}

function cleanText_(value) {
  return value == null ? "" : String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

function safeSheetText_(value) {
  var text = cleanText_(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function csvEscape_(value) {
  var text = String(value == null ? "" : value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function clearEmployeeCache_() {
  CacheService.getScriptCache().remove("employees:v1");
}

function throwApi_(code, message) {
  var error = new Error(message);
  error.apiCode = code;
  throw error;
}
