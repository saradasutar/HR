"use strict";

/* Replace only this URL after deploying Code.gs as a Google Apps Script web app. */
const CONFIG = Object.freeze({
  API_URL: "https://script.google.com/macros/s/AKfycbzxjIrPXXiXaCVZdB5QbOYf61AHz4a9574DDfWd0TnJk3Y1SBLVgoN-WN9hDJyqYOFP/exec",
  CHANNEL: "ADG_HR_API_V1",
  PAGE_SIZE: 20,
  REQUEST_TIMEOUT_MS: 45000
});

const COLUMNS = [
  "Sl No.", "Employee Name", "Employee Code", "Designation", "Grp",
  "REMARK ADMN", "DoB", "DoR", "Cat", "DoJ Govt", "DoJ in ADG",
  "Present/Permanent", "Mob", "Email", "AGE"
];

const state = {
  token: sessionStorage.getItem("hrSessionToken") || "",
  role: sessionStorage.getItem("hrRole") || "",
  displayName: sessionStorage.getItem("hrDisplayName") || "",
  username: sessionStorage.getItem("hrUsername") || "",
  employees: [],
  filtered: [],
  page: 1,
  sortColumn: "Sl No.",
  sortDirection: "asc",
  search: ""
};

const $ = (id) => document.getElementById(id);
const refs = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  [
    "loginView", "dashboardView", "loginForm", "username", "password", "togglePassword",
    "rememberUsername", "loginButton", "loginError", "logoutButton", "refreshButton",
    "lastUpdated", "displayName", "roleLabel", "userInitial", "statTotal", "statPresent",
    "statRetiring", "statGroupB", "resultSummary", "globalSearch", "groupFilter",
    "categoryFilter", "statusFilter", "clearFilters", "tableHead", "tableBody", "emptyState",
    "pageInfo", "pageNumber", "prevPage", "nextPage", "exportButton", "importButton",
    "csvFileInput", "backupButton", "addEmployeeButton", "employeeDialog", "employeeForm",
    "employeeDialogTitle", "originalEmployeeCode", "employeeFormError", "saveEmployeeButton",
    "fieldEmployeeName", "fieldEmployeeCode", "fieldDesignation", "fieldGroup", "fieldRemarks",
    "fieldDoB", "fieldDoR", "fieldCategory", "fieldDoJGovt", "fieldDoJADG", "fieldStatus",
    "fieldMobile", "fieldEmail", "fieldAge", "loadingOverlay", "loadingText", "toastRegion",
    "changePasswordButton", "passwordDialog", "passwordForm", "currentPassword", "newPassword",
    "confirmPassword", "passwordFormError"
  ].forEach((id) => { refs[id] = $(id); });

  const remembered = localStorage.getItem("hrRememberedUsername") || "";
  refs.username.value = remembered;
  refs.rememberUsername.checked = Boolean(remembered);

  refs.loginForm.addEventListener("submit", handleLogin);
  refs.togglePassword.addEventListener("click", togglePasswordVisibility);
  refs.logoutButton.addEventListener("click", logout);
  refs.refreshButton.addEventListener("click", () => loadEmployees(true));
  refs.globalSearch.addEventListener("input", debounce(applyFilters, 140));
  refs.groupFilter.addEventListener("change", applyFilters);
  refs.categoryFilter.addEventListener("change", applyFilters);
  refs.statusFilter.addEventListener("change", applyFilters);
  refs.clearFilters.addEventListener("click", clearFilters);
  refs.prevPage.addEventListener("click", () => changePage(-1));
  refs.nextPage.addEventListener("click", () => changePage(1));
  refs.exportButton.addEventListener("click", exportFilteredCsv);
  refs.importButton.addEventListener("click", () => refs.csvFileInput.click());
  refs.csvFileInput.addEventListener("change", importCsv);
  refs.backupButton.addEventListener("click", createBackup);
  refs.addEmployeeButton.addEventListener("click", () => openEmployeeDialog());
  refs.employeeForm.addEventListener("submit", saveEmployee);
  refs.fieldDoB.addEventListener("change", updateCalculatedFields);
  refs.changePasswordButton.addEventListener("click", () => refs.passwordDialog.showModal());
  refs.passwordForm.addEventListener("submit", changePassword);
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => $(button.dataset.closeDialog).close());
  });
  document.addEventListener("keydown", handleKeyboardShortcut);
  refs.tableBody.addEventListener("click", handleTableAction);

  buildTableHeader();
  if (state.token) restoreSession();
}

function togglePasswordVisibility() {
  const show = refs.password.type === "password";
  refs.password.type = show ? "text" : "password";
  refs.togglePassword.textContent = show ? "Hide" : "Show";
  refs.togglePassword.setAttribute("aria-label", show ? "Hide password" : "Show password");
}

async function handleLogin(event) {
  event.preventDefault();
  refs.loginError.textContent = "";
  const username = refs.username.value.trim();
  const password = refs.password.value;
  if (!username || !password) return;
  if (!isApiConfigured()) {
    refs.loginError.textContent = "Connect the Google Apps Script URL in app.js before signing in.";
    return;
  }

  setButtonBusy(refs.loginButton, true, "Signing in…");
  try {
    const response = await apiRequest("login", { username, password }, false);
    state.token = response.token;
    state.role = response.role;
    state.displayName = response.displayName;
    state.username = response.username;
    sessionStorage.setItem("hrSessionToken", state.token);
    sessionStorage.setItem("hrRole", state.role);
    sessionStorage.setItem("hrDisplayName", state.displayName);
    sessionStorage.setItem("hrUsername", state.username);
    if (refs.rememberUsername.checked) localStorage.setItem("hrRememberedUsername", username);
    else localStorage.removeItem("hrRememberedUsername");
    refs.password.value = "";
    showDashboard();
    await loadEmployees();
  } catch (error) {
    refs.loginError.textContent = friendlyError(error);
  } finally {
    setButtonBusy(refs.loginButton, false, "Sign in securely");
  }
}

async function restoreSession() {
  showDashboard();
  try {
    await loadEmployees();
  } catch (error) {
    clearSession();
    showLogin();
    refs.loginError.textContent = error.code === "SESSION_EXPIRED" ? "Your session expired. Please sign in again." : friendlyError(error);
  }
}

function showDashboard() {
  refs.loginView.hidden = true;
  refs.dashboardView.hidden = false;
  refs.changePasswordButton.hidden = false;
  refs.displayName.textContent = state.displayName || state.username || "User";
  refs.roleLabel.textContent = state.role === "admin" ? "Administrator access" : "View-only access";
  refs.userInitial.textContent = (state.displayName || state.username || "U").charAt(0).toUpperCase();
  document.querySelectorAll(".admin-only").forEach((node) => { node.hidden = state.role !== "admin"; });
}

function showLogin() {
  refs.loginView.hidden = false;
  refs.dashboardView.hidden = true;
  refs.changePasswordButton.hidden = true;
  setTimeout(() => refs.username.focus(), 20);
}

async function logout() {
  try { if (state.token) await apiRequest("logout", {}); } catch { /* Local cleanup still logs out. */ }
  clearSession();
  state.employees = [];
  state.filtered = [];
  showLogin();
  showToast("You have been signed out.");
}

function clearSession() {
  ["hrSessionToken", "hrRole", "hrDisplayName", "hrUsername"].forEach((key) => sessionStorage.removeItem(key));
  state.token = ""; state.role = ""; state.displayName = ""; state.username = "";
}

async function loadEmployees(isRefresh) {
  showLoading(isRefresh ? "Refreshing employee records…" : "Loading employee records…");
  try {
    const response = await apiRequest("getEmployees", { force: Boolean(isRefresh) });
    state.employees = Array.isArray(response.employees) ? response.employees : [];
    state.page = 1;
    populateFilters();
    applyFilters();
    refs.lastUpdated.textContent = "Updated " + new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    if (isRefresh) showToast("Employee data refreshed.");
  } finally { hideLoading(); }
}

function buildTableHeader() {
  refs.tableHead.innerHTML = "";
  COLUMNS.concat("Actions").forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column;
    if (column === "Actions") {
      th.className = "admin-column";
      th.hidden = state.role !== "admin";
    } else {
      th.tabIndex = 0;
      th.title = "Sort by " + column;
      th.addEventListener("click", () => sortBy(column));
      th.addEventListener("keydown", (event) => { if (event.key === "Enter") sortBy(column); });
    }
    refs.tableHead.appendChild(th);
  });
}

function populateFilters() {
  populateSelect(refs.groupFilter, uniqueValues("Grp"), "All groups");
  populateSelect(refs.categoryFilter, uniqueValues("Cat"), "All categories");
  populateSelect(refs.statusFilter, uniqueValues("Present/Permanent"), "All statuses");
}

function uniqueValues(key) {
  return [...new Set(state.employees.map((item) => String(item[key] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function populateSelect(select, values, firstLabel) {
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>` + values.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("");
  if (values.includes(current)) select.value = current;
}

function applyFilters() {
  const query = refs.globalSearch.value.trim().toLocaleLowerCase();
  const group = refs.groupFilter.value;
  const category = refs.categoryFilter.value;
  const status = refs.statusFilter.value;
  state.search = query;
  state.filtered = state.employees.filter((employee) => {
    const searchable = COLUMNS.map((key) => employee[key] || "").join(" ").toLocaleLowerCase();
    return (!query || searchable.includes(query)) && (!group || employee.Grp === group) && (!category || employee.Cat === category) && (!status || employee["Present/Permanent"] === status);
  });
  sortEmployees();
  state.page = Math.min(state.page, Math.max(1, Math.ceil(state.filtered.length / CONFIG.PAGE_SIZE)));
  updateStats();
  renderTable();
}

function clearFilters() {
  refs.globalSearch.value = "";
  refs.groupFilter.value = "";
  refs.categoryFilter.value = "";
  refs.statusFilter.value = "";
  state.page = 1;
  applyFilters();
}

function sortBy(column) {
  if (state.sortColumn === column) state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  else { state.sortColumn = column; state.sortDirection = "asc"; }
  sortEmployees();
  renderTable();
}

function sortEmployees() {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  const column = state.sortColumn;
  state.filtered.sort((a, b) => String(a[column] || "").localeCompare(String(b[column] || ""), undefined, { numeric: true, sensitivity: "base" }) * direction);
}

function renderTable() {
  buildTableHeader();
  const total = state.filtered.length;
  const start = (state.page - 1) * CONFIG.PAGE_SIZE;
  const pageRows = state.filtered.slice(start, start + CONFIG.PAGE_SIZE);
  refs.tableBody.innerHTML = pageRows.map((employee) => {
    const cells = COLUMNS.map((column) => {
      let raw = employee[column] == null ? "" : String(employee[column]);
      let display = ["DoB", "DoR", "DoJ Govt", "DoJ in ADG"].includes(column) ? formatDate(raw) : raw;
      let value = highlight(display, state.search);
      if (column === "Grp" && raw) value = `<span class="badge group">${escapeHtml(raw)}</span>`;
      if (column === "Cat" && raw) value = `<span class="badge category">${escapeHtml(raw)}</span>`;
      if (column === "Present/Permanent" && raw) value = `<span class="badge status">${escapeHtml(raw)}</span>`;
      const className = column === "REMARK ADMN" ? "remarks-cell" : "";
      return `<td class="${className}" title="${escapeAttribute(display)}">${value || "—"}</td>`;
    }).join("");
    const actions = state.role === "admin" ? `<td><div class="action-cell"><button class="row-action" data-action="edit" data-code="${escapeAttribute(employee["Employee Code"])}">Edit</button><button class="row-action delete" data-action="delete" data-code="${escapeAttribute(employee["Employee Code"])}">Delete</button></div></td>` : "";
    return `<tr>${cells}${actions}</tr>`;
  }).join("");

  refs.emptyState.hidden = total !== 0;
  refs.employeeTable.hidden = total === 0;
  refs.resultSummary.textContent = `${total} record${total === 1 ? "" : "s"}${state.search ? " matching search" : ""}`;
  const shownStart = total ? start + 1 : 0;
  const shownEnd = Math.min(start + CONFIG.PAGE_SIZE, total);
  const pageCount = Math.max(1, Math.ceil(total / CONFIG.PAGE_SIZE));
  refs.pageInfo.textContent = `Showing ${shownStart}–${shownEnd} of ${total}`;
  refs.pageNumber.textContent = `Page ${state.page} of ${pageCount}`;
  refs.prevPage.disabled = state.page <= 1;
  refs.nextPage.disabled = state.page >= pageCount;
}

function updateStats() {
  refs.statTotal.textContent = state.employees.length.toLocaleString("en-IN");
  refs.statPresent.textContent = state.employees.filter((employee) => /present/i.test(employee["Present/Permanent"] || "")).length.toLocaleString("en-IN");
  refs.statGroupB.textContent = state.employees.filter((employee) => /(^|\s)b($|\s)/i.test(employee.Grp || "")).length.toLocaleString("en-IN");
  const now = new Date();
  const limit = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  refs.statRetiring.textContent = state.employees.filter((employee) => { const date = parseDate(employee.DoR); return date && date >= now && date <= limit; }).length.toLocaleString("en-IN");
}

function changePage(delta) {
  const pages = Math.max(1, Math.ceil(state.filtered.length / CONFIG.PAGE_SIZE));
  state.page = Math.min(pages, Math.max(1, state.page + delta));
  renderTable();
  document.querySelector(".data-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleTableAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button || state.role !== "admin") return;
  const employee = state.employees.find((item) => item["Employee Code"] === button.dataset.code);
  if (!employee) return;
  if (button.dataset.action === "edit") openEmployeeDialog(employee);
  if (button.dataset.action === "delete") deleteEmployee(employee);
}

function openEmployeeDialog(employee) {
  const item = employee || {};
  refs.employeeForm.reset();
  refs.employeeFormError.textContent = "";
  refs.employeeDialogTitle.textContent = employee ? "Edit employee" : "Add employee";
  refs.originalEmployeeCode.value = item["Employee Code"] || "";
  refs.fieldEmployeeName.value = item["Employee Name"] || "";
  refs.fieldEmployeeCode.value = item["Employee Code"] || "";
  refs.fieldDesignation.value = item.Designation || "";
  setSelectValue(refs.fieldGroup, item.Grp || "");
  refs.fieldRemarks.value = item["REMARK ADMN"] || "";
  refs.fieldDoB.value = toIsoDate(item.DoB || "");
  refs.fieldDoR.value = toIsoDate(item.DoR || "");
  setSelectValue(refs.fieldCategory, item.Cat || "");
  refs.fieldDoJGovt.value = toIsoDate(item["DoJ Govt"] || "");
  refs.fieldDoJADG.value = toIsoDate(item["DoJ in ADG"] || "");
  setSelectValue(refs.fieldStatus, item["Present/Permanent"] || "");
  refs.fieldMobile.value = item.Mob || "";
  refs.fieldEmail.value = item.Email || "";
  refs.fieldAge.value = item.AGE || "";
  refs.employeeDialog.showModal();
  setTimeout(() => refs.fieldEmployeeName.focus(), 30);
}

function setSelectValue(select, value) {
  if (value && ![...select.options].some((option) => option.value === value)) select.add(new Option(value, value));
  select.value = value;
}

function updateCalculatedFields() {
  refs.fieldAge.value = calculateAge(refs.fieldDoB.value);
  if (!refs.fieldDoR.value) refs.fieldDoR.value = calculateGovernmentRetirement(refs.fieldDoB.value);
}

async function saveEmployee(event) {
  event.preventDefault();
  refs.employeeFormError.textContent = "";
  if (!refs.employeeForm.reportValidity()) return;
  const employee = {
    "Employee Name": refs.fieldEmployeeName.value.trim(),
    "Employee Code": refs.fieldEmployeeCode.value.trim(),
    "Designation": refs.fieldDesignation.value.trim(),
    "Grp": refs.fieldGroup.value,
    "REMARK ADMN": refs.fieldRemarks.value.trim(),
    "DoB": refs.fieldDoB.value,
    "DoR": refs.fieldDoR.value,
    "Cat": refs.fieldCategory.value,
    "DoJ Govt": refs.fieldDoJGovt.value,
    "DoJ in ADG": refs.fieldDoJADG.value,
    "Present/Permanent": refs.fieldStatus.value,
    "Mob": refs.fieldMobile.value.trim(),
    "Email": refs.fieldEmail.value.trim(),
    "AGE": refs.fieldAge.value
  };
  setButtonBusy(refs.saveEmployeeButton, true, "Saving…");
  try {
    await apiRequest("saveEmployee", { employee, originalEmployeeCode: refs.originalEmployeeCode.value });
    refs.employeeDialog.close();
    showToast(refs.originalEmployeeCode.value ? "Employee record updated." : "Employee added.");
    await loadEmployees();
  } catch (error) { refs.employeeFormError.textContent = friendlyError(error); }
  finally { setButtonBusy(refs.saveEmployeeButton, false, "Save employee"); }
}

async function deleteEmployee(employee) {
  if (!confirm(`Delete the record of ${employee["Employee Name"]}?\n\nThis action will be recorded in the activity log.`)) return;
  showLoading("Deleting employee record…");
  try {
    await apiRequest("deleteEmployee", { employeeCode: employee["Employee Code"] });
    showToast("Employee record deleted.");
    await loadEmployees();
  } catch (error) { showToast(friendlyError(error), true); }
  finally { hideLoading(); }
}

async function importCsv(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error("The CSV file contains no employee rows.");
    if (rows.length > 1000) throw new Error("Import a maximum of 1,000 employees at a time.");
    if (!confirm(`Import ${rows.length} employee record(s)? Existing employee codes will be updated.`)) return;
    showLoading(`Importing ${rows.length} employee records…`);
    const result = await apiRequest("importEmployees", { employees: rows });
    showToast(`Import complete: ${result.created} added, ${result.updated} updated${result.skipped ? `, ${result.skipped} skipped` : ""}.`);
    await loadEmployees();
  } catch (error) { showToast(friendlyError(error), true); }
  finally { hideLoading(); }
}

function parseCsv(text) {
  const matrix = [];
  let row = [], cell = "", quoted = false;
  text = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/, "")); matrix.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); matrix.push(row); }
  if (!matrix.length) return [];
  const headers = matrix.shift().map((header) => header.trim());
  const required = ["Employee Name", "Employee Code"];
  required.forEach((header) => { if (!headers.includes(header)) throw new Error(`CSV column missing: ${header}`); });
  return matrix.filter((values) => values.some((value) => value.trim())).map((values) => {
    const item = {}; headers.forEach((header, index) => { if (COLUMNS.includes(header)) item[header] = values[index] == null ? "" : values[index].trim(); }); return item;
  });
}

function exportFilteredCsv() {
  const rows = [COLUMNS].concat(state.filtered.map((employee) => COLUMNS.map((key) => employee[key] || "")));
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `ADG_HR_Employees_${isoToday()}.csv`);
  showToast(`Exported ${state.filtered.length} employee record(s).`);
}

async function createBackup() {
  showLoading("Creating a Drive backup…");
  try {
    const result = await apiRequest("createBackup", {});
    showToast("Backup created in Google Drive.");
    if (result.fileUrl && confirm("Backup created successfully. Open it in Google Drive?")) window.open(result.fileUrl, "_blank", "noopener");
  } catch (error) { showToast(friendlyError(error), true); }
  finally { hideLoading(); }
}

async function changePassword(event) {
  event.preventDefault();
  refs.passwordFormError.textContent = "";
  if (refs.newPassword.value !== refs.confirmPassword.value) {
    refs.passwordFormError.textContent = "New passwords do not match.";
    return;
  }
  try {
    await apiRequest("changePassword", { currentPassword: refs.currentPassword.value, newPassword: refs.newPassword.value });
    refs.passwordDialog.close();
    refs.passwordForm.reset();
    showToast("Password changed. Please sign in again.");
    clearSession();
    showLogin();
  } catch (error) { refs.passwordFormError.textContent = friendlyError(error); }
}

function apiRequest(action, data, includeToken = true) {
  return new Promise((resolve, reject) => {
    if (!isApiConfigured()) { reject(Object.assign(new Error("Google Apps Script URL is not configured."), { code: "NOT_CONFIGURED" })); return; }
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const frame = document.createElement("iframe");
    frame.name = `hr_api_${requestId}`;
    frame.title = "HR API response";
    frame.style.display = "none";
    const form = document.createElement("form");
    form.method = "POST";
    form.action = CONFIG.API_URL;
    form.target = frame.name;
    form.style.display = "none";
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify({ action, data: data || {}, token: includeToken ? state.token : "", requestId, origin: location.origin });
    form.appendChild(input);
    let finished = false;
    const cleanup = () => { window.removeEventListener("message", onMessage); form.remove(); setTimeout(() => frame.remove(), 0); };
    const timeout = setTimeout(() => { if (finished) return; finished = true; cleanup(); reject(Object.assign(new Error("The backend took too long to respond."), { code: "TIMEOUT" })); }, CONFIG.REQUEST_TIMEOUT_MS);
    const onMessage = (event) => {
      if (event.source !== frame.contentWindow || !event.data || event.data.channel !== CONFIG.CHANNEL || event.data.requestId !== requestId || finished) return;
      finished = true; clearTimeout(timeout); cleanup();
      if (event.data.ok) resolve(event.data.data || {});
      else reject(Object.assign(new Error(event.data.message || "Request failed."), { code: event.data.code || "API_ERROR" }));
    };
    window.addEventListener("message", onMessage);
    document.body.append(frame, form);
    form.submit();
  });
}

function isApiConfigured() { return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(CONFIG.API_URL); }
function showLoading(text) { refs.loadingText.textContent = text || "Loading…"; refs.loadingOverlay.hidden = false; }
function hideLoading() { refs.loadingOverlay.hidden = true; }
function showToast(message, isError) { const toast = document.createElement("div"); toast.className = "toast" + (isError ? " error" : ""); toast.textContent = message; refs.toastRegion.appendChild(toast); setTimeout(() => toast.remove(), 4500); }
function setButtonBusy(button, busy, text) { button.disabled = busy; const first = button.querySelector("span") || button; first.textContent = text; }
function friendlyError(error) {
  const messages = { INVALID_LOGIN: "Incorrect username or password.", LOGIN_BLOCKED: "Too many failed attempts. Please wait 10 minutes.", SESSION_EXPIRED: "Your session expired. Please sign in again.", FORBIDDEN: "Your account does not have permission for this action.", DUPLICATE_CODE: "That employee code already exists.", ORIGIN_BLOCKED: "This GitHub address is not allowed by the backend.", TIMEOUT: "The backend did not respond. Check the Apps Script deployment and internet connection.", NOT_CONFIGURED: "Connect the Apps Script web app URL in app.js first." };
  return messages[error.code] || error.message || "Something went wrong. Please try again.";
}
function calculateAge(value) { const dob = parseDate(value); if (!dob) return ""; const today = new Date(); let age = today.getFullYear() - dob.getFullYear(); const beforeBirthday = today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate()); if (beforeBirthday) age -= 1; return age >= 0 ? String(age) : ""; }
function calculateGovernmentRetirement(value) { const dob = parseDate(value); if (!dob) return ""; const year = dob.getFullYear() + 60; const month = dob.getMonth(); const date = dob.getDate() === 1 ? new Date(year, month, 0) : new Date(year, month + 1, 0); return toIsoLocal(date); }
function parseDate(value) { if (!value) return null; const iso = toIsoDate(value); if (!iso) return null; const parts = iso.split("-").map(Number); const date = new Date(parts[0], parts[1] - 1, parts[2]); return Number.isNaN(date.getTime()) ? null : date; }
function toIsoDate(value) { const text = String(value || "").trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text; const match = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/); return match ? `${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}` : ""; }
function toIsoLocal(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function formatDate(value) { const date = parseDate(value); return date ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date) : value; }
function isoToday() { return toIsoLocal(new Date()); }
function csvEscape(value) { const text = String(value == null ? "" : value); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g,'""')}"` : text; }
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function highlight(value, query) { const safe = escapeHtml(value); if (!query) return safe; const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return safe.replace(new RegExp(`(${escapedQuery})`, "ig"), "<mark>$1</mark>"); }
function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character])); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }
function debounce(fn, delay) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; }
function handleKeyboardShortcut(event) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !refs.dashboardView.hidden) { event.preventDefault(); refs.globalSearch.focus(); } }
