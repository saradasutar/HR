"use strict";

/* Replace only this URL after deploying Code.gs as a Google Apps Script web app. */
const CONFIG = Object.freeze({
  API_URL: "https://script.google.com/macros/s/AKfycbwfrIAKAamLlgwcvdmXmG8GD2wJ6jzpBhoBQyuZJj66X2ieyCgWqUS399IaFoIy-12I/exec",
  CHANNEL: "ADG_HR_API_V1",
  FRONTEND_VERSION: "1.6.59",
  REQUIRED_BACKEND_VERSION: "1.6.1",
  REQUEST_TIMEOUT_MS: 45000
});

const CORE_COLUMNS = [
  "Sl No.", "Employee Name", "Employee Code", "Designation", "Grp",
  "DoB", "DoR", "Cat", "DoJ Govt", "DoJ in Current Office",
  "Present/Permanent Address", "Mob", "Email", "AGE", "Strength Status",
  "Relieving Date", "Post Sensitivity", "REMARK ADMN"
];

const DEFAULT_COLUMN_LABELS = Object.freeze(Object.assign(CORE_COLUMNS.reduce((labels, column) => {
  labels[column] = column;
  return labels;
}, {}), {
  "DoJ in Current Office": "DoJ in ADG",
  "Present/Permanent Address": "Present/Permanent"
}));

const STRENGTH_STATUSES = Object.freeze(["Present", "Relieved", "Transferred", "Retired"]);
const SENSITIVITY_VALUES = Object.freeze(["Sensitive", "Non-Sensitive"]);
const COMPLETED_WORK_HISTORY_LABEL = "Completed Work History";
const CUSTOM_FIELD_MAX_LENGTH = 500;
const COLUMN_FILTER_OPERATORS = Object.freeze([
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Is exactly" },
  { value: "not-equals", label: "Is not" },
  { value: "starts-with", label: "Starts with" },
  { value: "filled", label: "Has any text" },
  { value: "blank", label: "Is empty" }
]);
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
  columns: CORE_COLUMNS.slice(),
  customColumns: [],
  filtered: [],
  page: 1,
  sortColumn: "Sl No.",
  sortDirection: "asc",
  manualOrderActive: false,
  savedOrderRestored: false,
  savedManualOrders: readSavedManualOrders(),
  namedFilterViews: readNamedFilterViews(),
  search: "",
  detailEmployeeCode: "",
  filterDisplayColumns: [],
  fieldFilterColumns: [],
  columnFilterRules: [],
  dashboardColumns: readDashboardColumnPreference(),
  dashboardFilterPreference: readDashboardFilterPreference(),
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
  backendMismatchNotified: false,
  inlineWorkTargetCode: ""
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
    "categoryFilter", "statusFilter", "sensitivityFilter", "clearFilters", "employeeTableWrap", "employeeTable", "tableHead", "tableBody", "emptyState", "tableScrollUp", "tableScrollDown",
    "pageInfo", "exportButton", "importButton", "replaceAllButton", "printFilteredButton", "chooseColumnsButton", "chooseFiltersButton", "savedViewsButton", "saveOrderButton", "resetOrderButton", "directEditToggle", "editHeadersButton", "saveHeadersButton", "resetHeadersButton",
    "fieldFilterEditBar", "fieldFilterSummary", "fieldFilterPicker", "fieldFilterPickerSummary", "fieldFilterOptions", "applyFieldFilter", "clearFieldFilter",
    "csvFileInput", "replaceCsvFileInput", "backupButton", "addEmployeeButton", "manageColumnsButton", "employeeDialog", "employeeForm",
    "employeeDialogTitle", "originalEmployeeCode", "employeeFormError", "saveEmployeeButton",
    "fieldEmployeeName", "fieldEmployeeCode", "fieldDesignation", "fieldGroup", "fieldRemarks",
    "fieldDoB", "fieldDoR", "fieldCategory", "fieldDoJGovt", "fieldDoJOffice", "fieldAddress",
    "fieldPostSensitivity", "fieldStrengthStatus", "fieldRelievingDate", "relievingDateHint",
    "fieldMobile", "fieldEmail", "fieldAge", "customEmployeeFields", "pendingWorkArchiveToolbar", "pendingWorkArchiveToolbarNote", "pendingWorkArchiveButton", "pendingWorkArchiveSection", "pendingWorkArchiveSummary", "pendingWorkArchiveNote", "pendingWorkItemList", "moveCompletedWorkButton", "completedWorkHistoryDetails", "completedWorkHistoryCount", "completedWorkHistoryList", "inlineWorkDialog", "inlineWorkEmployeeName", "inlineWorkNote", "inlineWorkItemList", "inlineWorkHistoryCount", "inlineWorkHistoryList", "inlineWorkError", "inlineMoveWorkButton", "loadingOverlay", "loadingText", "toastRegion",
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
    "confirmPassword", "passwordFormError", "columnViewDialog", "columnViewList", "columnViewCount", "applyColumnViewButton", "restoreAllColumnsButton",
    "filterViewDialog", "filterViewSummary", "filterViewSearch", "filterViewGroup", "filterViewCategory", "filterViewStatus", "filterViewSensitivity", "filterViewSortColumn", "filterViewSortDirection", "filterScrollUp", "filterScrollDown", "savedFilterViewsPanel", "savedFilterViewCount", "savedFilterViewList", "savedFilterViewEmpty", "savedFilterViewName", "saveNamedFilterViewButton", "columnFilterRuleList", "columnFilterRuleEmpty", "filterViewError", "addColumnFilterRuleButton", "applyFilterViewButton", "clearFilterViewButton", "columnManagerDialog", "columnManagerForm",
    "newColumnName", "customColumnList", "customColumnEmpty", "columnManagerError"
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
  refs.employeeTableWrap.addEventListener("scroll", updateDirectoryScrollButtons, { passive: true });
  refs.tableScrollUp.addEventListener("click", () => scrollEmployeeDirectory(-1));
  refs.tableScrollDown.addEventListener("click", () => scrollEmployeeDirectory(1));
  window.addEventListener("resize", debounce(updateDirectoryScrollButtons, 120));
  refs.exportButton.addEventListener("click", exportFilteredCsv);
  refs.printFilteredButton.addEventListener("click", openFilteredReport);
  refs.chooseColumnsButton.addEventListener("click", openDashboardColumnChooser);
  refs.chooseFiltersButton.addEventListener("click", openDashboardFilterChooser);
  refs.savedViewsButton.addEventListener("click", openSavedFilterViews);
  refs.saveOrderButton.addEventListener("click", saveManualFilteredOrder);
  refs.resetOrderButton.addEventListener("click", resetManualFilteredOrder);
  refs.columnViewList.addEventListener("click", handleDashboardColumnOrder);
  refs.columnViewList.addEventListener("change", updateDashboardColumnCount);
  refs.applyColumnViewButton.addEventListener("click", applyDashboardColumnView);
  refs.restoreAllColumnsButton.addEventListener("click", restoreAllDashboardColumns);
  refs.filterViewDialog.addEventListener("input", updateFilterViewSummary);
  refs.filterViewDialog.addEventListener("change", updateFilterViewSummary);
  refs.filterViewDialog.addEventListener("scroll", updateFilterScrollButtons, { passive: true });
  refs.filterScrollUp.addEventListener("click", () => scrollFilterDialog(-1));
  refs.filterScrollDown.addEventListener("click", () => scrollFilterDialog(1));
  refs.savedFilterViewsPanel.addEventListener("toggle", () => setTimeout(updateFilterScrollButtons, 0));
  refs.savedFilterViewList.addEventListener("click", handleNamedFilterViewAction);
  refs.saveNamedFilterViewButton.addEventListener("click", saveNamedFilterView);
  refs.savedFilterViewName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveNamedFilterView();
    }
  });
  refs.columnFilterRuleList.addEventListener("change", handleColumnFilterRuleChange);
  refs.columnFilterRuleList.addEventListener("click", handleColumnFilterRuleAction);
  refs.addColumnFilterRuleButton.addEventListener("click", addColumnFilterRule);
  refs.applyFilterViewButton.addEventListener("click", applyDashboardFilterView);
  refs.clearFilterViewButton.addEventListener("click", clearDashboardFilterView);
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
  refs.manageColumnsButton.addEventListener("click", openColumnManager);
  refs.columnManagerForm.addEventListener("submit", addCustomColumn);
  refs.customColumnList.addEventListener("click", handleColumnManagerAction);
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
  refs.customEmployeeFields.addEventListener("input", handleCustomEmployeeFieldInput);
  refs.pendingWorkItemList.addEventListener("change", updateMoveCompletedWorkButton);
  refs.pendingWorkArchiveButton.addEventListener("click", openPendingWorkArchive);
  refs.moveCompletedWorkButton.addEventListener("click", moveSelectedWorkToCompleted);
  refs.inlineWorkItemList.addEventListener("change", updateInlineMoveWorkButton);
  refs.inlineMoveWorkButton.addEventListener("click", moveInlineSelectedWork);
  refs.inlineWorkDialog.addEventListener("close", () => { state.inlineWorkTargetCode = ""; });
  refs.changePasswordButton.addEventListener("click", () => refs.passwordDialog.showModal());
  refs.detailsEditButton.addEventListener("click", editSelectedEmployee);
  refs.fieldFilterOptions.addEventListener("change", updateFieldFilterPickerSummary);
  refs.applyFieldFilter.addEventListener("click", applyParticularFieldFilter);
  refs.clearFieldFilter.addEventListener("click", resetParticularFieldFilter);
  refs.passwordForm.addEventListener("submit", changePassword);
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => $(button.dataset.closeDialog).close());
  });
  document.addEventListener("keydown", handleKeyboardShortcut);
  refs.tableBody.addEventListener("click", handleTableAction);
  refs.tableBody.addEventListener("keydown", handleTableKeydown);
  refs.tableBody.addEventListener("change", handleInlineFieldChange);
  refs.tableBody.addEventListener("input", handleInlineLongTextResize);
  refs.tableHead.addEventListener("input", handleHeaderLabelInput);

  buildTableHeader();
  updateSavedViewsButton();
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
    state.columns = Array.isArray(response.columns) && response.columns.length ? response.columns.map(String) : CORE_COLUMNS.slice();
    state.customColumns = Array.isArray(response.customColumns) ? response.customColumns.filter((column) => column && column.key).map((column) => ({ key: String(column.key), label: String(column.label || column.key) })) : [];
    state.backendVersion = String(response.version || "").trim();
    state.columnLabels = Object.assign({}, DEFAULT_COLUMN_LABELS, response.columnLabels || {});
    state.headerLabelsDirty = false;
    state.page = 1;
    syncDashboardColumnPreference();
    populateFilters();
    restoreDashboardFilterPreference();
    populateFieldFilterColumns();
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
  visibleTableColumns().concat("Actions").forEach((column) => {
    const th = document.createElement("th");
    th.dataset.columnKey = column;
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
      const label = document.createElement("span");
      label.className = "column-sort-label";
      label.textContent = columnLabel(column);
      const arrow = document.createElement("span");
      const isActiveSort = state.sortColumn === column;
      arrow.className = `column-sort-arrow${isActiveSort ? " active" : ""}`;
      arrow.textContent = isActiveSort ? (state.sortDirection === "asc" ? "↑" : "↓") : "↕";
      arrow.setAttribute("aria-hidden", "true");
      th.append(label, arrow);
      th.classList.add("sortable-header");
      th.tabIndex = 0;
      th.setAttribute("role", "button");
      th.setAttribute("aria-sort", isActiveSort ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none");
      th.setAttribute("aria-label", `${columnLabel(column)}. ${isActiveSort ? `Currently ${state.sortDirection === "asc" ? "ascending" : "descending"}. Activate to reverse order.` : "Activate to sort."}`);
      th.title = isActiveSort ? `Sorted ${state.sortDirection === "asc" ? "ascending" : "descending"}. Click to reverse order.` : "Sort by " + columnLabel(column);
      th.addEventListener("click", () => sortBy(column));
      th.addEventListener("keydown", (event) => { if (event.key === "Enter") sortBy(column); });
    }
    const visualClass = columnVisualClass(column);
    if (visualClass) th.classList.add(visualClass);
    if (isLongDashboardTextColumn(column)) th.classList.add("long-text-dashboard-column");
    refs.tableHead.appendChild(th);
  });
}

function columnVisualClass(column) {
  const normalizedKey = String(column || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const normalizedLabel = column === "Actions" ? "actions" : String(columnLabel(column) || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (normalizedKey === "employee name") return "employee-name-column";
  return "";
}

function isLongDashboardTextColumn(column) {
  const normalizedKey = String(column || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const normalizedLabel = String(columnLabel(column) || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalizedKey === "remark admn" || normalizedLabel === "remark admn" || normalizedLabel === "remarks administration" || normalizedKey.includes("pending work") || normalizedLabel.includes("pending work");
}

function visibleTableColumns() {
  const selected = state.dashboardColumns.filter((column) => state.columns.includes(column));
  const safeDefault = state.columns.filter((column) => !isCompletedWorkHistoryColumn(column));
  return frozenColumnsFirst(selected.length ? selected : safeDefault);
}

function frozenColumnsFirst(columns) {
  const frozen = ["Sl No.", "Employee Name"].filter((column) => columns.includes(column));
  return frozen.concat(columns.filter((column) => !frozen.includes(column)));
}

function readDashboardColumnPreference() {
  try {
    const value = JSON.parse(localStorage.getItem("hrDashboardColumns") || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function saveDashboardColumnPreference() {
  try { localStorage.setItem("hrDashboardColumns", JSON.stringify(state.dashboardColumns)); } catch { /* Device storage may be unavailable. */ }
}

function readSavedManualOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem("hrDashboardSavedOrders") || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, entry]) => entry && Array.isArray(entry.codes)).map(([key, entry]) => [key, {
      codes: entry.codes.map(String).filter(Boolean),
      savedAt: Number(entry.savedAt) || 0
    }]));
  } catch {
    return {};
  }
}

function readNamedFilterViews() {
  try {
    const parsed = JSON.parse(localStorage.getItem("hrDashboardNamedFilterViews") || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((view) => view && typeof view === "object" && String(view.name || "").trim()).map((view) => ({
      id: String(view.id || ""),
      name: String(view.name || "").trim().slice(0, 60),
      filters: view.filters && typeof view.filters === "object" ? view.filters : {},
      columns: Array.isArray(view.columns) ? view.columns.map(String) : [],
      savedAt: Number(view.savedAt) || 0
    })).slice(0, 30);
  } catch {
    return [];
  }
}

function persistNamedFilterViews() {
  try {
    localStorage.setItem("hrDashboardNamedFilterViews", JSON.stringify(state.namedFilterViews));
    return true;
  } catch {
    return false;
  }
}

function persistSavedManualOrders() {
  try {
    localStorage.setItem("hrDashboardSavedOrders", JSON.stringify(state.savedManualOrders));
    return true;
  } catch {
    return false;
  }
}

function readDashboardFilterPreference() {
  try {
    const saved = JSON.parse(localStorage.getItem("hrDashboardFilters") || "{}");
    return {
      search: String(saved.search || "").slice(0, 250),
      group: String(saved.group || ""),
      category: String(saved.category || ""),
      status: String(saved.status || ""),
      sensitivity: String(saved.sensitivity || ""),
      sortColumn: String(saved.sortColumn || "Sl No."),
      sortDirection: saved.sortDirection === "desc" ? "desc" : "asc",
      displayColumns: Array.isArray(saved.displayColumns) ? saved.displayColumns.map(String) : [],
      fieldColumns: Array.isArray(saved.fieldColumns) ? saved.fieldColumns.map(String) : [],
      columnRules: Array.isArray(saved.columnRules) ? saved.columnRules.map((rule) => ({
        column: String(rule && rule.column || ""),
        operator: String(rule && rule.operator || "contains"),
        value: String(rule && rule.value || "").slice(0, 500)
      })) : []
    };
  } catch {
    return { search: "", group: "", category: "", status: "", sensitivity: "", sortColumn: "Sl No.", sortDirection: "asc", displayColumns: [], fieldColumns: [], columnRules: [] };
  }
}

function saveDashboardFilterPreference() {
  if (!refs.globalSearch) return;
  state.dashboardFilterPreference = {
    search: refs.globalSearch.value.trim(),
    group: refs.groupFilter.value,
    category: refs.categoryFilter.value,
    status: refs.statusFilter.value,
    sensitivity: refs.sensitivityFilter.value,
    sortColumn: state.columns.includes(state.sortColumn) ? state.sortColumn : "Sl No.",
    sortDirection: state.sortDirection === "desc" ? "desc" : "asc",
    displayColumns: state.filterDisplayColumns.filter((column) => state.columns.includes(column)),
    fieldColumns: state.fieldFilterColumns.filter((column) => state.columns.includes(column)),
    columnRules: normalizeColumnFilterRules(state.columnFilterRules)
  };
  try { localStorage.setItem("hrDashboardFilters", JSON.stringify(state.dashboardFilterPreference)); } catch { /* Device storage may be unavailable. */ }
  updateChooseFiltersButton();
}

function restoreDashboardFilterPreference() {
  const saved = state.dashboardFilterPreference || readDashboardFilterPreference();
  refs.globalSearch.value = saved.search || "";
  setSavedSelectValue(refs.groupFilter, saved.group);
  setSavedSelectValue(refs.categoryFilter, saved.category);
  setSavedSelectValue(refs.statusFilter, saved.status);
  setSavedSelectValue(refs.sensitivityFilter, saved.sensitivity);
  state.sortColumn = state.columns.includes(saved.sortColumn) ? saved.sortColumn : "Sl No.";
  state.sortDirection = saved.sortDirection === "desc" ? "desc" : "asc";
  let savedDisplayColumns = (saved.displayColumns || []).filter((column, index, values) => state.columns.includes(column) && values.indexOf(column) === index);
  let savedFieldColumns = (saved.fieldColumns || []).filter((column, index, values) => state.columns.includes(column) && values.indexOf(column) === index);
  let savedColumnRules = normalizeColumnFilterRules(saved.columnRules);
  // v1.6.35 separates display selection from value conditions. Convert the
  // v1.6.34 "show-all" pseudo-rules automatically so existing saved views work.
  const legacyDisplayColumns = savedColumnRules.filter((rule) => rule.operator === "show-all").map((rule) => rule.column);
  savedColumnRules = savedColumnRules.filter((rule) => rule.operator !== "show-all");
  savedDisplayColumns = savedDisplayColumns.concat(legacyDisplayColumns)
    .filter((column, index, values) => state.columns.includes(column) && values.indexOf(column) === index);
  // Older Pending Work selections used "filled", which hides everybody when
  // the column is entirely empty. Treat that legacy empty-column choice as a
  // display choice while retaining real value filters for populated columns.
  const entirelyBlankPendingColumns = state.columns.filter((column) => isPendingWorkColumn(column) && !state.employees.some((employee) => employeeColumnFilterValue(employee, column)));
  const legacyBlankPending = savedFieldColumns.concat(savedColumnRules.filter((rule) => rule.operator === "filled").map((rule) => rule.column))
    .filter((column, index, values) => entirelyBlankPendingColumns.includes(column) && values.indexOf(column) === index);
  if (legacyBlankPending.length) {
    savedDisplayColumns = savedDisplayColumns.concat(legacyBlankPending).filter((column, index, values) => values.indexOf(column) === index);
    savedFieldColumns = savedFieldColumns.filter((column) => !legacyBlankPending.includes(column));
    savedColumnRules = savedColumnRules.filter((rule) => !(legacyBlankPending.includes(rule.column) && rule.operator === "filled"));
  }
  // v1.6.42 keeps column display exclusively under Choose columns. Retire the
  // older filter-popup display/filled-field choices so saved views stay clear.
  state.filterDisplayColumns = [];
  state.fieldFilterColumns = [];
  state.columnFilterRules = savedColumnRules;
  updateChooseFiltersButton();
}

function isPendingWorkColumn(column) {
  const normalizedKey = String(column || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const normalizedLabel = String(columnLabel(column) || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalizedKey.includes("pending work") || normalizedLabel.includes("pending work");
}

function isCompletedWorkHistoryColumn(column) {
  const normalizedKey = String(column || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const normalizedLabel = String(columnLabel(column) || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalizedKey === "completed work history" || normalizedLabel === "completed work history";
}

function pendingWorkColumnKey() {
  return state.columns.find((column) => isPendingWorkColumn(column)) || "";
}

function completedWorkHistoryColumnKey() {
  return state.columns.find((column) => isCompletedWorkHistoryColumn(column)) || "";
}

function setSavedSelectValue(select, value) {
  const selected = String(value || "");
  select.value = [...select.options].some((option) => option.value === selected) ? selected : "";
}

function syncDashboardColumnPreference() {
  const valid = state.dashboardColumns.filter((column, index, values) => state.columns.includes(column) && values.indexOf(column) === index);
  const defaultVisibleColumns = state.columns.filter((column) => !isCompletedWorkHistoryColumn(column));
  state.dashboardColumns = valid.length ? valid : defaultVisibleColumns;
  updateChooseColumnsButton();
}

function isDashboardColumnCustomized() {
  const selected = visibleTableColumns();
  return !hasFocusedColumnFilter() && (selected.length !== state.columns.length || selected.some((column, index) => column !== state.columns[index]));
}

function updateChooseColumnsButton() {
  if (!refs.chooseColumnsButton) return;
  const count = state.dashboardColumns.filter((column) => state.columns.includes(column)).length;
  setTwoLineActionLabel(refs.chooseColumnsButton, "Choose", count === state.columns.length ? "columns · All" : `columns · ${count}`);
}

function openDashboardColumnChooser() {
  syncDashboardColumnPreference();
  renderDashboardColumnChooser();
  refs.columnViewDialog.showModal();
}

function renderDashboardColumnChooser() {
  const selected = new Set(state.dashboardColumns);
  const ordered = frozenColumnsFirst(state.dashboardColumns.filter((column) => state.columns.includes(column))
    .concat(state.columns.filter((column) => !selected.has(column))));
  refs.columnViewList.innerHTML = ordered.map((column, index) => `
    <div class="column-view-item" data-dashboard-column="${escapeAttribute(column)}">
      <label><input type="checkbox"${selected.has(column) ? " checked" : ""}><span>${escapeHtml(columnLabel(column))}</span></label>
      <div class="column-order-actions"><button class="column-first-button" type="button" data-column-move="front" aria-label="Place ${escapeAttribute(columnLabel(column))} as the first data column">First</button><button type="button" data-column-move="up" aria-label="Move ${escapeAttribute(columnLabel(column))} up">↑</button><button type="button" data-column-move="down" aria-label="Move ${escapeAttribute(columnLabel(column))} down">↓</button></div>
    </div>
  `).join("");
  refreshDashboardColumnOrderButtons();
  updateDashboardColumnCount();
}

function handleDashboardColumnOrder(event) {
  const button = event.target.closest("[data-column-move]");
  if (!button) return;
  const item = button.closest("[data-dashboard-column]");
  if (button.dataset.columnMove === "front") {
    const firstDataIndex = [...refs.columnViewList.children].filter((row) => ["Sl No.", "Employee Name"].includes(row.dataset.dashboardColumn)).length;
    const target = refs.columnViewList.children[firstDataIndex];
    if (target !== item) refs.columnViewList.insertBefore(item, target || null);
    refreshDashboardColumnOrderButtons();
    return;
  }
  const sibling = button.dataset.columnMove === "up" ? item.previousElementSibling : item.nextElementSibling;
  if (!sibling) return;
  if (button.dataset.columnMove === "up") refs.columnViewList.insertBefore(item, sibling);
  else refs.columnViewList.insertBefore(sibling, item);
  refreshDashboardColumnOrderButtons();
}

function refreshDashboardColumnOrderButtons() {
  const items = [...refs.columnViewList.querySelectorAll("[data-dashboard-column]")];
  const frozenColumns = new Set(["Sl No.", "Employee Name"]);
  const firstDataIndex = items.filter((item) => frozenColumns.has(item.dataset.dashboardColumn)).length;
  items.forEach((item, index) => {
    const frozen = frozenColumns.has(item.dataset.dashboardColumn);
    item.classList.toggle("fixed-column-order", frozen);
    item.querySelector('[data-column-move="front"]').disabled = frozen || index === firstDataIndex;
    item.querySelector('[data-column-move="up"]').disabled = frozen || index <= firstDataIndex;
    item.querySelector('[data-column-move="down"]').disabled = frozen || index === items.length - 1;
  });
}

function selectedDashboardColumnsFromChooser() {
  return [...refs.columnViewList.querySelectorAll("[data-dashboard-column]")]
    .filter((item) => item.querySelector('input[type="checkbox"]').checked)
    .map((item) => item.dataset.dashboardColumn);
}

function updateDashboardColumnCount() {
  const count = selectedDashboardColumnsFromChooser().length;
  refs.columnViewCount.textContent = count === state.columns.length ? "All columns selected" : `${count} of ${state.columns.length} columns selected`;
}

function applyDashboardColumnView() {
  const selected = selectedDashboardColumnsFromChooser();
  if (!selected.length) {
    showToast("Select at least one dashboard column.", true);
    return;
  }
  state.dashboardColumns = frozenColumnsFirst(selected);
  saveDashboardColumnPreference();
  updateChooseColumnsButton();
  state.inlineEditCode = "";
  state.page = 1;
  refs.columnViewDialog.close();
  renderTable();
  showToast(`Dashboard now shows ${selected.length} selected column${selected.length === 1 ? "" : "s"}.`);
}

function restoreAllDashboardColumns() {
  state.dashboardColumns = state.columns.slice();
  saveDashboardColumnPreference();
  updateChooseColumnsButton();
  state.inlineEditCode = "";
  state.page = 1;
  refs.columnViewDialog.close();
  renderTable();
  showToast("All dashboard columns restored.");
}

function dashboardFilterValues(source) {
  const values = source || {};
  return {
    search: String(values.search || "").trim().slice(0, 250),
    group: String(values.group || ""),
    category: String(values.category || ""),
    status: String(values.status || ""),
    sensitivity: String(values.sensitivity || ""),
    sortColumn: state.columns.includes(String(values.sortColumn || "")) ? String(values.sortColumn) : "Sl No.",
    sortDirection: values.sortDirection === "desc" ? "desc" : "asc",
    displayColumns: Array.isArray(values.displayColumns) ? values.displayColumns.filter((column, index, list) => state.columns.includes(column) && list.indexOf(column) === index) : [],
    fieldColumns: Array.isArray(values.fieldColumns) ? values.fieldColumns.filter((column, index, list) => state.columns.includes(column) && list.indexOf(column) === index) : [],
    columnRules: normalizeColumnFilterRules(values.columnRules)
  };
}

function normalizeColumnFilterRules(rules) {
  const validOperators = new Set(COLUMN_FILTER_OPERATORS.map((operator) => operator.value));
  if (!Array.isArray(rules)) return [];
  return rules.map((rule) => {
    const column = String(rule && rule.column || "");
    const requestedOperator = String(rule && rule.operator || "");
    const operator = requestedOperator === "show-all" ? "show-all" : (validOperators.has(requestedOperator) ? requestedOperator : "contains");
    const value = String(rule && rule.value || "").trim().slice(0, 500);
    if (!state.columns.includes(column) || (columnFilterNeedsValue(operator) && !value)) return null;
    return { column, operator, value };
  }).filter(Boolean);
}

function columnFilterNeedsValue(operator) {
  return !["show-all", "filled", "blank"].includes(operator);
}

function columnFilterOperatorLabel(operator) {
  const match = COLUMN_FILTER_OPERATORS.find((item) => item.value === operator);
  return match ? match.label : "Contains";
}

function currentDashboardFilterValues() {
  return dashboardFilterValues({
    search: refs.globalSearch.value,
    group: refs.groupFilter.value,
    category: refs.categoryFilter.value,
    status: refs.statusFilter.value,
    sensitivity: refs.sensitivityFilter.value,
    sortColumn: state.sortColumn,
    sortDirection: state.sortDirection,
    displayColumns: [],
    fieldColumns: [],
    columnRules: state.columnFilterRules
  });
}

function dashboardFilterCount(values) {
  const selected = dashboardFilterValues(values);
  return [selected.search, selected.group, selected.category, selected.status, selected.sensitivity].filter(Boolean).length + selected.displayColumns.length + selected.fieldColumns.length + selected.columnRules.length;
}

function hasActiveDashboardFilter() {
  return dashboardFilterCount(currentDashboardFilterValues()) > 0;
}

function currentManualOrderKey() {
  const selected = currentDashboardFilterValues();
  return JSON.stringify({
    search: selected.search.toLocaleLowerCase(),
    group: selected.group,
    category: selected.category,
    status: selected.status,
    sensitivity: selected.sensitivity,
    sortColumn: selected.sortColumn,
    sortDirection: selected.sortDirection,
    columnRules: selected.columnRules
  });
}

function currentSavedManualOrder() {
  if (!hasActiveDashboardFilter()) return null;
  const saved = state.savedManualOrders[currentManualOrderKey()];
  return saved && Array.isArray(saved.codes) ? saved : null;
}

function applySavedManualOrder() {
  const saved = currentSavedManualOrder();
  if (!saved || !saved.codes.length) return false;
  const rank = new Map(saved.codes.map((code, index) => [String(code), index]));
  state.filtered.sort((first, second) => {
    const firstCode = String(first["Employee Code"] || "");
    const secondCode = String(second["Employee Code"] || "");
    const firstRank = rank.has(firstCode) ? rank.get(firstCode) : Number.MAX_SAFE_INTEGER;
    const secondRank = rank.has(secondCode) ? rank.get(secondCode) : Number.MAX_SAFE_INTEGER;
    return firstRank - secondRank;
  });
  state.manualOrderActive = true;
  state.savedOrderRestored = true;
  return true;
}

function saveManualFilteredOrder() {
  if (state.role !== "admin" || !hasActiveDashboardFilter() || state.filtered.length < 2) {
    showToast("First apply a filter containing at least two employees, then arrange and save the order.", true);
    return;
  }
  const key = currentManualOrderKey();
  const previousOrders = state.savedManualOrders;
  state.savedManualOrders = Object.assign({}, state.savedManualOrders);
  state.savedManualOrders[key] = {
    codes: state.filtered.map((employee) => String(employee["Employee Code"] || "")).filter(Boolean),
    savedAt: Date.now()
  };
  state.savedManualOrders = Object.fromEntries(Object.entries(state.savedManualOrders)
    .sort(([, first], [, second]) => (Number(second.savedAt) || 0) - (Number(first.savedAt) || 0))
    .slice(0, 25));
  if (!persistSavedManualOrders()) {
    state.savedManualOrders = previousOrders;
    showToast("The order could not be saved in this browser. Check whether browser storage is allowed.", true);
    return;
  }
  state.manualOrderActive = true;
  state.savedOrderRestored = true;
  renderTable();
  showToast("This filter and employee order are saved. They will be restored automatically next time.");
}

function resetManualFilteredOrder() {
  if (!hasActiveDashboardFilter()) return;
  const key = currentManualOrderKey();
  if (!state.savedManualOrders[key]) return;
  delete state.savedManualOrders[key];
  persistSavedManualOrders();
  state.manualOrderActive = false;
  state.savedOrderRestored = false;
  sortEmployees();
  renderTable();
  showToast("The saved order for this filter was removed. Automatic column sorting is restored.");
}

function updateSaveOrderButtons() {
  if (!refs.saveOrderButton || !refs.resetOrderButton) return;
  const filteredView = hasActiveDashboardFilter();
  const saved = Boolean(currentSavedManualOrder());
  refs.saveOrderButton.hidden = state.role !== "admin" || !filteredView;
  refs.saveOrderButton.disabled = state.filtered.length < 2;
  refs.saveOrderButton.textContent = saved && state.savedOrderRestored ? "Order saved ✓" : "Save order";
  refs.saveOrderButton.classList.toggle("active", saved && state.savedOrderRestored);
  refs.resetOrderButton.hidden = state.role !== "admin" || !saved;
  const printingSavedOrder = saved && state.savedOrderRestored;
  setTwoLineActionLabel(refs.printFilteredButton, "Print", printingSavedOrder ? "saved filter" : "filtered list");
  refs.printFilteredButton.title = printingSavedOrder
    ? "Print the current saved filter in its restored employee order"
    : "Print the employees currently shown by the dashboard filter";
  refs.printFilteredButton.classList.toggle("saved-order-print", printingSavedOrder);
}

function updateChooseFiltersButton() {
  if (!refs.chooseFiltersButton || !refs.globalSearch) return;
  const count = dashboardFilterCount(currentDashboardFilterValues());
  setTwoLineActionLabel(refs.chooseFiltersButton, count ? "Filters" : "Filter", count ? `active · ${count}` : "dashboard");
  refs.chooseFiltersButton.classList.toggle("active", count > 0);
}

function copySelectOptions(source, target, selectedValue) {
  target.innerHTML = [...source.options].map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.textContent)}</option>`).join("");
  setSavedSelectValue(target, selectedValue);
}

function openDashboardFilterChooser(options = {}) {
  const showSavedViews = Boolean(options && options.showSavedViews);
  const current = currentDashboardFilterValues();
  showFilterViewError("");
  refs.filterViewSearch.value = current.search;
  copySelectOptions(refs.groupFilter, refs.filterViewGroup, current.group);
  copySelectOptions(refs.categoryFilter, refs.filterViewCategory, current.category);
  copySelectOptions(refs.statusFilter, refs.filterViewStatus, current.status);
  copySelectOptions(refs.sensitivityFilter, refs.filterViewSensitivity, current.sensitivity);
  refs.filterViewSortColumn.innerHTML = state.columns.map((column) => `<option value="${escapeAttribute(column)}">${escapeHtml(columnLabel(column))}</option>`).join("");
  setSavedSelectValue(refs.filterViewSortColumn, current.sortColumn);
  refs.filterViewSortDirection.value = current.sortDirection;
  renderColumnFilterRules(current.columnRules);
  refs.savedFilterViewName.value = "";
  refs.savedFilterViewsPanel.open = showSavedViews;
  renderNamedFilterViews();
  updateFilterViewSummary();
  refs.filterViewDialog.showModal();
  refs.filterViewDialog.scrollTop = 0;
  setTimeout(() => {
    updateFilterScrollButtons();
    if (showSavedViews) {
      const firstSavedAction = refs.savedFilterViewList.querySelector('[data-saved-filter-action="open"]');
      (firstSavedAction || refs.savedFilterViewName).focus({ preventScroll: true });
    }
  }, 0);
}

function openSavedFilterViews() {
  openDashboardFilterChooser({ showSavedViews: true });
}

function updateSavedViewsButton() {
  if (!refs.savedViewsButton) return;
  const count = state.namedFilterViews.length;
  setTwoLineActionLabel(refs.savedViewsButton, "Saved", `views · ${count}`);
  refs.savedViewsButton.classList.toggle("has-saved-views", count > 0);
  refs.savedViewsButton.setAttribute("aria-label", count
    ? `Open ${count} saved filter view${count === 1 ? "" : "s"}`
    : "Open saved filter views");
}

function renderNamedFilterViews() {
  const views = state.namedFilterViews.slice().sort((first, second) => (Number(second.savedAt) || 0) - (Number(first.savedAt) || 0));
  updateSavedViewsButton();
  refs.savedFilterViewCount.textContent = views.length ? `${views.length} saved` : "None saved";
  refs.savedFilterViewEmpty.hidden = views.length > 0;
  refs.savedFilterViewList.innerHTML = views.map((view) => {
    const selected = dashboardFilterValues(view.filters);
    const filterCount = dashboardFilterCount(selected);
    const validColumns = view.columns.filter((column, index, list) => state.columns.includes(column) && list.indexOf(column) === index);
    const summary = `${filterCount || "No"} filter${filterCount === 1 ? "" : "s"} · ${validColumns.length || state.columns.length} column${(validColumns.length || state.columns.length) === 1 ? "" : "s"} · ${selected.sortDirection === "desc" ? "Descending" : "Ascending"}`;
    return `<article class="saved-filter-view-card" data-saved-filter-view="${escapeAttribute(view.id)}"><button class="saved-filter-main" type="button" data-saved-filter-action="open"><strong>${escapeHtml(view.name)}</strong><small>${escapeHtml(summary)}</small></button><div class="saved-filter-actions"><button type="button" data-saved-filter-action="open">Open</button><button type="button" data-saved-filter-action="print">Print</button><button class="delete" type="button" data-saved-filter-action="delete">Delete</button></div></article>`;
  }).join("");
  setTimeout(updateFilterScrollButtons, 0);
}

function setTwoLineActionLabel(button, firstLine, secondLine) {
  if (!button) return;
  const label = document.createElement("span");
  label.className = "action-card-label";
  [firstLine, secondLine].forEach((text) => {
    const line = document.createElement("span");
    line.textContent = text;
    label.appendChild(line);
  });
  button.replaceChildren(label);
}

function saveNamedFilterView() {
  if (!validateColumnFilterRules()) return;
  const name = refs.savedFilterViewName.value.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!name) {
    showFilterViewError("Enter a short name for this saved filter view.");
    refs.savedFilterViewsPanel.open = true;
    refs.savedFilterViewName.focus();
    return;
  }
  const previousViews = state.namedFilterViews;
  const existing = state.namedFilterViews.find((view) => view.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  const savedView = {
    id: existing ? existing.id : `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    filters: selectedFilterViewValues(),
    columns: visibleTableColumns(),
    savedAt: Date.now()
  };
  state.namedFilterViews = [savedView].concat(state.namedFilterViews.filter((view) => view.id !== savedView.id)).slice(0, 30);
  if (!persistNamedFilterViews()) {
    state.namedFilterViews = previousViews;
    showFilterViewError("This filter view could not be saved. Check whether browser storage is allowed.");
    return;
  }
  refs.savedFilterViewName.value = "";
  refs.savedFilterViewsPanel.open = true;
  showFilterViewError("");
  renderNamedFilterViews();
  showToast(existing ? `Saved filter view “${name}” updated.` : `Filter view “${name}” saved on this device.`);
}

function handleNamedFilterViewAction(event) {
  const button = event.target.closest("[data-saved-filter-action]");
  const card = event.target.closest("[data-saved-filter-view]");
  if (!button || !card) return;
  const view = state.namedFilterViews.find((item) => item.id === card.dataset.savedFilterView);
  if (!view) return;
  const action = button.dataset.savedFilterAction;
  if (action === "delete") {
    if (!confirm(`Delete the saved filter view “${view.name}”?`)) return;
    state.namedFilterViews = state.namedFilterViews.filter((item) => item.id !== view.id);
    persistNamedFilterViews();
    renderNamedFilterViews();
    showToast(`Saved filter view “${view.name}” deleted.`);
    return;
  }
  applyNamedFilterView(view, action === "print");
}

function applyNamedFilterView(view, printAfterOpening) {
  const selectedColumns = view.columns.filter((column, index, list) => state.columns.includes(column) && list.indexOf(column) === index);
  if (selectedColumns.length) {
    state.dashboardColumns = frozenColumnsFirst(selectedColumns);
    saveDashboardColumnPreference();
    updateChooseColumnsButton();
  }
  setCurrentDashboardFilters(view.filters);
  state.inlineEditCode = "";
  state.page = 1;
  refs.filterViewDialog.close();
  applyFilters();
  showToast(`Saved filter view “${view.name}” opened.`);
  if (printAfterOpening) setTimeout(openFilteredReport, 80);
}

function scrollFilterDialog(direction) {
  const distance = Math.max(260, Math.round(refs.filterViewDialog.clientHeight * 0.68));
  refs.filterViewDialog.scrollBy({ top: direction * distance, behavior: "smooth" });
  setTimeout(updateFilterScrollButtons, 360);
}

function updateFilterScrollButtons() {
  if (!refs.filterViewDialog || !refs.filterScrollUp || !refs.filterScrollDown) return;
  const maximum = Math.max(0, refs.filterViewDialog.scrollHeight - refs.filterViewDialog.clientHeight);
  refs.filterScrollUp.disabled = refs.filterViewDialog.scrollTop <= 2;
  refs.filterScrollDown.disabled = refs.filterViewDialog.scrollTop >= maximum - 2;
  refs.filterScrollDown.title = maximum > 2 ? "Scroll down through more filter options" : "All filter options are already visible";
}

function renderColumnFilterRules(rules) {
  const entries = Array.isArray(rules) ? rules : [];
  refs.columnFilterRuleList.innerHTML = entries.map((rule, index) => columnFilterRuleMarkup(rule, index)).join("");
  refs.columnFilterRuleEmpty.hidden = entries.length > 0;
  refs.columnFilterRuleList.querySelectorAll(".column-filter-rule").forEach(updateColumnFilterRuleValueState);
  setTimeout(updateFilterScrollButtons, 0);
}

function columnFilterRuleMarkup(rule, index) {
  const columnOptions = `<option value="">Choose any column…</option>` + state.columns.map((column) => `<option value="${escapeAttribute(column)}"${rule.column === column ? " selected" : ""}>${escapeHtml(columnLabel(column))}</option>`).join("");
  const operatorOptions = COLUMN_FILTER_OPERATORS.map((operator) => `<option value="${operator.value}"${rule.operator === operator.value ? " selected" : ""}>${escapeHtml(operator.label)}</option>`).join("");
  return `<div class="column-filter-rule" data-filter-rule-index="${index}"><label><span>Column</span><select data-rule-part="column">${columnOptions}</select></label><label><span>Condition</span><select data-rule-part="operator">${operatorOptions}</select></label><label class="column-filter-value"><span>Value</span><input data-rule-part="value" type="text" maxlength="500" value="${escapeAttribute(rule.value || "")}" list="columnFilterSuggestions${index}" placeholder="Type or choose a value"><datalist id="columnFilterSuggestions${index}" data-rule-suggestions></datalist></label><button class="column-filter-remove" type="button" data-rule-action="remove" aria-label="Remove this filter rule">Remove</button></div>`;
}

function rawColumnFilterRulesFromChooser() {
  return [...refs.columnFilterRuleList.querySelectorAll(".column-filter-rule")].map((row) => ({
    column: row.querySelector('[data-rule-part="column"]').value,
    operator: row.querySelector('[data-rule-part="operator"]').value,
    value: row.querySelector('[data-rule-part="value"]').value
  }));
}

function addColumnFilterRule() {
  const rules = rawColumnFilterRulesFromChooser();
  rules.push({ column: "", operator: "filled", value: "" });
  renderColumnFilterRules(rules);
  showFilterViewError("");
  const row = refs.columnFilterRuleList.lastElementChild;
  if (row) row.querySelector('[data-rule-part="column"]').focus();
  updateFilterViewSummary();
}

function handleColumnFilterRuleChange(event) {
  const row = event.target.closest(".column-filter-rule");
  if (row) updateColumnFilterRuleValueState(row);
  showFilterViewError("");
  updateFilterViewSummary();
}

function handleColumnFilterRuleAction(event) {
  const button = event.target.closest('[data-rule-action="remove"]');
  if (!button) return;
  button.closest(".column-filter-rule").remove();
  [...refs.columnFilterRuleList.children].forEach((row, index) => { row.dataset.filterRuleIndex = String(index); });
  refs.columnFilterRuleEmpty.hidden = refs.columnFilterRuleList.children.length > 0;
  showFilterViewError("");
  updateFilterViewSummary();
}

function updateColumnFilterRuleValueState(row) {
  const column = row.querySelector('[data-rule-part="column"]').value;
  const operator = row.querySelector('[data-rule-part="operator"]').value;
  const valueField = row.querySelector('[data-rule-part="value"]');
  const suggestions = row.querySelector("[data-rule-suggestions]");
  const needsValue = columnFilterNeedsValue(operator);
  valueField.disabled = !needsValue;
  valueField.required = Boolean(column && needsValue);
  valueField.placeholder = column ? `Type or choose ${columnLabel(column)}` : "Type or choose a value";
  suggestions.innerHTML = columnFilterSuggestions(column).map((value) => `<option value="${escapeAttribute(value)}"></option>`).join("");
  if (!needsValue) valueField.value = "";
  row.classList.toggle("value-not-required", !needsValue);
}

function validateColumnFilterRules() {
  for (const row of refs.columnFilterRuleList.querySelectorAll(".column-filter-rule")) {
    const columnField = row.querySelector('[data-rule-part="column"]');
    const column = columnField.value;
    const operator = row.querySelector('[data-rule-part="operator"]').value;
    const valueField = row.querySelector('[data-rule-part="value"]');
    if (!column) {
      showFilterViewError("Choose a column for every added filter rule, or remove the unused rule.");
      columnField.focus();
      return false;
    }
    if (columnFilterNeedsValue(operator) && !valueField.value.trim()) {
      showFilterViewError(`Enter or choose a value for the ${columnLabel(column)} filter.`);
      valueField.focus();
      return false;
    }
  }
  return true;
}

function columnFilterSuggestions(column) {
  if (!state.columns.includes(column)) return [];
  return [...new Set(state.employees.map((employee) => employeeColumnFilterValue(employee, column)).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second, undefined, { numeric: true, sensitivity: "base" }))
    .slice(0, 150);
}

function showFilterViewError(message) {
  refs.filterViewError.textContent = message || "";
  refs.filterViewError.hidden = !message;
}

function selectedFilterViewValues() {
  return dashboardFilterValues({
    search: refs.filterViewSearch.value,
    group: refs.filterViewGroup.value,
    category: refs.filterViewCategory.value,
    status: refs.filterViewStatus.value,
    sensitivity: refs.filterViewSensitivity.value,
    sortColumn: refs.filterViewSortColumn.value,
    sortDirection: refs.filterViewSortDirection.value,
    displayColumns: [],
    fieldColumns: [],
    columnRules: rawColumnFilterRulesFromChooser()
  });
}

function updateFilterViewSummary() {
  if (!refs.filterViewSummary) return;
  const selected = selectedFilterViewValues();
  const labels = [];
  if (selected.search) labels.push(`Search: “${selected.search}”`);
  if (selected.group) labels.push(`Group: ${selected.group}`);
  if (selected.category) labels.push(`Category: ${selected.category}`);
  if (selected.status) labels.push(`Status: ${selected.status}`);
  if (selected.sensitivity) labels.push(`Post: ${selected.sensitivity}`);
  selected.columnRules.forEach((rule) => labels.push(`${columnLabel(rule.column)} ${columnFilterOperatorLabel(rule.operator).toLocaleLowerCase()}${columnFilterNeedsValue(rule.operator) ? ` “${rule.value}”` : ""}`));
  const arranged = `Arrange by ${columnLabel(selected.sortColumn)} · ${selected.sortDirection === "desc" ? "Descending" : "Ascending"}`;
  refs.filterViewSummary.textContent = labels.length ? `${labels.length} filter${labels.length === 1 ? "" : "s"} · ${labels.join(" · ")} · ${arranged}` : `All employees · ${arranged}`;
}

function setCurrentDashboardFilters(values) {
  const selected = dashboardFilterValues(values);
  refs.globalSearch.value = selected.search;
  setSavedSelectValue(refs.groupFilter, selected.group);
  setSavedSelectValue(refs.categoryFilter, selected.category);
  setSavedSelectValue(refs.statusFilter, selected.status);
  setSavedSelectValue(refs.sensitivityFilter, selected.sensitivity);
  state.sortColumn = selected.sortColumn;
  state.sortDirection = selected.sortDirection;
  state.filterDisplayColumns = [];
  state.fieldFilterColumns = [];
  state.columnFilterRules = selected.columnRules;
  populateFieldFilterColumns();
}

function applyDashboardFilterView() {
  if (!validateColumnFilterRules()) return;
  const selected = selectedFilterViewValues();
  setCurrentDashboardFilters(selected);
  state.inlineEditCode = "";
  state.page = 1;
  refs.filterViewDialog.close();
  applyFilters();
  const count = dashboardFilterCount(selected);
  showToast(count ? `${count} dashboard filter${count === 1 ? "" : "s"} saved. Filtered rows are ready for direct editing.` : "Default dashboard filters cleared. All employees are shown.");
}

function clearDashboardFilterView() {
  const cleared = dashboardFilterValues({});
  setCurrentDashboardFilters(cleared);
  refs.filterViewDialog.close();
  state.inlineEditCode = "";
  state.page = 1;
  applyFilters();
  showToast("Saved dashboard filters cleared. All employees are shown.");
}

function columnLabel(column) {
  return String(state.columnLabels[column] || DEFAULT_COLUMN_LABELS[column] || column);
}

function defaultLabelsForColumns() {
  const customByKey = new Map(state.customColumns.map((column) => [column.key, column.label]));
  return state.columns.reduce((labels, column) => {
    labels[column] = DEFAULT_COLUMN_LABELS[column] || customByKey.get(column) || column;
    return labels;
  }, {});
}

function applyColumnMetadata(response) {
  if (Array.isArray(response && response.columns) && response.columns.length) state.columns = response.columns.map(String);
  if (Array.isArray(response && response.customColumns)) {
    state.customColumns = response.customColumns.filter((column) => column && column.key).map((column) => ({ key: String(column.key), label: String(column.label || column.key) }));
  }
  if (response && response.columnLabels) state.columnLabels = Object.assign({}, DEFAULT_COLUMN_LABELS, response.columnLabels);
  if (!state.columns.includes(state.sortColumn)) {
    state.sortColumn = "Sl No.";
    state.sortDirection = "asc";
  }
}

function handleHeaderLabelInput(event) {
  if (!event.target.closest("[data-header-key]") || state.role !== "admin") return;
  state.headerLabelsDirty = true;
  refs.saveHeadersButton.disabled = false;
}

async function saveHeaderLabels() {
  if (state.role !== "admin") return;
  const inputs = [...refs.tableHead.querySelectorAll("[data-header-key]")];
  if (!inputs.length) {
    showToast("No visible dashboard headings are available to edit.", true);
    return;
  }

  // The backend stores one complete label map. A personal dashboard may show
  // only a few columns, so preserve every hidden column label and replace only
  // the headings that are currently visible in the table.
  const visibleKeys = new Set(inputs.map((input) => input.dataset.headerKey));
  const columnLabels = state.columns.reduce((labels, column) => {
    labels[column] = columnLabel(column).trim() || DEFAULT_COLUMN_LABELS[column] || column;
    return labels;
  }, {});
  const used = new Map();
  state.columns.forEach((column) => {
    if (!visibleKeys.has(column)) used.set(columnLabels[column].toLocaleLowerCase(), column);
  });
  for (const input of inputs) {
    const label = input.value.trim();
    if (!label) {
      showToast("Every column must have a header name.", true);
      input.focus();
      return;
    }
    const duplicateKey = label.toLocaleLowerCase();
    if (used.has(duplicateKey)) {
      showToast(`Each header name must be different. “${label}” is already used by another column.`, true);
      input.focus();
      return;
    }
    used.set(duplicateKey, input.dataset.headerKey);
    columnLabels[input.dataset.headerKey] = label;
  }

  setButtonBusy(refs.saveHeadersButton, true, "Saving…");
  try {
    const response = await apiRequest("saveColumnLabels", { columnLabels });
    applyColumnMetadata(response);
    state.columnLabels = Object.assign({}, DEFAULT_COLUMN_LABELS, response.columnLabels || columnLabels);
    state.headerLabelsDirty = false;
    showToast("Visible header names saved. Hidden column headings were preserved.");
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
    const response = await apiRequest("saveColumnLabels", { columnLabels: defaultLabelsForColumns() });
    applyColumnMetadata(response);
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

function openColumnManager() {
  if (state.role !== "admin") return;
  refs.columnManagerError.textContent = "";
  refs.newColumnName.value = "";
  renderColumnManager();
  refs.columnManagerDialog.showModal();
  setTimeout(() => refs.newColumnName.focus(), 30);
}

function renderColumnManager() {
  refs.customColumnEmpty.hidden = state.customColumns.length !== 0;
  refs.customColumnList.innerHTML = state.customColumns.map((column) => `
    <div class="custom-column-item">
      <div><strong>${escapeHtml(columnLabel(column.key))}</strong><small>Custom employee field · editable in every employee record</small></div>
      <button class="column-delete-btn" type="button" data-delete-column="${escapeAttribute(column.key)}">Delete column</button>
    </div>
  `).join("");
}

async function addCustomColumn(event) {
  event.preventDefault();
  const label = refs.newColumnName.value.trim();
  refs.columnManagerError.textContent = "";
  if (!label) return;
  const button = refs.columnManagerForm.querySelector('button[type="submit"]');
  setButtonBusy(button, true, "Adding…");
  try {
    const response = await apiRequest("addCustomColumn", { label });
    applyColumnMetadata(response);
    refs.newColumnName.value = "";
    renderColumnManager();
    showToast(`Column “${label}” added. It is now available in employee records.`);
    await loadEmployees(true);
    renderColumnManager();
  } catch (error) {
    refs.columnManagerError.textContent = friendlyError(error);
  } finally {
    setButtonBusy(button, false, "Add column");
  }
}

async function handleColumnManagerAction(event) {
  const button = event.target.closest("[data-delete-column]");
  if (!button || state.role !== "admin") return;
  const key = button.dataset.deleteColumn;
  const column = state.customColumns.find((item) => item.key === key);
  if (!column) return;
  const label = columnLabel(key);
  if (!confirm(`Delete the custom column “${label}”?\n\nAll values stored in this column will be removed. A Drive backup will be created first.`)) return;
  setButtonBusy(button, true, "Deleting…");
  refs.columnManagerError.textContent = "";
  try {
    const response = await apiRequest("deleteCustomColumn", { key });
    applyColumnMetadata(response);
    renderColumnManager();
    showToast(`Column “${label}” deleted. Backup created: ${response.backupFileName || "employee backup"}.`);
    await loadEmployees(true);
    renderColumnManager();
  } catch (error) {
    refs.columnManagerError.textContent = friendlyError(error);
  } finally {
    if (button.isConnected) setButtonBusy(button, false, "Delete column");
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

function populateFieldFilterColumns() {
  const selected = new Set(state.fieldFilterColumns.filter((column) => state.columns.includes(column)));
  state.fieldFilterColumns = [...selected];
  refs.fieldFilterOptions.innerHTML = state.columns.map((column) => `<label><input type="checkbox" value="${escapeAttribute(column)}"${selected.has(column) ? " checked" : ""}><span>${escapeHtml(columnLabel(column))}</span></label>`).join("");
  updateFieldFilterPickerSummary();
}

function selectedFieldFilterColumns() {
  return [...refs.fieldFilterOptions.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value).filter((column) => state.columns.includes(column));
}

function updateFieldFilterPickerSummary() {
  const selected = selectedFieldFilterColumns();
  if (!selected.length) refs.fieldFilterPickerSummary.textContent = "Choose columns…";
  else if (selected.length <= 2) refs.fieldFilterPickerSummary.textContent = selected.map(columnLabel).join(" + ");
  else refs.fieldFilterPickerSummary.textContent = `${selected.length} columns selected`;
}

function applyParticularFieldFilter() {
  const columns = selectedFieldFilterColumns();
  if (!columns.length) {
    showToast("Select at least one field or subject column.", true);
    return;
  }
  state.fieldFilterColumns = columns;
  state.inlineEditCode = "";
  state.page = 1;
  refs.clearFieldFilter.disabled = false;
  refs.fieldFilterPicker.open = false;
  applyFilters();
  showToast(`Showing employees where ${columns.map(columnLabel).join(", ")} ${columns.length === 1 ? "is" : "are"} filled. Use Edit filtered row beside any result.`);
}

function resetParticularFieldFilter() {
  state.fieldFilterColumns = [];
  state.inlineEditCode = "";
  refs.fieldFilterOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; });
  updateFieldFilterPickerSummary();
  refs.fieldFilterPicker.open = false;
  refs.clearFieldFilter.disabled = true;
  state.page = 1;
  applyFilters();
}

function hasParticularFieldFilter() {
  return state.fieldFilterColumns.length > 0;
}

function hasFocusedColumnFilter() {
  return state.filterDisplayColumns.length > 0 || hasParticularFieldFilter() || state.columnFilterRules.length > 0;
}

function employeeColumnFilterValue(employee, column) {
  if (column === "Strength Status") return strengthStatus(employee);
  if (column === "Post Sensitivity") return sensitivityStatus(employee);
  return String(employee[column] == null ? "" : employee[column]).trim();
}

function employeeMatchesColumnRule(employee, rule) {
  const actual = employeeColumnFilterValue(employee, rule.column);
  const normalizedActual = actual.toLocaleLowerCase();
  const expected = String(rule.value || "").trim().toLocaleLowerCase();
  if (rule.operator === "show-all") return true;
  if (rule.operator === "filled") return Boolean(actual);
  if (rule.operator === "blank") return !actual;
  if (rule.operator === "equals") return normalizedActual === expected;
  if (rule.operator === "not-equals") return normalizedActual !== expected;
  if (rule.operator === "starts-with") return normalizedActual.startsWith(expected);
  return normalizedActual.includes(expected);
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
  // Every new search/filter result begins at serial 1. All matching employees
  // remain in the same scrollable directory, so the sequence is continuous.
  state.page = 1;
  state.manualOrderActive = false;
  state.savedOrderRestored = false;
  const query = refs.globalSearch.value.trim().toLocaleLowerCase();
  const group = refs.groupFilter.value;
  const category = refs.categoryFilter.value;
  const status = refs.statusFilter.value;
  const sensitivity = refs.sensitivityFilter.value;
  const fieldColumns = state.fieldFilterColumns;
  const columnRules = state.columnFilterRules;
  state.search = query;
  saveDashboardFilterPreference();
  state.filtered = state.employees.filter((employee) => {
    const searchable = state.columns.map((key) => employee[key] || "").concat(strengthStatus(employee), sensitivityStatus(employee)).join(" ").toLocaleLowerCase();
    const selectedFieldsFilled = fieldColumns.every((column) => String(employee[column] == null ? "" : employee[column]).trim());
    const selectedColumnRulesMatch = columnRules.every((rule) => employeeMatchesColumnRule(employee, rule));
    const matchesOrdinaryFilters = (!query || searchable.includes(query)) &&
      (!group || employee.Grp === group) &&
      (!category || employee.Cat === category) &&
      (!status || strengthStatus(employee) === status) &&
      (!sensitivity || sensitivityStatus(employee) === sensitivity) &&
      (!fieldColumns.length || selectedFieldsFilled) &&
      (!columnRules.length || selectedColumnRulesMatch);
    return matchesOrdinaryFilters;
  });
  sortEmployees();
  applySavedManualOrder();
  updateStats();
  updateFieldFilterSummary();
  updateChooseFiltersButton();
  resetDirectoryScrollPosition();
  renderTable();
}

function resetDirectoryScrollPosition() {
  if (!refs.employeeTableWrap) return;
  refs.employeeTableWrap.scrollTop = 0;
  requestAnimationFrame(updateDirectoryScrollButtons);
}

function scrollEmployeeDirectory(direction) {
  const scroller = refs.employeeTableWrap;
  if (!scroller) return;
  const distance = Math.max(180, Math.round(scroller.clientHeight * 0.72));
  scroller.scrollBy({ top: direction * distance, behavior: "smooth" });
  window.setTimeout(updateDirectoryScrollButtons, 280);
}

function updateDirectoryScrollButtons() {
  const scroller = refs.employeeTableWrap;
  if (!scroller || !refs.tableScrollUp || !refs.tableScrollDown) return;
  const canScroll = scroller.scrollHeight > scroller.clientHeight + 2;
  refs.tableScrollUp.disabled = !canScroll || scroller.scrollTop <= 2;
  refs.tableScrollDown.disabled = !canScroll || scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
}

function clearFilters() {
  refs.globalSearch.value = "";
  refs.groupFilter.value = "";
  refs.categoryFilter.value = "";
  refs.statusFilter.value = "";
  refs.sensitivityFilter.value = "";
  state.filterDisplayColumns = [];
  state.fieldFilterColumns = [];
  state.columnFilterRules = [];
  refs.fieldFilterOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; });
  updateFieldFilterPickerSummary();
  refs.fieldFilterPicker.open = false;
  refs.clearFieldFilter.disabled = true;
  state.page = 1;
  applyFilters();
  showToast("Filters cleared. The saved default filter view has been reset.");
}

function updateFieldFilterSummary() {
  if (!hasParticularFieldFilter()) {
    refs.fieldFilterSummary.textContent = "Choose one or more columns. Employees whose selected columns are all filled will appear for direct editing.";
    refs.clearFieldFilter.disabled = true;
    return;
  }
  const labels = state.fieldFilterColumns.map(columnLabel);
  refs.fieldFilterSummary.textContent = `${state.filtered.length} employee${state.filtered.length === 1 ? "" : "s"} have all selected columns filled: ${labels.join(", ")}. Choose Edit filtered row below.`;
  refs.clearFieldFilter.disabled = false;
}

function sortBy(column) {
  if (state.sortColumn === column) state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  else { state.sortColumn = column; state.sortDirection = "asc"; }
  state.manualOrderActive = false;
  state.savedOrderRestored = false;
  saveDashboardFilterPreference();
  sortEmployees();
  renderTable();
}

function sortEmployees() {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  const column = state.sortColumn;
  const dateColumns = new Set(["DoB", "DoR", "DoJ Govt", "DoJ in Current Office", "Relieving Date"]);
  state.filtered.sort((a, b) => {
    const firstRaw = column === "Strength Status" ? strengthStatus(a) : column === "Post Sensitivity" ? sensitivityStatus(a) : String(a[column] == null ? "" : a[column]).trim();
    const secondRaw = column === "Strength Status" ? strengthStatus(b) : column === "Post Sensitivity" ? sensitivityStatus(b) : String(b[column] == null ? "" : b[column]).trim();
    if (!firstRaw && !secondRaw) return 0;
    if (!firstRaw) return 1;
    if (!secondRaw) return -1;
    if (dateColumns.has(column)) {
      const firstDate = parseDate(firstRaw);
      const secondDate = parseDate(secondRaw);
      if (firstDate && secondDate) return (firstDate.getTime() - secondDate.getTime()) * direction;
    }
    return firstRaw.localeCompare(secondRaw, undefined, { numeric: true, sensitivity: "base" }) * direction;
  });
}

function moveFilteredEmployee(code, direction) {
  if (!hasActiveDashboardFilter()) return;
  const currentIndex = state.filtered.findIndex((employee) => String(employee["Employee Code"] || "") === String(code || ""));
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= state.filtered.length) return;
  [state.filtered[currentIndex], state.filtered[targetIndex]] = [state.filtered[targetIndex], state.filtered[currentIndex]];
  state.manualOrderActive = true;
  state.savedOrderRestored = false;
  state.inlineEditCode = "";
  renderTable();
  showToast(`Employee moved ${direction < 0 ? "up" : "down"}. Serial numbers have been updated for this filtered view.`);
}

function renderTable() {
  buildTableHeader();
  const tableColumns = visibleTableColumns();
  refs.employeeTable.classList.toggle("has-frozen-serial", tableColumns.includes("Sl No."));
  refs.employeeTable.classList.toggle("has-frozen-employee-name", tableColumns.includes("Employee Name"));
  refs.employeeTable.classList.toggle("focused-columns-table", hasFocusedColumnFilter());
  refs.employeeTable.classList.toggle("customized-columns-table", isDashboardColumnCustomized());
  refs.employeeTable.classList.toggle("wide-actions-table", state.role === "admin" && (state.directEditEnabled || hasActiveDashboardFilter()));
  const total = state.filtered.length;
  const start = 0;
  const pageRows = state.filtered;
  refs.tableBody.innerHTML = pageRows.map((employee, rowIndex) => {
    const displaySequence = start + rowIndex + 1;
    const originalCode = String(employee["Employee Code"] || "");
    const filteredRowEditing = hasActiveDashboardFilter();
    const isInlineEditing = state.inlineEditCode === originalCode;
    const cells = tableColumns.map((column) => {
      if (isInlineEditing) return renderInlineCell(employee, column, displaySequence);
      let raw = column === "Sl No." ? String(displaySequence) : employee[column] == null ? "" : String(employee[column]);
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
      const classes = [];
      if (["REMARK ADMN", "Present/Permanent Address"].includes(column)) classes.push("remarks-cell");
      if (isLongDashboardTextColumn(column)) classes.push("long-text-dashboard-column");
      const visualClass = columnVisualClass(column);
      if (visualClass) classes.push(visualClass);
      const usesBadge = ["Grp", "Cat", "Strength Status", "Post Sensitivity"].includes(column) && value;
      const emptyValue = !String(display || "").trim();
      let decoratedValue = value || "—";
      if (!emptyValue && visualClass === "employee-name-column") decoratedValue = `<span class="employee-name-deep-blue">${value}</span>`;
      if (!emptyValue && isPendingWorkColumn(column)) decoratedValue = `<span class="pending-work-red-text">${value}</span>`;
      const cellContent = usesBadge
        ? value
        : `<span class="cell-text value-highlight${emptyValue ? " empty-value" : ""}">${decoratedValue}</span>`;
      return `<td class="${classes.join(" ")}" data-column-key="${escapeAttribute(column)}" title="${escapeAttribute(display)}">${cellContent}</td>`;
    }).join("");
    const employeeName = escapeAttribute(employee["Employee Name"] || "employee");
    let actions = "";
    if (state.role === "admin") {
      if (isInlineEditing) {
        const pendingKey = pendingWorkColumnKey();
        const pendingCount = pendingKey ? pendingWorkItems(employee[pendingKey]).length : 0;
        const moveFinishedAction = pendingKey
          ? `<button class="row-action inline-finished-work" data-action="inline-work" data-code="${escapeAttribute(originalCode)}">Move finished${pendingCount ? ` · ${pendingCount}` : ""}</button>`
          : "";
        actions = `<td class="admin-column" data-column-key="Actions"><div class="action-cell inline-actions"><button class="row-action save" data-action="inline-save" data-code="${escapeAttribute(originalCode)}">Save</button>${moveFinishedAction}<button class="row-action" data-action="inline-cancel" data-code="${escapeAttribute(originalCode)}">Cancel</button></div></td>`;
      } else if (state.directEditEnabled || filteredRowEditing) {
        const manualOrderControls = filteredRowEditing
          ? `<span class="manual-order-controls" aria-label="Manually arrange this employee in the filtered list"><button class="row-action order-arrow" data-action="move-up" data-code="${escapeAttribute(originalCode)}" title="Move employee up" aria-label="Move ${employeeName} up"${rowIndex === 0 ? " disabled" : ""}>↑</button><button class="row-action order-arrow" data-action="move-down" data-code="${escapeAttribute(originalCode)}" title="Move employee down" aria-label="Move ${employeeName} down"${rowIndex === total - 1 ? " disabled" : ""}>↓</button></span>`
          : "";
        actions = `<td class="admin-column" data-column-key="Actions"><div class="action-cell">${manualOrderControls}<button class="row-action inline-edit" data-action="inline-edit" data-code="${escapeAttribute(originalCode)}">${filteredRowEditing ? "Edit filtered row" : "Edit row"}</button><button class="row-action" data-action="edit" data-code="${escapeAttribute(originalCode)}">Full form</button><button class="row-action delete" data-action="delete" data-code="${escapeAttribute(originalCode)}">Delete</button></div></td>`;
      } else {
        actions = `<td class="admin-column" data-column-key="Actions"><div class="action-cell"><button class="row-action" data-action="edit" data-code="${escapeAttribute(originalCode)}">Edit</button><button class="row-action delete" data-action="delete" data-code="${escapeAttribute(originalCode)}">Delete</button></div></td>`;
      }
    }
    const employeeCode = escapeAttribute(employee["Employee Code"]);
    const rowClass = isInlineEditing ? "employee-row inline-row-active" : "employee-row";
    return `<tr class="${rowClass}" tabindex="${isInlineEditing ? "-1" : "0"}" data-employee-code="${employeeCode}" aria-label="${isInlineEditing ? "Editing" : "View full details for"} ${employeeName}">${cells}${actions}</tr>`;
  }).join("");
  refs.tableBody.querySelectorAll(".inline-long-text").forEach((field) => {
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  });

  refs.emptyState.hidden = total !== 0;
  refs.employeeTable.hidden = total === 0;
  const instruction = state.headerEditEnabled
    ? " · Header editing is on — rename headings, then choose Save headers"
    : hasActiveDashboardFilter()
    ? ` · Filtered view — click a header arrow to sort or use row ↑ ↓ to arrange manually; choose Edit filtered row, then Save${state.savedOrderRestored ? " · Saved order restored" : state.manualOrderActive ? " · Unsaved manual order" : ""}`
    : isDashboardColumnCustomized()
    ? ` · Custom view: ${tableColumns.length} selected columns`
    : state.directEditEnabled
    ? " · Row editing is on — choose Edit row, then Save"
    : (total ? " · Click a row for full details" : "");
  refs.resultSummary.textContent = `${total} record${total === 1 ? "" : "s"}${state.search ? " matching search" : ""}${instruction}`;
  refs.pageInfo.textContent = total
    ? `Showing all ${total} employee${total === 1 ? "" : "s"} · Use the visible ▲ ▼ buttons or scrollbar to view every row`
    : "Showing 0 employees";
  updateSaveOrderButtons();
  requestAnimationFrame(updateDirectoryScrollButtons);
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

function renderInlineCell(employee, column, displaySequence) {
  const raw = column === "Sl No." ? String(displaySequence) : employee[column] == null ? "" : String(employee[column]);
  const visualClass = columnVisualClass(column);
  if (column === "Sl No." || column === "AGE") {
    return `<td class="inline-readonly-cell${visualClass ? ` ${visualClass}` : ""}" data-column-key="${escapeAttribute(column)}"><span class="inline-readonly" data-inline-calculated="${escapeAttribute(column)}">${escapeHtml(raw || "—")}</span></td>`;
  }

  if (column === "Strength Status") {
    return `<td class="${visualClass}" data-column-key="${escapeAttribute(column)}">${inlineSelect(column, raw, STRENGTH_STATUSES, true)}</td>`;
  }
  if (column === "Post Sensitivity") {
    return `<td class="${visualClass}" data-column-key="${escapeAttribute(column)}">${inlineSelect(column, raw, SENSITIVITY_VALUES, true)}</td>`;
  }

  const dateColumns = ["DoB", "DoR", "Relieving Date", "DoJ Govt", "DoJ in Current Office"];
  const type = dateColumns.includes(column) ? "date" : column === "Email" ? "email" : column === "Mob" ? "tel" : "text";
  const value = type === "date" ? toIsoDate(raw) : raw;
  const required = ["Employee Name", "Employee Code"].includes(column) ? " required" : "";
  const disabled = column === "Relieving Date" && strengthStatus(employee) === "Present" ? " disabled" : "";
  const maxLength = inlineMaxLength(column);
  const cellClasses = [];
  if (["REMARK ADMN", "Present/Permanent Address"].includes(column)) cellClasses.push("remarks-cell");
  if (isLongDashboardTextColumn(column)) cellClasses.push("long-text-dashboard-column");
  if (visualClass) cellClasses.push(visualClass);
  if (isLongDashboardTextColumn(column)) {
    return `<td class="${cellClasses.join(" ")}" data-column-key="${escapeAttribute(column)}"><textarea class="inline-edit-input inline-long-text" data-inline-field="${escapeAttribute(column)}" rows="2" aria-label="${escapeAttribute(detailLabel(column))}"${required}${maxLength ? ` maxlength="${maxLength}"` : ""}>${escapeHtml(value)}</textarea></td>`;
  }
  return `<td class="${cellClasses.join(" ")}" data-column-key="${escapeAttribute(column)}"><input class="inline-edit-input" type="${type}" data-inline-field="${escapeAttribute(column)}" value="${escapeAttribute(value)}" aria-label="${escapeAttribute(detailLabel(column))}"${required}${disabled}${maxLength ? ` maxlength="${maxLength}"` : ""}></td>`;
}

function handleInlineLongTextResize(event) {
  const field = event.target.closest(".inline-long-text");
  if (!field) return;
  field.style.height = "auto";
  field.style.height = `${field.scrollHeight}px`;
}

function inlineSelect(column, value, standardValues, required) {
  const values = value && !standardValues.includes(value) ? [value].concat(standardValues) : standardValues;
  const placeholder = `<option value="">Select…</option>`;
  const options = values.map((option) => `<option value="${escapeAttribute(option)}"${option === value ? " selected" : ""}>${escapeHtml(option)}</option>`).join("");
  return `<select class="inline-edit-select" data-inline-field="${escapeAttribute(column)}" aria-label="${escapeAttribute(detailLabel(column))}"${required ? " required" : ""}>${placeholder}${options}</select>`;
}

function inlineMaxLength(column) {
  const lengths = { "Employee Name": 100, "Employee Code": 30, "Designation": 80, "Grp": 30, "REMARK ADMN": 500, "Cat": 30, "Present/Permanent Address": 500, "Mob": 15, "Email": 120 };
  if (state.customColumns.some((item) => item.key === column)) return 500;
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
  state.columnFilterRules.forEach((rule) => criteria.push(`${columnLabel(rule.column)} ${columnFilterOperatorLabel(rule.operator).toLocaleLowerCase()}${columnFilterNeedsValue(rule.operator) ? ` “${rule.value}”` : ""}`));
  if (state.savedOrderRestored) criteria.push("Saved employee order restored");
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

  rows = rows.slice();
  // A filtered report must keep the exact dashboard order, including a saved
  // manual ↑/↓ arrangement. Other report types retain their report-specific sort.
  if (type !== "filtered") {
    rows.sort((a, b) => {
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
  }

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
  if (type === "filtered") return { title: state.savedOrderRestored ? "Saved Filter Employee Report" : "Filtered Employee Report", criteria: currentFilterCriteria() };
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
  const sequence = { key: "Sl No.", label: "Sl No.", get: (_employee, index) => index + 1 };
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
  if (type === "filtered") return dashboardViewReportColumns();
  return [sequence, name, code, designation, group, category, sensitivity, dob, currentAge, dor, strength, exitDate];
}

function dashboardViewReportColumns() {
  const dateColumns = new Set(["DoB", "DoR", "DoJ Govt", "DoJ in Current Office", "Relieving Date"]);
  return visibleTableColumns().map((column) => ({
    key: column,
    label: columnLabel(column),
    get: (employee, index) => {
      if (column === "Sl No.") return index + 1;
      if (column === "Strength Status") return strengthStatus(employee);
      if (column === "Post Sensitivity") return sensitivityStatus(employee);
      const value = employee[column] == null ? "" : employee[column];
      return dateColumns.has(column) ? formatDate(value) : value;
    }
  }));
}

function renderReport() {
  const count = state.reportRows.length;
  refs.reportTitle.textContent = state.reportTitle;
  refs.reportCriteria.textContent = state.reportCriteria;
  refs.reportCount.textContent = `${count.toLocaleString("en-IN")} employee${count === 1 ? "" : "s"}`;
  refs.reportGeneratedAt.textContent = `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
  refs.reportTableHead.innerHTML = state.reportColumns.map((column) => {
    const className = reportColumnClass(column.key || column.label);
    return `<th class="${className}">${escapeHtml(column.label)}</th>`;
  }).join("");
  refs.reportTableBody.innerHTML = state.reportRows.map((employee, index) => `<tr>${state.reportColumns.map((column) => {
    const raw = column.get(employee, index);
    const value = raw == null || raw === "" ? "—" : raw;
    const columnKey = column.key || column.label;
    const className = reportColumnClass(columnKey);
    if (columnKey === "Post Sensitivity") return `<td class="${className}"><span class="badge sensitivity ${sensitivityClass(value)}">${escapeHtml(value)}</span></td>`;
    if (columnKey === "Strength Status") return `<td class="${className}"><span class="badge strength ${strengthClass(value)}">${escapeHtml(value)}</span></td>`;
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

function handleTableAction(event) {
  const button = event.target.closest("[data-action]");
  if (button) {
    if (state.role !== "admin") return;
    const employee = findEmployee(button.dataset.code);
    if (!employee) return;
    if (button.dataset.action === "move-up") moveFilteredEmployee(button.dataset.code, -1);
    if (button.dataset.action === "move-down") moveFilteredEmployee(button.dataset.code, 1);
    if (button.dataset.action === "inline-edit") beginInlineEdit(employee);
    if (button.dataset.action === "inline-work") openInlinePendingWork(employee, button.closest("tr"));
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

function inlineEmployeeValue(row, employee, column) {
  if (!column) return "";
  const control = row && row.querySelector(`[data-inline-field="${cssEscape(column)}"]`);
  return control ? String(control.value || "") : String(employee && employee[column] || "");
}

function setInlineEmployeeValue(row, column, value) {
  if (!row || !column) return null;
  let control = row.querySelector(`[data-inline-field="${cssEscape(column)}"]`);
  if (!control) {
    control = document.createElement("input");
    control.type = "hidden";
    control.dataset.inlineField = column;
    (row.querySelector(".inline-actions") || row.lastElementChild || row).appendChild(control);
  }
  control.value = String(value || "");
  if (control.classList.contains("inline-long-text")) {
    control.style.height = "auto";
    control.style.height = `${control.scrollHeight}px`;
  }
  return control;
}

function openInlinePendingWork(employee, row) {
  const pendingKey = pendingWorkColumnKey();
  if (!pendingKey || !row) {
    showToast("Add a custom column named Pending Work or Pending Works first.", true);
    return;
  }
  const items = pendingWorkItems(inlineEmployeeValue(row, employee, pendingKey));
  const historyKey = completedWorkHistoryColumnKey();
  const history = historyKey ? completedWorkHistoryItems(inlineEmployeeValue(row, employee, historyKey)) : [];
  state.inlineWorkTargetCode = String(employee["Employee Code"] || "");
  refs.inlineWorkEmployeeName.textContent = employee["Employee Name"] || state.inlineWorkTargetCode || "Employee";
  refs.inlineWorkNote.textContent = items.length
    ? "Tick every work item that is finished. It will be removed from Pending Works and added to the dated completed history."
    : "No pending work item is currently entered in this row. Enter one item per line in Pending Works first.";
  refs.inlineWorkItemList.innerHTML = items.length ? items.map((item, index) => `
    <label class="pending-work-check-row">
      <input type="checkbox" data-inline-pending-work-index="${index}">
      <span>${escapeHtml(item)}</span>
    </label>
  `).join("") : '<p class="pending-work-archive-empty">No unfinished work is recorded in this row.</p>';
  refs.inlineWorkHistoryCount.textContent = `${history.length} hidden item${history.length === 1 ? "" : "s"}`;
  refs.inlineWorkHistoryList.innerHTML = history.length
    ? `<ol>${history.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`
    : '<p class="pending-work-archive-empty">No completed work has been archived.</p>';
  refs.inlineWorkError.textContent = "";
  updateInlineMoveWorkButton();
  refs.inlineWorkDialog.showModal();
}

function updateInlineMoveWorkButton() {
  const checked = refs.inlineWorkItemList.querySelectorAll("[data-inline-pending-work-index]:checked").length;
  refs.inlineMoveWorkButton.disabled = checked === 0;
  refs.inlineMoveWorkButton.textContent = checked
    ? `✓ Move ${checked} selected into completed`
    : "✓ Move selected into completed";
}

async function moveInlineSelectedWork() {
  const code = state.inlineWorkTargetCode;
  const employee = findEmployee(code);
  const row = refs.tableBody.querySelector(`[data-employee-code="${cssEscape(code)}"]`);
  const pendingKey = pendingWorkColumnKey();
  const selectedIndexes = new Set([...refs.inlineWorkItemList.querySelectorAll("[data-inline-pending-work-index]:checked")].map((input) => Number(input.dataset.inlinePendingWorkIndex)));
  if (!employee || !row || state.inlineEditCode !== code || !pendingKey || !selectedIndexes.size) {
    refs.inlineWorkError.textContent = "The filtered row is no longer available. Close this window and choose Edit filtered row again.";
    return;
  }
  setButtonBusy(refs.inlineMoveWorkButton, true, "Moving…");
  refs.inlineWorkError.textContent = "";
  try {
    const historyKey = await ensureCompletedWorkHistoryColumn();
    const items = pendingWorkItems(inlineEmployeeValue(row, employee, pendingKey));
    const moved = items.filter((_item, index) => selectedIndexes.has(index));
    const remaining = items.filter((_item, index) => !selectedIndexes.has(index));
    if (!moved.length) throw new Error("Choose at least one current Pending Works item.");
    const completionDate = formatDate(isoToday());
    const newHistory = moved.map((item) => `Completed on ${completionDate} — ${item}`);
    const existingHistory = completedWorkHistoryItems(inlineEmployeeValue(row, employee, historyKey));
    const combinedHistory = newHistory.concat(existingHistory).join("\n");
    if (combinedHistory.length > CUSTOM_FIELD_MAX_LENGTH) {
      throw new Error(`Completed Work History can hold ${CUSTOM_FIELD_MAX_LENGTH} characters. Remove or export older history before moving more work.`);
    }
    setInlineEmployeeValue(row, pendingKey, remaining.join("\n"));
    setInlineEmployeeValue(row, historyKey, combinedHistory);
    const actionButton = row.querySelector('[data-action="inline-work"]');
    if (actionButton) {
      actionButton.textContent = `Moved ${moved.length} · Save row`;
      actionButton.classList.add("has-work-draft");
    }
    refs.inlineWorkDialog.close();
    showToast(`${moved.length} finished work item${moved.length === 1 ? "" : "s"} moved in this filtered row. Choose Save to keep the change.`);
  } catch (error) {
    refs.inlineWorkError.textContent = friendlyError(error);
  } finally {
    setButtonBusy(refs.inlineMoveWorkButton, false, "✓ Move selected into completed");
    updateInlineMoveWorkButton();
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
  const current = findEmployee(originalEmployeeCode);
  if (!current) {
    showToast("The employee record is no longer available. Refresh and try again.", true);
    return;
  }
  const employee = {};
  state.columns.forEach((column) => { employee[column] = current[column] == null ? "" : String(current[column]); });
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
  const completedHistoryKey = completedWorkHistoryColumnKey();
  const sections = DETAIL_SECTIONS.map((section) => ({ title: section.title, fields: section.fields.slice() }));
  const ordinaryCustomFields = state.customColumns.map((column) => column.key).filter((column) => column !== completedHistoryKey);
  if (ordinaryCustomFields.length) sections.push({ title: "Additional information", fields: ordinaryCustomFields });
  const completedHistoryMarkup = completedHistoryKey ? completedWorkHistoryDetailsMarkup(employee[completedHistoryKey]) : "";
  refs.employeeDetailsContent.innerHTML = sections.map((section) => `
    <section class="detail-section">
      <h3>${escapeHtml(section.title)}</h3>
      <dl>${section.fields.map((field) => detailRow(field, employee[field])).join("")}</dl>
    </section>
  `).join("") + completedHistoryMarkup;
  refs.detailsEditButton.hidden = state.role !== "admin";
  if (!refs.employeeDetailsDialog.open) refs.employeeDetailsDialog.showModal();
}

function completedWorkHistoryDetailsMarkup(value) {
  const items = completedWorkHistoryItems(value);
  const content = items.length
    ? `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`
    : '<p class="detail-empty">No completed work has been archived.</p>';
  return `<details class="completed-work-profile"><summary><span>Completed work history</span><b>${items.length} hidden item${items.length === 1 ? "" : "s"}</b></summary><div>${content}</div></details>`;
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
  const rowClasses = ["detail-row"];
  if (["REMARK ADMN", "Present/Permanent Address"].includes(field)) rowClasses.push("detail-wide");
  const visualClass = columnVisualClass(field);
  if (visualClass) rowClasses.push(visualClass);
  if (raw && visualClass === "employee-name-column") value = `<span class="employee-name-deep-blue">${value}</span>`;
  if (raw && isPendingWorkColumn(field)) value = `<span class="pending-work-red-text">${value}</span>`;
  return `<div class="${rowClasses.join(" ")}" data-field="${escapeAttribute(field)}"><dt>${escapeHtml(detailLabel(field))}</dt><dd class="${valueClass}">${value}</dd></div>`;
}

function detailLabel(field) {
  const labels = {
    "Sl No.": "Serial number", "Grp": "Group", "Cat": "Category", "REMARK ADMN": "Administration remarks",
    "DoB": "Date of birth", "DoR": "Date of retirement", "DoJ Govt": "Date of joining Government",
    "DoJ in Current Office": "Date of joining current office", "Present/Permanent Address": "Present / permanent address",
    "Mob": "Mobile", "AGE": "Age", "Relieving Date": "Relieving / exit date"
  };
  return labels[field] || columnLabel(field) || field;
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
  renderCustomEmployeeFields(item);
  renderPendingWorkArchiveTools();
  updateStrengthDateState();
  refs.employeeDialog.showModal();
  setTimeout(() => refs.fieldEmployeeName.focus(), 30);
}

function renderCustomEmployeeFields(employee) {
  const visibleCustomColumns = state.customColumns.filter((column) => !isCompletedWorkHistoryColumn(column.key));
  const visibleFields = visibleCustomColumns.map((column) => {
    const value = employee[column.key] || "";
    if (isPendingWorkColumn(column.key)) {
      return `<label class="span-two pending-work-edit-field"><span>${escapeHtml(columnLabel(column.key))}</span><textarea rows="3" maxlength="${CUSTOM_FIELD_MAX_LENGTH}" data-custom-employee-field="${escapeAttribute(column.key)}" placeholder="Enter one pending work item per line">${escapeHtml(value)}</textarea><small>Keep each work item on a separate line so completed items can be moved individually.</small></label>`;
    }
    return `<label><span>${escapeHtml(columnLabel(column.key))}</span><input type="text" maxlength="${CUSTOM_FIELD_MAX_LENGTH}" data-custom-employee-field="${escapeAttribute(column.key)}" value="${escapeAttribute(value)}"></label>`;
  }).join("");
  const completedHistoryKey = completedWorkHistoryColumnKey();
  const completedHistoryInput = completedHistoryKey
    ? `<input type="hidden" maxlength="${CUSTOM_FIELD_MAX_LENGTH}" data-custom-employee-field="${escapeAttribute(completedHistoryKey)}" value="${escapeAttribute(employee[completedHistoryKey] || "")}">`
    : "";
  refs.customEmployeeFields.innerHTML = visibleFields + completedHistoryInput;
  refs.customEmployeeFields.closest(".custom-fields-section").hidden = visibleCustomColumns.length === 0;
}

function pendingWorkItems(value) {
  return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function completedWorkHistoryItems(value) {
  return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function customEmployeeField(column) {
  if (!column) return null;
  return refs.customEmployeeFields.querySelector(`[data-custom-employee-field="${cssEscape(column)}"]`);
}

function handleCustomEmployeeFieldInput(event) {
  const field = event.target.closest("[data-custom-employee-field]");
  if (!field || !isPendingWorkColumn(field.dataset.customEmployeeField)) return;
  renderPendingWorkArchiveTools(true);
}

function renderPendingWorkArchiveTools(preserveOpen) {
  const pendingKey = pendingWorkColumnKey();
  const pendingField = customEmployeeField(pendingKey);
  const wasOpen = preserveOpen && refs.pendingWorkArchiveSection.open;
  const available = Boolean(pendingKey && pendingField);
  refs.pendingWorkArchiveButton.disabled = !available;
  refs.pendingWorkArchiveButton.textContent = available ? "Move finished pending work" : "Pending Work column needed";
  refs.pendingWorkArchiveToolbarNote.textContent = available
    ? "Select finished items and move them into the dated completed history."
    : "Use Manage columns once to add a column named Pending Work or Pending Works.";
  refs.pendingWorkArchiveSection.hidden = !pendingKey || !pendingField;
  if (!pendingKey || !pendingField) return;
  refs.pendingWorkArchiveSection.open = Boolean(wasOpen);
  const items = pendingWorkItems(pendingField.value);
  refs.pendingWorkArchiveSummary.textContent = items.length ? `${items.length} pending work item${items.length === 1 ? "" : "s"}` : "No pending work";
  refs.pendingWorkArchiveNote.textContent = items.length
    ? "Select finished items below. They will leave Pending Works and move into the dated hidden history when you save the employee."
    : "Enter pending work above, keeping one item on each line.";
  refs.pendingWorkItemList.innerHTML = items.length ? items.map((item, index) => `
    <label class="pending-work-check-row">
      <input type="checkbox" data-pending-work-index="${index}">
      <span>${escapeHtml(item)}</span>
    </label>
  `).join("") : '<p class="pending-work-archive-empty">No unfinished work is recorded.</p>';
  renderCompletedWorkHistoryEditor();
  updateMoveCompletedWorkButton();
  refs.pendingWorkArchiveButton.textContent = items.length
    ? `Move finished work · ${items.length}`
    : "Move finished pending work";
}

function openPendingWorkArchive() {
  if (refs.pendingWorkArchiveButton.disabled || refs.pendingWorkArchiveSection.hidden) return;
  refs.pendingWorkArchiveSection.open = true;
  requestAnimationFrame(() => {
    refs.pendingWorkArchiveSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const firstPendingItem = refs.pendingWorkItemList.querySelector("[data-pending-work-index]");
    if (firstPendingItem) firstPendingItem.focus({ preventScroll: true });
  });
}

function renderCompletedWorkHistoryEditor() {
  const historyKey = completedWorkHistoryColumnKey();
  const historyField = customEmployeeField(historyKey);
  const items = completedWorkHistoryItems(historyField ? historyField.value : "");
  refs.completedWorkHistoryCount.textContent = `${items.length} hidden item${items.length === 1 ? "" : "s"}`;
  refs.completedWorkHistoryList.innerHTML = items.length
    ? `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`
    : '<p class="pending-work-archive-empty">No completed work has been archived.</p>';
}

function updateMoveCompletedWorkButton() {
  const checked = refs.pendingWorkItemList.querySelectorAll("[data-pending-work-index]:checked").length;
  refs.moveCompletedWorkButton.disabled = checked === 0;
  refs.moveCompletedWorkButton.textContent = checked ? `✓ Move ${checked} selected to completed` : "✓ Move selected to completed";
}

async function ensureCompletedWorkHistoryColumn() {
  let key = completedWorkHistoryColumnKey();
  if (key) return key;
  const response = await apiRequest("addCustomColumn", { label: COMPLETED_WORK_HISTORY_LABEL });
  applyColumnMetadata(response);
  key = String(response.key || completedWorkHistoryColumnKey());
  if (!key) throw new Error("Completed Work History could not be created.");
  refs.customEmployeeFields.insertAdjacentHTML("beforeend", `<input type="hidden" maxlength="${CUSTOM_FIELD_MAX_LENGTH}" data-custom-employee-field="${escapeAttribute(key)}" value="">`);
  state.dashboardColumns = state.dashboardColumns.filter((column) => state.columns.includes(column));
  saveDashboardColumnPreference();
  updateChooseColumnsButton();
  return key;
}

async function moveSelectedWorkToCompleted() {
  const pendingKey = pendingWorkColumnKey();
  const pendingField = customEmployeeField(pendingKey);
  const selectedIndexes = new Set([...refs.pendingWorkItemList.querySelectorAll("[data-pending-work-index]:checked")].map((input) => Number(input.dataset.pendingWorkIndex)));
  if (!pendingField || !selectedIndexes.size) return;
  setButtonBusy(refs.moveCompletedWorkButton, true, "Moving…");
  refs.employeeFormError.textContent = "";
  try {
    const historyKey = await ensureCompletedWorkHistoryColumn();
    const historyField = customEmployeeField(historyKey);
    const items = pendingWorkItems(pendingField.value);
    const moved = items.filter((_item, index) => selectedIndexes.has(index));
    const remaining = items.filter((_item, index) => !selectedIndexes.has(index));
    const completionDate = formatDate(isoToday());
    const newHistory = moved.map((item) => `Completed on ${completionDate} — ${item}`);
    const existingHistory = completedWorkHistoryItems(historyField ? historyField.value : "");
    const combinedHistory = newHistory.concat(existingHistory).join("\n");
    if (combinedHistory.length > CUSTOM_FIELD_MAX_LENGTH) {
      throw new Error(`Completed Work History can hold ${CUSTOM_FIELD_MAX_LENGTH} characters. Remove or export older history before moving more work.`);
    }
    pendingField.value = remaining.join("\n");
    historyField.value = combinedHistory;
    renderPendingWorkArchiveTools(true);
    refs.completedWorkHistoryDetails.open = false;
    showToast(`${moved.length} work item${moved.length === 1 ? "" : "s"} moved to completed history. Choose Save employee to keep the change.`);
  } catch (error) {
    refs.employeeFormError.textContent = friendlyError(error);
  } finally {
    setButtonBusy(refs.moveCompletedWorkButton, false, "✓ Move selected to completed");
    updateMoveCompletedWorkButton();
  }
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
  refs.customEmployeeFields.querySelectorAll("[data-custom-employee-field]").forEach((input) => {
    employee[input.dataset.customEmployeeField] = input.value.trim();
  });
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
  const headerLookup = new Map();
  state.columns.forEach((key) => {
    [key, columnLabel(key), DEFAULT_COLUMN_LABELS[key]].filter(Boolean).forEach((label) => headerLookup.set(String(label).trim().toLocaleLowerCase(), key));
  });
  Object.entries(CSV_HEADER_ALIASES).forEach(([label, key]) => headerLookup.set(label.toLocaleLowerCase(), key));
  const headers = matrix[headerRowIndex].map((header) => {
    const label = header.trim();
    return headerLookup.get(label.toLocaleLowerCase()) || CSV_HEADER_ALIASES[label] || label;
  });
  const required = ["Employee Name", "Employee Code"];
  required.forEach((header) => { if (!headers.includes(header)) throw new Error(`CSV column missing: ${header}`); });
  return matrix.slice(headerRowIndex + 1).map((values) => {
    const item = {};
    headers.forEach((header, index) => { if (state.columns.includes(header)) item[header] = values[index] == null ? "" : values[index].trim(); });
    return item;
  }).filter((item) => state.columns.some((header) => !["Sl No.", "AGE"].includes(header) && String(item[header] || "").trim()));
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
  const rows = [state.columns.map((key) => columnLabel(key))]
    .concat(state.filtered.map((employee) => state.columns.map((key) => employee[key] || "")));
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
  const messages = {
    INVALID_LOGIN: "Incorrect username or password.",
    LOGIN_BLOCKED: "Too many failed attempts. Please wait 10 minutes.",
    SESSION_EXPIRED: "Your session expired. Please sign in again.",
    FORBIDDEN: "Your account does not have permission for this action.",
    DUPLICATE_CODE: "That employee code already exists.",
    DUPLICATE_IMPORT_CODE: "The CSV contains a duplicate employee code.",
    INVALID_IMPORT_ROW: error.message,
    INVALID_SENSITIVITY: "Select Sensitive or Non-Sensitive for Post Sensitivity.",
    INVALID_COLUMN_NAME: "Enter a clear name for the new column.",
    DUPLICATE_COLUMN_LABEL: "Every column name must be different.",
    CUSTOM_COLUMN_LIMIT: "A maximum of 12 custom columns can be added.",
    PROTECTED_COLUMN: "The 18 essential HR columns are protected and cannot be deleted.",
    ORIGIN_BLOCKED: "This GitHub address is not allowed by the backend.",
    UNKNOWN_ACTION: `Backend update incomplete. Deploy Code.gs v${CONFIG.REQUIRED_BACKEND_VERSION} as a new version, sign in again, and retry.`,
    SHEET_SCHEMA_MISMATCH: "The Sheet columns cannot be safely matched. Use Replace all data with the corrected CSV.",
    TIMEOUT: "The backend did not respond. Check the Apps Script deployment and internet connection.",
    NOT_CONFIGURED: "Connect the Apps Script web app URL in app.js first."
  };
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
