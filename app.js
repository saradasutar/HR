"use strict";

/* Replace only this URL after deploying Code.gs as a Google Apps Script web app. */
const CONFIG = Object.freeze({
  API_URL: "https://script.google.com/macros/s/AKfycbzgfFaJUqLK1q49EcaYcC2xAOQTtzYtH5D4pyjBFlCVgM7DuFx0LYgVhzLNGz2wlzFv/exec",
  CHANNEL: "ADG_HR_API_V1",
  FRONTEND_VERSION: "1.5.6",
  REQUIRED_BACKEND_VERSION: "1.5.6",
  PAGE_SIZE: 20,
  REQUEST_TIMEOUT_MS: 45000
});

const COLUMNS = [
  "Sl No.", "Employee Name", "Employee Code", "Designation", "Grp",
  "DoB", "DoR", "Cat", "DoJ Govt", "DoJ in Current Office",
  "Present/Permanent Address", "Mob", "Email", "AGE", "Strength Status",
  "Relieving Date", "Post Sensitivity", "REMARK ADMN"
];

const DEFAULT_COLUMN_LABELS = Object.freeze(Object.assign(COLUMNS.reduce((labels, column) => {
  labels[column] = column;
  return labels;
}, {}), {
  "DoJ in Current Office": "DoJ in ADG",
  "Present/Permanent Address": "Present/Permanent"
}));

const STRENGTH_STATUSES = Object.freeze(["Present", "Relieved", "Transferred", "Retired"]);
const SENSITIVITY_VALUES = Object.freeze(["Sensitive", "Non-Sensitive"]);
const CSV_HEADER_ALIASES = Object.freeze({
  "DoJ in ADG": "DoJ in Current Office",
  "Present/Permanent": "Present/Permanent Address"
});

const DETAIL_SECTIONS = Object.freeze([
  { title: "Identity and posting", fields: ["Sl No.", "Employee Name", "Employee Code", "Designation", "Grp", "Cat"] },
  { title: "Service details", fields: ["Strength Status", "Post Sensitivity", "Relieving Date", "DoJ Govt", "DoJ in Current Office", "DoR"] },
  { title: "Personal and contact details", fields: ["DoB", "AGE", "Present/Permanent Address", "Mob", "Email"] },
  { title: "Administration", fields: ["REMARK ADMN"] }
]);

const DATE_REPORTS = Object.freeze({
  retirement: { field: "DoR", title: "Employees retiring" },
  "joining-govt": { field: "DoJ Govt", title: "Employees who joined Government" },
  "joining-office": { field: "DoJ in Current Office", title: "Employees who joined the current office" },
  relieving: { field: "Relieving Date", title: "Employees relieved / exited" }
});

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
  search: "",
  detailEmployeeCode: "",
  reportRows: [],
  reportColumns: [],
  reportTitle: "",
  reportCriteria: "",
  reportType: "age",
  directEditEnabled: false,
  headerEditEnabled: false,
  inlineEditCode: "",
  columnLabels: Object.assign({}, DEFAULT_COLUMN_LABELS),
  headerLabelsDirty: false,
  backendVersion: "",
  backendMismatchNotified: false
};

const $ = (id) => document.getElementById(id);
const refs = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  [
    "loginView", "dashboardView", "loginForm", "username", "password", "togglePassword",
    "rememberUsername", "loginButton", "loginError", "logoutButton", "refreshButton",
    "lastUpdated", "displayName", "roleLabel", "userInitial", "statTotal", "statPresent",
    "statSensitive", "statNonSensitive", "statRetiring", "statGroupB", "resultSummary", "globalSearch", "groupFilter",
    "categoryFilter", "statusFilter", "sensitivityFilter", "clearFilters", "employeeTable", "tableHead", "tableBody", "emptyState",
    "pageInfo", "pageNumber", "prevPage", "nextPage", "exportButton", "importButton", "replaceAllButton", "printFilteredButton", "directEditToggle", "editHeadersButton", "saveHeadersButton", "resetHeadersButton",
    "csvFileInput", "replaceCsvFileInput", "backupButton", "addEmployeeButton", "employeeDialog", "employeeForm",
    "employeeDialogTitle", "originalEmployeeCode", "employeeFormError", "saveEmployeeButton",
    "fieldEmployeeName", "fieldEmployeeCode", "fieldDesignation", "fieldGroup", "fieldRemarks",
    "fieldDoB", "fieldDoR", "fieldCategory", "fieldDoJGovt", "fieldDoJOffice", "fieldAddress",
    "fieldPostSensitivity", "fieldStrengthStatus", "fieldRelievingDate", "relievingDateHint",
    "fieldMobile", "fieldEmail", "fieldAge", "loadingOverlay", "loadingText", "toastRegion",
    "employeeDetailsDialog", "detailsAvatar", "detailsEmployeeName", "detailsEmployeeSubtitle",
    "detailsStrengthStatus", "detailsPostSensitivity", "employeeDetailsContent", "detailsEditButton",
    "reportsButton", "reportDialog", "reportForm", "reportType", "reportReferenceField",
    "reportReferenceDate", "reportAgeMinField", "reportAgeMin", "reportAgeMaxField", "reportAgeMax",
    "reportFromField", "reportFromDate", "reportToField", "reportToDate", "reportValueField",
    "reportValueLabel", "reportValue", "reportTextField", "reportTextValue", "reportResetButton",
    "reportTitle", "reportCriteria", "reportCount", "reportGeneratedAt", "reportTableWrap",
    "reportTable", "reportTableHead", "reportTableBody", "reportEmptyState", "reportFooterSummary",
    "reportExportButton", "reportPrintButton",
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
  refs.sensitivityFilter.addEventListener("change", applyFilters);
  refs.clearFilters.addEventListener("click", clearFilters);
  refs.prevPage.addEventListener("click", () => changePage(-1));
  refs.nextPage.addEventListener("click", () => changePage(1));
  refs.exportButton.addEventListener("click", exportFilteredCsv);
  refs.printFilteredButton.addEventListener("click", openFilteredReport);
  refs.directEditToggle.addEventListener("click", toggleDirectEdit);
  refs.editHeadersButton.addEventListener("click", toggleHeaderEdit);
  refs.saveHeadersButton.addEventListener("click", saveHeaderLabels);
  refs.resetHeadersButton.addEventListener("click", resetHeaderLabels);
  refs.importButton.addEventListener("click", () => refs.csvFileInput.click());
  refs.csvFileInput.addEventListener("change", importCsv);
  refs.replaceAllButton.addEventListener("click", () => refs.replaceCsvFileInput.click());
  refs.replaceCsvFileInput.addEventListener("change", replaceAllCsv);
  refs.backupButton.addEventListener("click", createBackup);
  refs.addEmployeeButton.addEventListener("click", () => openEmployeeDialog());
  refs.reportsButton.addEventListener("click", openReports);
  refs.reportForm.addEventListener("submit", generateReport);
  refs.reportType.addEventListener("change", updateReportControls);
  refs.reportResetButton.addEventListener("click", () => resetReportForm(true));
  refs.reportExportButton.addEventListener("click", exportReportCsv);
  refs.reportPrintButton.addEventListener("click", printReport);
  document.querySelectorAll("[data-report-preset]").forEach((button) => button.addEventListener("click", applyReportPreset));
  window.addEventListener("afterprint", () => document.body.classList.remove("printing-report"));
  refs.employeeForm.addEventListener("submit", saveEmployee);
  refs.fieldDoB.addEventListener("change", updateCalculatedFields);
  refs.fieldStrengthStatus.addEventListener("change", updateStrengthDateState);
  refs.changePasswordButton.addEventListener("click", () => refs.passwordDialog.showModal());
  refs.detailsEditButton.addEventListener("click", editSelectedEmployee);
  refs.passwordForm.addEventListener("submit", changePassword);
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => $(button.dataset.closeDialog).close());
  });
  document.addEventListener("keydown", handleKeyboardShortcut);
  refs.tableBody.addEventListener("click", handleTableAction);
  refs.tableBody.addEventListener("keydown", handleTableKeydown);
  refs.tableBody.addEventListener("change", handleInlineFieldChange);
  refs.tableHead.addEventListener("input", handleHeaderLabelInput);

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
  if (state.role !== "admin") {
    state.directEditEnabled = false;
    state.headerEditEnabled = false;
    state.inlineEditCode = "";
    state.headerLabelsDirty = false;
  }
  updateDirectEditButton();
  updateHeaderEditButtons();
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
  state.directEditEnabled = false; state.headerEditEnabled = false; state.inlineEditCode = ""; state.headerLabelsDirty = false;
}

async function loadEmployees(isRefresh) {
  showLoading(isRefresh ? "Refreshing employee records…" : "Loading employee records…");
  try {
    const response = await apiRequest("getEmployees", { force: Boolean(isRefresh) });
    state.employees = Array.isArray(response.employees) ? response.employees : [];
    state.backendVersion = String(response.version || "").trim();
    state.columnLabels = Object.assign({}, DEFAULT_COLUMN_LABELS, response.columnLabels || {});
    state.headerLabelsDirty = false;
    state.page = 1;
    populateFilters();
    applyFilters();
    refs.lastUpdated.textContent = "Updated " + new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    if (!versionAtLeast(state.backendVersion, CONFIG.REQUIRED_BACKEND_VERSION) && !state.backendMismatchNotified) {
      state.backendMismatchNotified = true;
      showToast(`Backend update incomplete${state.backendVersion ? ` (currently v${state.backendVersion})` : ""}. Deploy Code.gs v${CONFIG.REQUIRED_BACKEND_VERSION} as a new version.`, true);
    }
    if (isRefresh) showToast("Employee data refreshed.");
  } finally { hideLoading(); }
}

function buildTableHeader() {
  refs.tableHead.innerHTML = "";
  COLUMNS.concat("Actions").forEach((column) => {
    const th = document.createElement("th");
    if (column === "Actions") {
      th.className = "admin-column";
      th.hidden = state.role !== "admin";
      th.textContent = state.directEditEnabled ? "Edit / Actions" : "Actions";
    } else if (state.headerEditEnabled && state.role === "admin") {
      th.className = "direct-edit-header";
      const input = document.createElement("input");
      input.className = "header-edit-input";
      input.type = "text";
      input.maxLength = 60;
      input.required = true;
      input.value = columnLabel(column);
      input.dataset.headerKey = column;
      input.setAttribute("aria-label", `Visible header name for ${column}`);
      input.title = `Edit the visible name for ${column}. The protected data key will remain unchanged.`;
      th.appendChild(input);
    } else {
      th.textContent = columnLabel(column);
      th.tabIndex = 0;
      th.title = "Sort by " + columnLabel(column);
      th.addEventListener("click", () => sortBy(column));
      th.addEventListener("keydown", (event) => { if (event.key === "Enter") sortBy(column); });
    }
    refs.tableHead.appendChild(th);
  });
}

function columnLabel(column) {
  return String(state.columnLabels[column] || DEFAULT_COLUMN_LABELS[column] || column);
}

function handleHeaderLabelInput(event) {
  if (!event.target.closest("[data-header-key]") || state.role !== "admin") return;
  state.headerLabelsDirty = true;
  refs.saveHeadersButton.disabled = false;
}

async function saveHeaderLabels() {
  if (state.role !== "admin") return;
  const inputs = [...refs.tableHead.querySelectorAll("[data-header-key]")];
  const columnLabels = {};
  const used = new Set();
  for (const input of inputs) {
    const label = input.value.trim();
    if (!label) {
      showToast("Every column must have a header name.", true);
      input.focus();
      return;
    }
    const duplicateKey = label.toLocaleLowerCase();
    if (used.has(duplicateKey)) {
      showToast("Each header name must be different.", true);
      input.focus();
      return;
    }
    used.add(duplicateKey);
    columnLabels[input.dataset.headerKey] = label;
  }

  setButtonBusy(refs.saveHeadersButton, true, "Saving…");
  try {
    const response = await apiRequest("saveColumnLabels", { columnLabels });
    state.columnLabels = Object.assign({}, DEFAULT_COLUMN_LABELS, response.columnLabels || columnLabels);
    state.headerLabelsDirty = false;
    showToast("Dashboard header names saved for all users.");
    state.headerEditEnabled = false;
    buildTableHeader();
    updateHeaderEditButtons();
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    setButtonBusy(refs.saveHeadersButton, false, "Save headers");
    refs.saveHeadersButton.disabled = !state.headerLabelsDirty;
  }
}

async function resetHeaderLabels() {
  if (state.role !== "admin" || !confirm("Restore all visible dashboard headers to their standard names?")) return;
  setButtonBusy(refs.resetHeadersButton, true, "Resetting…");
  try {
    const response = await apiRequest("saveColumnLabels", { columnLabels: DEFAULT_COLUMN_LABELS });
    state.columnLabels = Object.assign({}, DEFAULT_COLUMN_LABELS, response.columnLabels || {});
    state.headerLabelsDirty = false;
    state.headerEditEnabled = false;
    buildTableHeader();
    updateHeaderEditButtons();
    showToast("Standard header names restored.");
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    setButtonBusy(refs.resetHeadersButton, false, "Reset headers");
  }
}

function populateFilters() {
  populateSelect(refs.groupFilter, uniqueValues("Grp"), "All groups");
  populateSelect(refs.categoryFilter, uniqueValues("Cat"), "All categories");
  const values = [...new Set(STRENGTH_STATUSES.concat(state.employees.some((employee) => !String(employee["Strength Status"] || "").trim()) ? ["Not set"] : []))];
  populateSelect(refs.statusFilter, values, "All strength statuses");
  const sensitivities = [...new Set(SENSITIVITY_VALUES.concat(state.employees.some((employee) => !String(employee["Post Sensitivity"] || "").trim()) ? ["Not set"] : []))];
  populateSelect(refs.sensitivityFilter, sensitivities, "All post sensitivities");
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
  const sensitivity = refs.sensitivityFilter.value;
  state.search = query;
  state.filtered = state.employees.filter((employee) => {
    const searchable = COLUMNS.map((key) => employee[key] || "").concat(strengthStatus(employee), sensitivityStatus(employee)).join(" ").toLocaleLowerCase();
    return (!query || searchable.includes(query)) &&
      (!group || employee.Grp === group) &&
      (!category || employee.Cat === category) &&
      (!status || strengthStatus(employee) === status) &&
      (!sensitivity || sensitivityStatus(employee) === sensitivity);
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
  refs.sensitivityFilter.value = "";
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
    const originalCode = String(employee["Employee Code"] || "");
    const isInlineEditing = state.directEditEnabled && state.inlineEditCode === originalCode;
    const cells = COLUMNS.map((column) => {
      if (isInlineEditing) return renderInlineCell(employee, column);
      let raw = employee[column] == null ? "" : String(employee[column]);
      let display = ["DoB", "DoR", "DoJ Govt", "DoJ in Current Office", "Relieving Date"].includes(column) ? formatDate(raw) : raw;
      let value = highlight(display, state.search);
      if (column === "Grp" && raw) value = `<span class="badge group">${escapeHtml(raw)}</span>`;
      if (column === "Cat" && raw) value = `<span class="badge category">${escapeHtml(raw)}</span>`;
      if (column === "Strength Status") {
        display = strengthStatus(employee);
        value = `<span class="badge strength ${strengthClass(display)}">${escapeHtml(display)}</span>`;
      }
      if (column === "Post Sensitivity") {
        display = sensitivityStatus(employee);
        value = `<span class="badge sensitivity ${sensitivityClass(display)}">${escapeHtml(display)}</span>`;
      }
      const className = ["REMARK ADMN", "Present/Permanent Address"].includes(column) ? "remarks-cell" : "";
      return `<td class="${className}" title="${escapeAttribute(display)}">${value || "—"}</td>`;
    }).join("");
    let actions = "";
    if (state.role === "admin") {
      if (isInlineEditing) {
        actions = `<td><div class="action-cell inline-actions"><button class="row-action save" data-action="inline-save" data-code="${escapeAttribute(originalCode)}">Save</button><button class="row-action" data-action="inline-cancel" data-code="${escapeAttribute(originalCode)}">Cancel</button></div></td>`;
      } else if (state.directEditEnabled) {
        actions = `<td><div class="action-cell"><button class="row-action inline-edit" data-action="inline-edit" data-code="${escapeAttribute(originalCode)}">Edit row</button><button class="row-action" data-action="edit" data-code="${escapeAttribute(originalCode)}">Full form</button><button class="row-action delete" data-action="delete" data-code="${escapeAttribute(originalCode)}">Delete</button></div></td>`;
      } else {
        actions = `<td><div class="action-cell"><button class="row-action" data-action="edit" data-code="${escapeAttribute(originalCode)}">Edit</button><button class="row-action delete" data-action="delete" data-code="${escapeAttribute(originalCode)}">Delete</button></div></td>`;
      }
    }
    const employeeCode = escapeAttribute(employee["Employee Code"]);
    const employeeName = escapeAttribute(employee["Employee Name"] || "employee");
    const rowClass = isInlineEditing ? "employee-row inline-row-active" : "employee-row";
    return `<tr class="${rowClass}" tabindex="${isInlineEditing ? "-1" : "0"}" data-employee-code="${employeeCode}" aria-label="${isInlineEditing ? "Editing" : "View full details for"} ${employeeName}">${cells}${actions}</tr>`;
  }).join("");

  refs.emptyState.hidden = total !== 0;
  refs.employeeTable.hidden = total === 0;
  const instruction = state.headerEditEnabled
    ? " · Header editing is on — rename headings, then choose Save headers"
    : state.directEditEnabled
    ? " · Row editing is on — choose Edit row, then Save"
    : (total ? " · Click a row for full details" : "");
  refs.resultSummary.textContent = `${total} record${total === 1 ? "" : "s"}${state.search ? " matching search" : ""}${instruction}`;
  const shownStart = total ? start + 1 : 0;
  const shownEnd = Math.min(start + CONFIG.PAGE_SIZE, total);
  const pageCount = Math.max(1, Math.ceil(total / CONFIG.PAGE_SIZE));
  refs.pageInfo.textContent = `Showing ${shownStart}–${shownEnd} of ${total}`;
  refs.pageNumber.textContent = `Page ${state.page} of ${pageCount}`;
  refs.prevPage.disabled = state.page <= 1;
  refs.nextPage.disabled = state.page >= pageCount;
}

function toggleDirectEdit() {
  if (state.role !== "admin") return;
  if (state.directEditEnabled && state.inlineEditCode && !confirm("Turn off row editing and discard the unsaved row changes?")) return;
  if (!state.directEditEnabled && state.headerEditEnabled && state.headerLabelsDirty && !confirm("Discard the unsaved header-name changes and start editing rows?")) return;
  state.headerEditEnabled = false;
  state.headerLabelsDirty = false;
  state.directEditEnabled = !state.directEditEnabled;
  state.inlineEditCode = "";
  updateDirectEditButton();
  updateHeaderEditButtons();
  renderTable();
  showToast(state.directEditEnabled ? "Row editing is on. Choose Edit row beside an employee." : "Row editing is off.");
}

function updateDirectEditButton() {
  if (!refs.directEditToggle) return;
  refs.directEditToggle.classList.toggle("active", state.directEditEnabled);
  refs.directEditToggle.setAttribute("aria-pressed", String(state.directEditEnabled));
  refs.directEditToggle.textContent = state.directEditEnabled ? "Finish row edit" : "Edit rows";
}

function toggleHeaderEdit() {
  if (state.role !== "admin") return;
  if (state.headerEditEnabled && state.headerLabelsDirty && !confirm("Finish header editing and discard the unsaved header-name changes?")) return;
  if (!state.headerEditEnabled && state.inlineEditCode && !confirm("Discard the unsaved row changes and start editing headers?")) return;
  state.directEditEnabled = false;
  state.inlineEditCode = "";
  state.headerEditEnabled = !state.headerEditEnabled;
  state.headerLabelsDirty = false;
  updateDirectEditButton();
  updateHeaderEditButtons();
  renderTable();
  showToast(state.headerEditEnabled ? "Header editing is on. Rename a heading and choose Save headers." : "Header editing is off.");
}

function updateHeaderEditButtons() {
  if (!refs.editHeadersButton) return;
  refs.editHeadersButton.classList.toggle("active", state.headerEditEnabled);
  refs.editHeadersButton.setAttribute("aria-pressed", String(state.headerEditEnabled));
  refs.editHeadersButton.textContent = state.headerEditEnabled ? "Cancel header edit" : "Edit headers";
  const showHeaderActions = state.role === "admin" && state.headerEditEnabled;
  refs.saveHeadersButton.hidden = !showHeaderActions;
  refs.resetHeadersButton.hidden = !showHeaderActions;
  refs.saveHeadersButton.disabled = !state.headerLabelsDirty;
}

function renderInlineCell(employee, column) {
  const raw = employee[column] == null ? "" : String(employee[column]);
  if (column === "Sl No." || column === "AGE") {
    return `<td class="inline-readonly-cell"><span class="inline-readonly" data-inline-calculated="${escapeAttribute(column)}">${escapeHtml(raw || "—")}</span></td>`;
  }

  if (column === "Strength Status") {
    return `<td>${inlineSelect(column, raw, STRENGTH_STATUSES, true)}</td>`;
  }
  if (column === "Post Sensitivity") {
    return `<td>${inlineSelect(column, raw, SENSITIVITY_VALUES, true)}</td>`;
  }

  const dateColumns = ["DoB", "DoR", "Relieving Date", "DoJ Govt", "DoJ in Current Office"];
  const type = dateColumns.includes(column) ? "date" : column === "Email" ? "email" : column === "Mob" ? "tel" : "text";
  const value = type === "date" ? toIsoDate(raw) : raw;
  const required = ["Employee Name", "Employee Code"].includes(column) ? " required" : "";
  const disabled = column === "Relieving Date" && strengthStatus(employee) === "Present" ? " disabled" : "";
  const maxLength = inlineMaxLength(column);
  const cellClass = ["REMARK ADMN", "Present/Permanent Address"].includes(column) ? "remarks-cell" : "";
  return `<td class="${cellClass}"><input class="inline-edit-input" type="${type}" data-inline-field="${escapeAttribute(column)}" value="${escapeAttribute(value)}" aria-label="${escapeAttribute(detailLabel(column))}"${required}${disabled}${maxLength ? ` maxlength="${maxLength}"` : ""}></td>`;
}

function inlineSelect(column, value, standardValues, required) {
  const values = value && !standardValues.includes(value) ? [value].concat(standardValues) : standardValues;
  const placeholder = `<option value="">Select…</option>`;
  const options = values.map((option) => `<option value="${escapeAttribute(option)}"${option === value ? " selected" : ""}>${escapeHtml(option)}</option>`).join("");
  return `<select class="inline-edit-select" data-inline-field="${escapeAttribute(column)}" aria-label="${escapeAttribute(detailLabel(column))}"${required ? " required" : ""}>${placeholder}${options}</select>`;
}

function inlineMaxLength(column) {
  const lengths = { "Employee Name": 100, "Employee Code": 30, "Designation": 80, "Grp": 30, "REMARK ADMN": 500, "Cat": 30, "Present/Permanent Address": 500, "Mob": 15, "Email": 120 };
  return lengths[column] || 0;
}

function updateStats() {
  refs.statTotal.textContent = state.employees.length.toLocaleString("en-IN");
  refs.statPresent.textContent = state.employees.filter((employee) => strengthStatus(employee) === "Present").length.toLocaleString("en-IN");
  refs.statSensitive.textContent = state.employees.filter((employee) => strengthStatus(employee) === "Present" && sensitivityStatus(employee) === "Sensitive").length.toLocaleString("en-IN");
  refs.statNonSensitive.textContent = state.employees.filter((employee) => strengthStatus(employee) === "Present" && sensitivityStatus(employee) === "Non-Sensitive").length.toLocaleString("en-IN");
  refs.statGroupB.textContent = state.employees.filter((employee) => /(^|\s)b($|\s)/i.test(employee.Grp || "")).length.toLocaleString("en-IN");
  const now = new Date();
  const limit = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  refs.statRetiring.textContent = state.employees.filter((employee) => { const date = parseDate(employee.DoR); return date && date >= now && date <= limit; }).length.toLocaleString("en-IN");
}

function openReports() {
  resetReportForm(false);
  generateReport();
  refs.reportDialog.showModal();
  setTimeout(() => refs.reportType.focus(), 30);
}

function openFilteredReport() {
  refs.reportType.value = "filtered";
  updateReportControls();
  generateReport();
  refs.reportDialog.showModal();
  setTimeout(() => refs.reportPrintButton.focus(), 30);
}

function currentFilterCriteria() {
  const criteria = [];
  const search = refs.globalSearch.value.trim();
  if (search) criteria.push(`Search contains “${search}”`);
  if (refs.groupFilter.value) criteria.push(`Group: ${refs.groupFilter.value}`);
  if (refs.categoryFilter.value) criteria.push(`Category: ${refs.categoryFilter.value}`);
  if (refs.statusFilter.value) criteria.push(`Strength Status: ${refs.statusFilter.value}`);
  if (refs.sensitivityFilter.value) criteria.push(`Post Sensitivity: ${refs.sensitivityFilter.value}`);
  return criteria.length ? criteria.join(" · ") : "No dashboard filter applied; all employees are included.";
}

function resetReportForm(shouldGenerate) {
  refs.reportForm.reset();
  refs.reportType.value = "age";
  refs.reportReferenceDate.value = isoToday();
  refs.reportAgeMin.value = "50";
  refs.reportAgeMax.value = "60";
  refs.reportFromDate.value = isoToday();
  refs.reportToDate.value = toIsoLocal(addYears(new Date(), 2));
  refs.reportTextValue.value = "";
  updateReportControls();
  if (shouldGenerate) generateReport();
}

function updateReportControls() {
  const type = refs.reportType.value;
  const isAge = type === "age";
  const isDateRange = Object.prototype.hasOwnProperty.call(DATE_REPORTS, type);
  const isValue = ["strength", "sensitivity", "group", "category"].includes(type);
  refs.reportReferenceField.hidden = !isAge;
  refs.reportAgeMinField.hidden = !isAge;
  refs.reportAgeMaxField.hidden = !isAge;
  refs.reportFromField.hidden = !isDateRange;
  refs.reportToField.hidden = !isDateRange;
  refs.reportValueField.hidden = !isValue;
  refs.reportTextField.hidden = type !== "designation";

  if (!isValue) return;
  const settings = {
    strength: { label: "Strength status", first: "All strength statuses", values: STRENGTH_STATUSES.concat("Not set") },
    sensitivity: { label: "Post sensitivity", first: "All post sensitivities", values: SENSITIVITY_VALUES.concat("Not set") },
    group: { label: "Employee group", first: "All groups", values: uniqueValues("Grp") },
    category: { label: "Employee category", first: "All categories", values: uniqueValues("Cat") }
  }[type];
  refs.reportValueLabel.textContent = settings.label;
  populateSelect(refs.reportValue, settings.values, settings.first);
}

function applyReportPreset(event) {
  const preset = event.currentTarget.dataset.reportPreset;
  if (preset === "age-50-60") {
    refs.reportType.value = "age";
    updateReportControls();
    refs.reportReferenceDate.value = isoToday();
    refs.reportAgeMin.value = "50";
    refs.reportAgeMax.value = "60";
  } else if (preset === "retiring-2-years") {
    refs.reportType.value = "retirement";
    updateReportControls();
    refs.reportFromDate.value = isoToday();
    refs.reportToDate.value = toIsoLocal(addYears(new Date(), 2));
  } else if (preset === "present-strength") {
    refs.reportType.value = "strength";
    updateReportControls();
    refs.reportValue.value = "Present";
  } else if (preset === "present-sensitive") {
    refs.reportType.value = "sensitivity";
    updateReportControls();
    refs.reportValue.value = "Sensitive";
  } else if (preset === "present-non-sensitive") {
    refs.reportType.value = "sensitivity";
    updateReportControls();
    refs.reportValue.value = "Non-Sensitive";
  } else if (preset === "filtered") {
    refs.reportType.value = "filtered";
    updateReportControls();
  } else if (preset === "not-present") {
    refs.reportType.value = "not-present";
    updateReportControls();
  }
  generateReport();
}

function generateReport(event) {
  if (event) event.preventDefault();
  const type = refs.reportType.value;
  const referenceDate = parseDate(refs.reportReferenceDate.value) || new Date();
  const minimumAge = Number(refs.reportAgeMin.value);
  const maximumAge = Number(refs.reportAgeMax.value);
  const fromDate = parseDate(refs.reportFromDate.value);
  const toDate = parseDate(refs.reportToDate.value);
  const selectedValue = refs.reportValue.value;
  const textValue = refs.reportTextValue.value.trim().toLocaleLowerCase();

  if (type === "age" && (!Number.isFinite(minimumAge) || !Number.isFinite(maximumAge) || minimumAge < 0 || maximumAge > 100 || minimumAge > maximumAge)) {
    showToast("Enter a valid age range from 0 to 100. Minimum age cannot exceed maximum age.", true);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(DATE_REPORTS, type) && fromDate && toDate && fromDate > toDate) {
    showToast("The From date cannot be after the To date.", true);
    return;
  }

  const reportSource = type === "filtered" ? state.filtered : state.employees;
  let rows = reportSource.filter((employee) => {
    if (type === "filtered") return true;
    if (type === "age") {
      const age = ageOnDate(employee.DoB, referenceDate);
      return age != null && age >= minimumAge && age <= maximumAge;
    }
    if (Object.prototype.hasOwnProperty.call(DATE_REPORTS, type)) {
      const employeeDate = parseDate(employee[DATE_REPORTS[type].field]);
      return Boolean(employeeDate && (!fromDate || employeeDate >= fromDate) && (!toDate || employeeDate <= toDate));
    }
    if (type === "strength") return !selectedValue || strengthStatus(employee) === selectedValue;
    if (type === "sensitivity") return strengthStatus(employee) === "Present" && (!selectedValue || sensitivityStatus(employee) === selectedValue);
    if (type === "not-present") return ["Relieved", "Transferred", "Retired"].includes(strengthStatus(employee));
    if (type === "group") return !selectedValue || String(employee.Grp || "") === selectedValue;
    if (type === "category") return !selectedValue || String(employee.Cat || "") === selectedValue;
    if (type === "designation") return !textValue || String(employee.Designation || "").toLocaleLowerCase().includes(textValue);
    return true;
  });

  rows = rows.slice().sort((a, b) => {
    if (type === "age") {
      const ageDifference = ageOnDate(a.DoB, referenceDate) - ageOnDate(b.DoB, referenceDate);
      if (ageDifference) return ageDifference;
    }
    if (Object.prototype.hasOwnProperty.call(DATE_REPORTS, type)) {
      const aDate = parseDate(a[DATE_REPORTS[type].field]);
      const bDate = parseDate(b[DATE_REPORTS[type].field]);
      if (aDate && bDate && aDate.getTime() !== bDate.getTime()) return aDate - bDate;
    }
    return String(a["Employee Name"] || "").localeCompare(String(b["Employee Name"] || ""), undefined, { sensitivity: "base" });
  });

  const description = describeReport(type, { referenceDate, minimumAge, maximumAge, fromDate, toDate, selectedValue, textValue });
  state.reportRows = rows;
  state.reportColumns = reportColumns(type, referenceDate);
  state.reportTitle = description.title;
  state.reportCriteria = description.criteria;
  state.reportType = type;
  renderReport();
}

function describeReport(type, values) {
  const selectedLabel = values.selectedValue || "All";
  if (type === "age") return {
    title: `Employees aged ${values.minimumAge}–${values.maximumAge} on ${formatDate(toIsoLocal(values.referenceDate))}`,
    criteria: "Age is calculated from Date of Birth on the selected reference date. Both ages are included."
  };
  if (Object.prototype.hasOwnProperty.call(DATE_REPORTS, type)) {
    const period = reportPeriod(values.fromDate, values.toDate);
    return { title: `${DATE_REPORTS[type].title} ${period.title}`, criteria: `${DATE_REPORTS[type].field}: ${period.criteria}. Both boundary dates are included.` };
  }
  if (type === "strength") return { title: selectedLabel === "All" ? "Employees by strength status" : `${selectedLabel} employees`, criteria: selectedLabel === "All" ? "All strength statuses are included." : `Strength Status is ${selectedLabel}.` };
  if (type === "sensitivity") return { title: selectedLabel === "All" ? "Present employees by post sensitivity" : `Present employees on ${selectedLabel.toLowerCase()} posts`, criteria: selectedLabel === "All" ? "All present employees are included, grouped by Post Sensitivity." : `Strength Status is Present and Post Sensitivity is ${selectedLabel}.` };
  if (type === "filtered") return { title: "Filtered Employee Report", criteria: currentFilterCriteria() };
  if (type === "not-present") return { title: "Relieved, transferred and retired employees", criteria: "Employees not forming part of present strength, based on Strength Status." };
  if (type === "group") return { title: selectedLabel === "All" ? "Group-wise employee report" : `${selectedLabel} employees`, criteria: selectedLabel === "All" ? "All employee groups are included." : `Employee group is ${selectedLabel}.` };
  if (type === "category") return { title: selectedLabel === "All" ? "Category-wise employee report" : `${selectedLabel} category employees`, criteria: selectedLabel === "All" ? "All employee categories are included." : `Employee category is ${selectedLabel}.` };
  if (type === "designation") return { title: values.textValue ? `Employees with designation containing “${refs.reportTextValue.value.trim()}”` : "Designation-wise employee report", criteria: values.textValue ? "Designation contains the entered text." : "All designations are included." };
  return { title: "Complete employee list", criteria: "All employee records are included." };
}

function reportPeriod(fromDate, toDate) {
  if (fromDate && toDate) return { title: `from ${formatDate(toIsoLocal(fromDate))} to ${formatDate(toIsoLocal(toDate))}`, criteria: `${formatDate(toIsoLocal(fromDate))} to ${formatDate(toIsoLocal(toDate))}` };
  if (fromDate) return { title: `on or after ${formatDate(toIsoLocal(fromDate))}`, criteria: `On or after ${formatDate(toIsoLocal(fromDate))}` };
  if (toDate) return { title: `up to ${formatDate(toIsoLocal(toDate))}`, criteria: `Up to ${formatDate(toIsoLocal(toDate))}` };
  return { title: "for all recorded dates", criteria: "All recorded dates" };
}

function reportColumns(type, referenceDate) {
  const sequence = { label: "Sl No.", get: (_employee, index) => index + 1 };
  const name = { label: "Employee Name", get: (employee) => employee["Employee Name"] || "" };
  const code = { label: "Employee Code", get: (employee) => employee["Employee Code"] || "" };
  const designation = { label: "Designation", get: (employee) => employee.Designation || "" };
  const group = { label: "Group", get: (employee) => employee.Grp || "" };
  const category = { label: "Category", get: (employee) => employee.Cat || "" };
  const dob = { label: "Date of Birth", get: (employee) => formatDate(employee.DoB || "") };
  const dor = { label: "Date of Retirement", get: (employee) => formatDate(employee.DoR || "") };
  const strength = { label: "Strength Status", get: (employee) => strengthStatus(employee) };
  const sensitivity = { label: "Post Sensitivity", get: (employee) => sensitivityStatus(employee) };
  const exitDate = { label: "Relieving / Exit Date", get: (employee) => formatDate(employee["Relieving Date"] || "") };
  const currentAge = { label: "Current Age", get: (employee) => { const age = ageOnDate(employee.DoB, new Date()); return age == null ? "" : age; } };

  if (type === "age") {
    const age = { label: `Age on ${formatDate(toIsoLocal(referenceDate))}`, get: (employee) => ageOnDate(employee.DoB, referenceDate) };
    return [sequence, name, code, designation, group, sensitivity, dob, age, dor, strength];
  }
  if (Object.prototype.hasOwnProperty.call(DATE_REPORTS, type)) {
    const dateField = DATE_REPORTS[type].field;
    const reportDate = { label: detailLabel(dateField), get: (employee) => formatDate(employee[dateField] || "") };
    const finalDate = type === "relieving" ? dor : exitDate;
    return [sequence, name, code, designation, group, sensitivity, reportDate, strength, finalDate];
  }
  if (type === "sensitivity") return [sequence, name, code, designation, group, category, sensitivity, strength];
  if (type === "filtered") return [sequence, name, code, designation, group, category, strength, sensitivity, dob, currentAge, dor, exitDate];
  return [sequence, name, code, designation, group, category, sensitivity, dob, currentAge, dor, strength, exitDate];
}

function renderReport() {
  const count = state.reportRows.length;
  refs.reportTitle.textContent = state.reportTitle;
  refs.reportCriteria.textContent = state.reportCriteria;
  refs.reportCount.textContent = `${count.toLocaleString("en-IN")} employee${count === 1 ? "" : "s"}`;
  refs.reportGeneratedAt.textContent = `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
  refs.reportTableHead.innerHTML = state.reportColumns.map((column) => {
    const className = reportColumnClass(column.label);
    return `<th class="${className}">${escapeHtml(column.label)}</th>`;
  }).join("");
  refs.reportTableBody.innerHTML = state.reportRows.map((employee, index) => `<tr>${state.reportColumns.map((column) => {
    const raw = column.get(employee, index);
    const value = raw == null || raw === "" ? "—" : raw;
    const className = reportColumnClass(column.label);
    if (column.label === "Post Sensitivity") return `<td class="${className}"><span class="badge sensitivity ${sensitivityClass(value)}">${escapeHtml(value)}</span></td>`;
    if (column.label === "Strength Status") return `<td class="${className}"><span class="badge strength ${strengthClass(value)}">${escapeHtml(value)}</span></td>`;
    return `<td class="${className}">${escapeHtml(value)}</td>`;
  }).join("")}</tr>`).join("");
  refs.reportTableWrap.hidden = count === 0;
  refs.reportEmptyState.hidden = count !== 0;
  refs.reportExportButton.disabled = count === 0;
  refs.reportPrintButton.disabled = count === 0;
  refs.reportFooterSummary.textContent = count ? `${count.toLocaleString("en-IN")} matching employee${count === 1 ? "" : "s"} ready to print` : "No matching employees";
}

function reportColumnClass(label) {
  if (label === "Post Sensitivity") return "report-sensitivity-column";
  if (label === "Strength Status") return "report-strength-column";
  return "";
}

function exportReportCsv() {
  if (!state.reportRows.length) return;
  const rows = [state.reportColumns.map((column) => column.label)].concat(state.reportRows.map((employee, index) => state.reportColumns.map((column) => column.get(employee, index))));
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const type = state.reportType.replace(/[^a-z0-9]+/gi, "_");
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), `ADG_HR_Report_${type}_${isoToday()}.csv`);
  showToast(`Exported ${state.reportRows.length} report row(s).`);
}

function printReport() {
  if (!state.reportRows.length) return;
  refs.reportGeneratedAt.textContent = `Printed ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
  document.body.classList.add("printing-report");
  window.print();
}

function ageOnDate(value, referenceDate) {
  const dob = parseDate(value);
  const reference = referenceDate instanceof Date ? referenceDate : parseDate(referenceDate);
  if (!dob || !reference || dob > reference) return null;
  let age = reference.getFullYear() - dob.getFullYear();
  const beforeBirthday = reference.getMonth() < dob.getMonth() || (reference.getMonth() === dob.getMonth() && reference.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function addYears(date, years) {
  const result = new Date(date.getFullYear() + years, date.getMonth(), date.getDate());
  if (result.getMonth() !== date.getMonth()) result.setDate(0);
  return result;
}

function changePage(delta) {
  const pages = Math.max(1, Math.ceil(state.filtered.length / CONFIG.PAGE_SIZE));
  state.page = Math.min(pages, Math.max(1, state.page + delta));
  renderTable();
  document.querySelector(".data-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleTableAction(event) {
  const button = event.target.closest("[data-action]");
  if (button) {
    if (state.role !== "admin") return;
    const employee = findEmployee(button.dataset.code);
    if (!employee) return;
    if (button.dataset.action === "inline-edit") beginInlineEdit(employee);
    if (button.dataset.action === "inline-save") saveInlineEmployee(button.dataset.code, button.closest("tr"), button);
    if (button.dataset.action === "inline-cancel") cancelInlineEdit();
    if (button.dataset.action === "edit") openEmployeeDialog(employee);
    if (button.dataset.action === "delete") deleteEmployee(employee);
    return;
  }
  const row = event.target.closest("[data-employee-code]");
  if (row && !event.target.closest("input, select, textarea")) openEmployeeDetails(findEmployee(row.dataset.employeeCode));
}

function handleTableKeydown(event) {
  if (!(["Enter", " "].includes(event.key)) || event.target.closest("button, input, select, textarea")) return;
  const row = event.target.closest("[data-employee-code]");
  if (!row) return;
  event.preventDefault();
  openEmployeeDetails(findEmployee(row.dataset.employeeCode));
}

function beginInlineEdit(employee) {
  const code = String(employee["Employee Code"] || "");
  if (state.inlineEditCode && state.inlineEditCode !== code && !confirm("Discard the unsaved changes in the other row?")) return;
  state.inlineEditCode = code;
  renderTable();
  const row = refs.tableBody.querySelector(`[data-employee-code="${cssEscape(code)}"]`);
  const firstInput = row && row.querySelector("input, select");
  if (firstInput) firstInput.focus();
}

function cancelInlineEdit() {
  state.inlineEditCode = "";
  renderTable();
  showToast("Row changes discarded.");
}

function handleInlineFieldChange(event) {
  const field = event.target.closest("[data-inline-field]");
  if (!field) return;
  const row = field.closest("tr");
  if (!row) return;
  if (field.dataset.inlineField === "Strength Status") {
    const relievingDate = row.querySelector('[data-inline-field="Relieving Date"]');
    if (relievingDate) {
      const needsDate = field.value !== "Present";
      relievingDate.disabled = !needsDate;
      relievingDate.required = needsDate;
      if (!needsDate) relievingDate.value = "";
    }
  }
  if (field.dataset.inlineField === "DoB") {
    const age = row.querySelector('[data-inline-calculated="AGE"]');
    if (age) age.textContent = calculateAge(field.value) || "—";
  }
}

async function saveInlineEmployee(originalEmployeeCode, row, button) {
  if (!row) return;
  const controls = [...row.querySelectorAll("[data-inline-field]")];
  const invalid = controls.find((control) => !control.checkValidity());
  if (invalid) {
    invalid.reportValidity();
    return;
  }
  const employee = {};
  controls.forEach((control) => { employee[control.dataset.inlineField] = control.value.trim(); });
  if (!employee["Employee Name"] || !employee["Employee Code"]) {
    showToast("Employee name and employee code are required.", true);
    return;
  }
  if (employee["Strength Status"] === "Present") employee["Relieving Date"] = "";
  if (employee["Strength Status"] !== "Present" && !employee["Relieving Date"]) {
    showToast("Relieving date is required for relieved, transferred or retired employees.", true);
    const relievingDate = row.querySelector('[data-inline-field="Relieving Date"]');
    if (relievingDate) relievingDate.focus();
    return;
  }

  setButtonBusy(button, true, "Saving…");
  try {
    await apiRequest("saveEmployee", { employee, originalEmployeeCode });
    state.inlineEditCode = "";
    showToast("Employee row updated.");
    await loadEmployees();
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    if (button.isConnected) setButtonBusy(button, false, "Save");
  }
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

function findEmployee(employeeCode) {
  return state.employees.find((item) => item["Employee Code"] === employeeCode);
}

function openEmployeeDetails(employee) {
  if (!employee) return;
  state.detailEmployeeCode = employee["Employee Code"] || "";
  const name = employee["Employee Name"] || "Employee details";
  const designation = employee.Designation || "Designation not recorded";
  const code = employee["Employee Code"] || "No employee code";
  const status = strengthStatus(employee);
  const postSensitivity = sensitivityStatus(employee);
  refs.detailsAvatar.textContent = initials(name);
  refs.detailsEmployeeName.textContent = name;
  refs.detailsEmployeeSubtitle.textContent = `${designation} · ${code}`;
  refs.detailsStrengthStatus.className = `badge strength ${strengthClass(status)}`;
  refs.detailsStrengthStatus.textContent = status;
  refs.detailsPostSensitivity.className = `badge sensitivity ${sensitivityClass(postSensitivity)}`;
  refs.detailsPostSensitivity.textContent = `Post: ${postSensitivity}`;
  refs.employeeDetailsContent.innerHTML = DETAIL_SECTIONS.map((section) => `
    <section class="detail-section">
      <h3>${escapeHtml(section.title)}</h3>
      <dl>${section.fields.map((field) => detailRow(field, employee[field])).join("")}</dl>
    </section>
  `).join("");
  refs.detailsEditButton.hidden = state.role !== "admin";
  refs.employeeDetailsDialog.showModal();
}

function detailRow(field, rawValue) {
  let raw = rawValue == null ? "" : String(rawValue).trim();
  if (field === "Strength Status") raw = raw || "Not set";
  if (field === "Post Sensitivity") raw = raw || "Not set";
  let value = raw ? escapeHtml(raw) : '<span class="detail-empty">Not recorded</span>';
  if (["DoB", "DoR", "DoJ Govt", "DoJ in Current Office", "Relieving Date"].includes(field) && raw) value = escapeHtml(formatDate(raw));
  if (field === "Strength Status") value = `<span class="badge strength ${strengthClass(raw)}">${escapeHtml(raw)}</span>`;
  if (field === "Post Sensitivity") value = `<span class="badge sensitivity ${sensitivityClass(raw)}">${escapeHtml(raw)}</span>`;
  if (field === "Email" && raw) value = `<a href="mailto:${escapeAttribute(raw)}">${escapeHtml(raw)}</a>`;
  if (field === "Mob" && raw) value = `<a href="tel:${escapeAttribute(raw)}">${escapeHtml(raw)}</a>`;
  const valueClass = field === "REMARK ADMN" ? "detail-value remarks" : "detail-value";
  return `<div class="detail-row"><dt>${escapeHtml(detailLabel(field))}</dt><dd class="${valueClass}">${value}</dd></div>`;
}

function detailLabel(field) {
  const labels = {
    "Sl No.": "Serial number", "Grp": "Group", "Cat": "Category", "REMARK ADMN": "Administration remarks",
    "DoB": "Date of birth", "DoR": "Date of retirement", "DoJ Govt": "Date of joining Government",
    "DoJ in Current Office": "Date of joining current office", "Present/Permanent Address": "Present / permanent address",
    "Mob": "Mobile", "AGE": "Age", "Relieving Date": "Relieving / exit date"
  };
  return labels[field] || field;
}

function editSelectedEmployee() {
  const employee = findEmployee(state.detailEmployeeCode);
  if (!employee || state.role !== "admin") return;
  refs.employeeDetailsDialog.close();
  openEmployeeDialog(employee);
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
  refs.fieldDoJOffice.value = toIsoDate(item["DoJ in Current Office"] || item["DoJ in ADG"] || "");
  refs.fieldAddress.value = item["Present/Permanent Address"] || item["Present/Permanent"] || "";
  setSelectValue(refs.fieldPostSensitivity, item["Post Sensitivity"] || "");
  setSelectValue(refs.fieldStrengthStatus, item["Strength Status"] || (employee ? "" : "Present"));
  refs.fieldRelievingDate.value = toIsoDate(item["Relieving Date"] || "");
  refs.fieldMobile.value = item.Mob || "";
  refs.fieldEmail.value = item.Email || "";
  refs.fieldAge.value = item.AGE || "";
  updateStrengthDateState();
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

function updateStrengthDateState() {
  const status = refs.fieldStrengthStatus.value;
  const needsDate = Boolean(status && status !== "Present");
  refs.fieldRelievingDate.disabled = !needsDate;
  refs.fieldRelievingDate.required = needsDate;
  if (!needsDate) refs.fieldRelievingDate.value = "";
  refs.relievingDateHint.textContent = needsDate ? "Required for relieved, transferred or retired staff" : "Enabled when the employee is no longer in present strength";
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
    "DoJ in Current Office": refs.fieldDoJOffice.value,
    "Present/Permanent Address": refs.fieldAddress.value.trim(),
    "Mob": refs.fieldMobile.value.trim(),
    "Email": refs.fieldEmail.value.trim(),
    "AGE": refs.fieldAge.value,
    "Post Sensitivity": refs.fieldPostSensitivity.value,
    "Strength Status": refs.fieldStrengthStatus.value,
    "Relieving Date": refs.fieldRelievingDate.value
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

async function replaceAllCsv(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error("The CSV file contains no employee rows.");
    if (rows.length > 1000) throw new Error("Import a maximum of 1,000 employees at a time.");
    const duplicate = findDuplicateEmployeeCode(rows);
    if (duplicate) throw new Error(`Employee code appears more than once: ${duplicate}`);
    const confirmed = confirm(
      `Replace ALL dashboard employee data with ${rows.length} record(s)?\n\n` +
      "The current employee list will be backed up automatically in Google Drive before it is deleted."
    );
    if (!confirmed) return;
    if (prompt("Final confirmation: type REPLACE to continue.") !== "REPLACE") {
      showToast("Replace-all cancelled. No data was changed.");
      return;
    }
    showLoading(`Backing up current data and replacing it with ${rows.length} records…`);
    const result = await apiRequest("replaceEmployees", { employees: rows });
    showToast(`Replacement complete: ${result.replaced} employee record(s) loaded; ${result.previous} previous record(s) backed up.`);
    await loadEmployees(true);
    if (result.backupFileUrl && confirm(`Automatic backup created: ${result.backupFileName}. Open it in Google Drive?`)) {
      window.open(result.backupFileUrl, "_blank", "noopener");
    }
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
  const headerRowIndex = matrix.findIndex((values) => {
    const labels = values.map((value) => value.trim());
    return labels.includes("Employee Name") && labels.includes("Employee Code");
  });
  if (headerRowIndex < 0) throw new Error("CSV columns missing: Employee Name and Employee Code.");
  const headers = matrix[headerRowIndex].map((header) => CSV_HEADER_ALIASES[header.trim()] || header.trim());
  const required = ["Employee Name", "Employee Code"];
  required.forEach((header) => { if (!headers.includes(header)) throw new Error(`CSV column missing: ${header}`); });
  return matrix.slice(headerRowIndex + 1).map((values) => {
    const item = {};
    headers.forEach((header, index) => { if (COLUMNS.includes(header)) item[header] = values[index] == null ? "" : values[index].trim(); });
    return item;
  }).filter((item) => COLUMNS.some((header) => !["Sl No.", "AGE"].includes(header) && String(item[header] || "").trim()));
}

function findDuplicateEmployeeCode(rows) {
  const seen = new Set();
  for (const row of rows) {
    const code = String(row["Employee Code"] || "").trim().toLowerCase();
    if (!code) continue;
    if (seen.has(code)) return row["Employee Code"];
    seen.add(code);
  }
  return "";
}

function exportFilteredCsv() {
  const rows = [COLUMNS.map((key) => DEFAULT_COLUMN_LABELS[key] || key)]
    .concat(state.filtered.map((employee) => COLUMNS.map((key) => employee[key] || "")));
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
      // Apps Script may respond from an inner Google sandbox frame, so identify
      // the private response by its channel and unique request ID.
      if (!event.data || event.data.channel !== CONFIG.CHANNEL || event.data.requestId !== requestId || finished) return;
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
  const messages = { INVALID_LOGIN: "Incorrect username or password.", LOGIN_BLOCKED: "Too many failed attempts. Please wait 10 minutes.", SESSION_EXPIRED: "Your session expired. Please sign in again.", FORBIDDEN: "Your account does not have permission for this action.", DUPLICATE_CODE: "That employee code already exists.", DUPLICATE_IMPORT_CODE: "The CSV contains a duplicate employee code.", INVALID_IMPORT_ROW: error.message, INVALID_SENSITIVITY: "Select Sensitive or Non-Sensitive for Post Sensitivity.", ORIGIN_BLOCKED: "This GitHub address is not allowed by the backend.", UNKNOWN_ACTION: `Backend update incomplete. Deploy Code.gs v${CONFIG.REQUIRED_BACKEND_VERSION} as a new version, sign in again, and retry.`, SHEET_SCHEMA_MISMATCH: "The Sheet columns cannot be safely matched. Use Replace all data with the corrected CSV.", TIMEOUT: "The backend did not respond. Check the Apps Script deployment and internet connection.", NOT_CONFIGURED: "Connect the Apps Script web app URL in app.js first." };
  return messages[error.code] || error.message || "Something went wrong. Please try again.";
}
function versionAtLeast(actual, required) {
  const parse = (value) => String(value || "").split(".").map((part) => Number(part) || 0);
  const a = parse(actual), r = parse(required);
  for (let index = 0; index < Math.max(a.length, r.length); index += 1) {
    if ((a[index] || 0) > (r[index] || 0)) return true;
    if ((a[index] || 0) < (r[index] || 0)) return false;
  }
  return Boolean(actual);
}
function calculateAge(value) { const age = ageOnDate(value, new Date()); return age == null ? "" : String(age); }
function calculateGovernmentRetirement(value) { const dob = parseDate(value); if (!dob) return ""; const year = dob.getFullYear() + 60; const month = dob.getMonth(); const date = dob.getDate() === 1 ? new Date(year, month, 0) : new Date(year, month + 1, 0); return toIsoLocal(date); }
function strengthStatus(employee) { return String(employee && employee["Strength Status"] || "").trim() || "Not set"; }
function strengthClass(value) { return String(value || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "") || "not-set"; }
function sensitivityStatus(employee) { return String(employee && employee["Post Sensitivity"] || "").trim() || "Not set"; }
function sensitivityClass(value) { return String(value || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "") || "not-set"; }
function initials(value) { return String(value || "E").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "E"; }
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
