"use strict";
const CONFIG = Object.freeze({
    API_URL: "https://script.google.com/macros/s/AKfycbyc13F44x6wvxRVxO3zWo6JVaom2kS-AzrGZopnF7fXb1-l55hZuPyXbY7hA-sum25G/exec",
    CHANNEL: "ADG_HR_API_V1",
    FRONTEND_VERSION: "1.6.75",
    REQUIRED_BACKEND_VERSION: "1.6.3",
    REQUEST_TIMEOUT_MS: 45e3
  }),
  CORE_COLUMNS = ["Sl No.", "Employee Name", "Employee Code", "Designation", "Grp", "DoB", "DoR", "Cat", "DoJ Govt", "DoJ in Current Office", "Present/Permanent Address", "Mob", "Email", "AGE", "Strength Status", "Relieving Date", "Post Sensitivity", "REMARK ADMN"],
  DEFAULT_COLUMN_LABELS = Object.freeze(Object.assign(CORE_COLUMNS.reduce((e, t) => (e[t] = t, e), {}), {
    "DoJ in Current Office": "DoJ in ADG",
    "Present/Permanent Address": "Present/Permanent"
  })),
  STRENGTH_STATUSES = Object.freeze(["Present", "Relieved", "Transferred", "Retired", "Present Oth Off", "Relieved Oth Off", "Transferred Oth Off", "Retired Oth Off"]),
  SENSITIVITY_VALUES = Object.freeze(["Sensitive", "Non-Sensitive"]),
  COMPLETED_WORK_HISTORY_LABEL = "Completed Work History",
  CUSTOM_FIELD_MAX_LENGTH = 500,
  COLUMN_WIDTH_STORAGE_KEY = "hrDashboardColumnWidthsV159",
  REPORT_COLUMN_WIDTH_STORAGE_KEY = "hrDashboardReportColumnWidthsV166",
  REPORT_HEADER_FOOTER_STORAGE_KEY = "hrDashboardReportHeaderFooterV166",
  REPORT_ORIENTATION_STORAGE_KEY = "hrDashboardReportOrientationV166",
  REPORT_ALIGNMENT_STORAGE_KEY = "hrDashboardReportAlignmentV166",
  STAT_CARD_STORAGE_KEY = "hrDashboardStatCardSelectionV175",
  STICKY_FOCUS_ID_STORAGE_KEY = "hrDashboardStickyFocusIdV159",
  STICKY_FOCUS_COLLAPSED_STORAGE_KEY = "hrDashboardStickyFocusCollapsedV159",
  STICKY_FOCUS_LAYOUT_STORAGE_KEY = "hrDashboardStickyFocusLayoutV159",
  STICKY_SIDE_TAB_LAYOUT_STORAGE_KEY = "hrDashboardStickySideTabLayoutV166",
  SESSION_LAST_ACTIVITY_KEY = "hrDashboardLastActivityV159",
  SESSION_EXIT_MARKER_KEY = "hrDashboardPageExitV159",
  SESSION_TIMEOUT_STORAGE_KEY = "hrDashboardSessionTimeoutMinutesV159",
  SESSION_ALLOWED_TIMEOUT_MINUTES = Object.freeze([5, 10, 15, 20, 30]),
  SESSION_DEFAULT_TIMEOUT_MINUTES = 30,
  SESSION_FALLBACK_TIMEOUT_MINUTES = 5,
  SESSION_WARNING_MS = 6e4,
  BACKEND_VERSION_CACHE_KEY = "hrDashboardBackendVersionV159",
  BACKEND_VERSION_CACHE_TTL_MS = 216e5,
  BACKEND_PROBE_DELAY_MS = 1800,
  AUTH_SESSION_KEYS = Object.freeze(["hrSessionToken", "hrRole", "hrDisplayName", "hrUsername", SESSION_LAST_ACTIVITY_KEY, SESSION_TIMEOUT_STORAGE_KEY]),
  STICKY_FOCUS_SIZES = Object.freeze([{
    className: "size-small",
    label: "Small",
    width: 280,
    height: 220
  }, {
    className: "size-medium",
    label: "Medium",
    width: 350,
    height: 300
  }, {
    className: "size-large",
    label: "Large",
    width: 440,
    height: 390
  }, {
    className: "size-xlarge",
    label: "X-Large",
    width: 540,
    height: 480
  }]),
  STICKY_FOCUS_MIN_WIDTH = 240,
  STICKY_FOCUS_MIN_HEIGHT = 150,
  COLUMN_WIDTH_MIN = 48,
  COLUMN_WIDTH_MAX = 480,
  COLUMN_FILTER_OPERATORS = Object.freeze([{
    value: "contains",
    label: "Contains"
  }, {
    value: "equals",
    label: "Is exactly"
  }, {
    value: "not-equals",
    label: "Is not"
  }, {
    value: "starts-with",
    label: "Starts with"
  }, {
    value: "filled",
    label: "Has any text"
  }, {
    value: "blank",
    label: "Is empty"
  }]),
  CSV_HEADER_ALIASES = Object.freeze({
    "DoJ in ADG": "DoJ in Current Office",
    "Present/Permanent": "Present/Permanent Address"
  }),
  DETAIL_SECTIONS = Object.freeze([{
    title: "Identity and posting",
    fields: ["Sl No.", "Employee Name", "Employee Code", "Designation", "Grp", "Cat"]
  }, {
    title: "Service details",
    fields: ["Strength Status", "Post Sensitivity", "Relieving Date", "DoJ Govt", "DoJ in Current Office", "DoR"]
  }, {
    title: "Personal and contact details",
    fields: ["DoB", "AGE", "Present/Permanent Address", "Mob", "Email"]
  }, {
    title: "Administration",
    fields: ["REMARK ADMN"]
  }]),
  DATE_REPORTS = Object.freeze({
    retirement: {
      field: "DoR",
      title: "Employees retiring"
    },
    "joining-govt": {
      field: "DoJ Govt",
      title: "Employees who joined Government"
    },
    "joining-office": {
      field: "DoJ in Current Office",
      title: "Employees who joined the current office"
    },
    relieving: {
      field: "Relieving Date",
      title: "Employees relieved / exited"
    }
  }),
  state = {
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
    manualOrderActive: !1,
    savedOrderRestored: !1,
    savedManualOrders: readSavedManualOrders(),
    namedFilterViews: [],
    filterViewsLoadTimer: 0,
    activeFilterViewId: "",
    activeFilterViewName: "",
    search: "",
    detailEmployeeCode: "",
    filterDisplayColumns: [],
    fieldFilterColumns: [],
    columnFilterRules: [],
    dashboardColumns: readDashboardColumnPreference(),
    dashboardFilterPreference: readDashboardFilterPreference(),
    reportRows: [],
    reportColumns: [],
    reportPrintColumns: null,
    reportTitle: "",
    reportCriteria: "",
    reportType: "age",
    directEditEnabled: !1,
    headerEditEnabled: !1,
    inlineEditCode: "",
    columnLabels: Object.assign({}, DEFAULT_COLUMN_LABELS),
    headerLabelsDirty: !1,
    backendVersion: readCachedBackendVersion(),
    backendMismatchNotified: !1,
    backendProbeTimer: 0,
    employeeSearchIndex: new WeakMap,
    inlineWorkTargetCode: "",
    stickyNotes: [],
    stickyEditId: "",
    stickyFocusId: readStickyFocusId(),
    stickyFocusCollapsed: readStickyFocusCollapsed(),
    stickyFocusLayout: readStickyFocusLayout(),
    stickyFocusDrag: null,
    stickyFocusToggleMoved: !1,
    stickySideTabDrag: null,
    stickySideTabMoved: !1,
    stickySideTabLayout: readStickySideTabLayout(),
    statCardSelection: null,
    stickyFocusResize: null,
    stickyFocusResizeObserver: null,
    stickyNotesLoadTimer: 0,
    diaryEntries: [],
    diaryView: "recent",
    diaryEditId: "",
    fileRecords: [],
    fileRecordEditId: "",
    sessionTimeoutMinutes: normalizeSessionTimeoutMinutes(sessionStorage.getItem(SESSION_TIMEOUT_STORAGE_KEY), 5),
    sessionIdleTimer: 0,
    sessionWarningTimer: 0,
    sessionWarningCountdownTimer: 0,
    sessionHeartbeatTimer: 0,
    sessionLastActivityWrite: 0,
    sessionLastHeartbeat: 0,
    logoutInProgress: !1
  },
  $ = e => document.getElementById(e),
  refs = {};

function init() {
  ["loginView", "dashboardView", "loginForm", "username", "password", "togglePassword", "rememberUsername", "loginButton", "loginError", "loginFrontendVersion", "loginBackendVersion", "dashboardFrontendVersion", "dashboardBackendVersion", "logoutButton", "refreshButton", "lastUpdated", "displayName", "roleLabel", "userInitial", "statCardGrid", "customizeStatsButton", "statCardDialog", "statCardPickerSummary", "statCardOptions", "resetStatCardsButton", "resultSummary", "globalSearch", "groupFilter", "categoryFilter", "statusFilter", "sensitivityFilter", "clearFilters", "employeeTableWrap", "employeeTable", "tableHead", "tableBody", "emptyState", "tableScrollUp", "tableScrollDown", "pageInfo", "exportButton", "importButton", "replaceAllButton", "printFilteredButton", "chooseColumnsButton", "resetColumnWidthsButton", "chooseFiltersButton", "savedViewsButton", "saveOrderButton", "resetOrderButton", "directEditToggle", "editHeadersButton", "saveHeadersButton", "resetHeadersButton", "fieldFilterEditBar", "fieldFilterSummary", "fieldFilterPicker", "fieldFilterPickerSummary", "fieldFilterOptions", "applyFieldFilter", "clearFieldFilter", "dataLoadStatus", "dataLoadStatusTitle", "dataLoadStatusMessage", "retryEmployeeLoadButton", "csvFileInput", "replaceCsvFileInput", "backupButton", "addEmployeeButton", "manageColumnsButton", "employeeDialog", "employeeForm", "employeeDialogTitle", "originalEmployeeCode", "employeeFormError", "saveEmployeeButton", "fieldEmployeeName", "fieldEmployeeCode", "fieldDesignation", "fieldGroup", "fieldRemarks", "fieldDoB", "fieldDoR", "fieldCategory", "fieldDoJGovt", "fieldDoJOfficeLabel", "fieldDoJOffice", "fieldAddress", "fieldPostSensitivity", "fieldStrengthStatus", "fieldRelievingDate", "relievingDateHint", "fieldMobile", "fieldEmail", "fieldAge", "customEmployeeFields", "pendingWorkArchiveToolbar", "pendingWorkArchiveToolbarNote", "pendingWorkArchiveButton", "pendingWorkArchiveSection", "pendingWorkArchiveSummary", "pendingWorkArchiveNote", "pendingWorkItemList", "moveCompletedWorkButton", "completedWorkHistoryDetails", "completedWorkHistoryCount", "completedWorkHistoryList", "inlineWorkDialog", "inlineWorkEmployeeName", "inlineWorkNote", "inlineWorkItemList", "inlineWorkHistoryCount", "inlineWorkHistoryList", "inlineWorkError", "inlineMoveWorkButton", "loadingOverlay", "loadingText", "toastRegion", "employeeDetailsDialog", "detailsAvatar", "detailsEmployeeName", "detailsEmployeeSubtitle", "detailsStrengthStatus", "detailsPostSensitivity", "employeeDetailsContent", "detailsEditButton", "reportsButton", "reportDialog", "reportForm", "reportType", "reportReferenceField", "reportReferenceDate", "reportAgeMinField", "reportAgeMin", "reportAgeMaxField", "reportAgeMax", "reportFromField", "reportFromDate", "reportToField", "reportToDate", "reportValueField", "reportValueLabel", "reportValue", "reportTextField", "reportTextValue", "reportResetButton", "reportTitle", "reportCriteria", "reportCount", "reportGeneratedAt", "reportTableWrap", "reportTable", "reportTableHead", "reportTableBody", "reportEmptyState", "reportFooterSummary", "reportExportButton", "reportPrintButton", "reportPrintColumnsField", "reportPrintColumnsPicker", "reportPrintColumnsSummary", "reportPrintColumnsOptions", "reportPrintColumnsSelectAll", "reportPrintColumnsReset", "resetReportColumnWidthsButton", "reportHeaderNote", "reportFooterNote", "reportFooterSignatures", "reportFooterRepeat", "reportHeaderNoteDisplay", "reportPrintFooter", "reportFooterNoteDisplay", "reportSignatureBlock", "reportOrientationLandscape", "reportOrientationPortrait", "reportAlignmentField", "reportColumnAlignment", "reportShowHeading", "reportPrintHeading", "changePasswordButton", "passwordDialog", "passwordForm", "currentPassword", "newPassword", "confirmPassword", "passwordFormError", "administrationButton", "administrationDialog", "securitySettingsForm", "sessionTimeoutMinutes", "currentSessionTimeout", "securitySettingsError", "saveSecuritySettingsButton", "loginSessionSecurityNote", "sessionWarningDialog", "sessionWarningCountdown", "sessionWarningMessage", "staySignedInButton", "warningSignOutButton", "columnViewDialog", "columnViewList", "columnViewCount", "applyColumnViewButton", "restoreAllColumnsButton", "filterViewDialog", "filterViewSummary", "filterViewSearch", "filterViewGroup", "filterViewCategory", "filterViewStatus", "filterViewSensitivity", "filterViewSortColumn", "filterViewSortDirection", "filterScrollUp", "filterScrollDown", "savedFilterViewsPanel", "savedFilterViewCount", "savedFilterViewList", "savedFilterViewEmpty", "savedFilterViewName", "saveNamedFilterViewButton", "columnFilterRuleList", "columnFilterRuleEmpty", "filterViewError", "addColumnFilterRuleButton", "applyFilterViewButton", "clearFilterViewButton", "columnManagerDialog", "columnManagerForm", "newColumnName", "customColumnList", "customColumnEmpty", "columnManagerError", "stickyNotesButton", "stickyActiveCount", "stickyNotesDialog", "stickyNoteForm", "stickyNoteType", "stickyNoteTitle", "stickyNoteDueDate", "stickyNoteDetails", "saveStickyNoteButton", "cancelStickyEditButton", "stickyNoteError", "stickyActiveSummary", "stickyActiveList", "stickyActiveEmpty", "stickyCompletedCount", "stickyCompletedList", "stickyCompletedEmpty", "stickySideTab", "stickySideCount", "stickyFocusNote", "stickyFocusDragHandle", "stickyFocusToggle", "stickyFocusType", "stickyFocusTitle", "stickyFocusChevron", "stickyFocusBody", "stickyFocusDetails", "stickyFocusDue", "stickyFocusSizeDown", "stickyFocusSizeLabel", "stickyFocusSizeUp", "stickyFocusEdit", "stickyFocusComplete", "stickyFocusResetLayout", "stickyFocusManage", "stickyFocusUnpin", "stickyFocusResizeGrip", "workDiaryButton", "workDiaryDialog", "diaryEntryForm", "diaryEntryId", "diaryEntryDate", "diaryEntryTitle", "diaryEntryDetails", "diaryEntryCategory", "diaryEntryTags", "diaryEntryEmployee", "diaryEmployeeSuggestions", "diaryEntryLink", "diaryEntryVisibility", "diaryEntryLearning", "diaryEntryImportant", "diaryEntryError", "saveDiaryEntryButton", "cancelDiaryEditButton", "diaryFormHeading", "diarySearch", "diaryMonthFilter", "diaryCategoryFilter", "diarySourceFilter", "diaryRecentLimit", "clearDiaryFiltersButton", "diaryResultSummary", "diaryLearningCount", "diaryEntryList", "diaryEmptyState", "fileRegisterButton", "fileRegisterDialog", "fileRecordForm", "fileRecordId", "fileRecordFormHeading", "fileRecordNo", "fileRecordSubject", "fileRecordCategory", "fileRecordSection", "fileRecordStatus", "fileRecordRemarks", "fileRecordLink", "fileRecordError", "saveFileRecordButton", "cancelFileRecordEditButton", "fileRecordSearch", "fileRecordStatusFilter", "clearFileRecordSearchButton", "fileRecordSummary", "fileRecordList", "fileRecordEmpty", "fileRegisterStorageNote", "fileRegisterSpreadsheetUrl"].forEach(e => {
    refs[e] = $(e)
  });
  initialiseSessionSecurity(repairStoredSession());
  const e = localStorage.getItem("hrRememberedUsername") || "";
  refs.username.value = e, refs.rememberUsername.checked = Boolean(e), refs.loginForm.addEventListener("submit", handleLogin), refs.togglePassword.addEventListener("click", togglePasswordVisibility), refs.logoutButton.addEventListener("click", logout), refs.refreshButton.addEventListener("click", () => loadEmployees(!0).catch(() => {})), refs.globalSearch.addEventListener("input", debounce(applyFilters, 140)), refs.groupFilter.addEventListener("change", applyFilters), refs.categoryFilter.addEventListener("change", applyFilters), refs.statusFilter.addEventListener("change", applyFilters), refs.sensitivityFilter.addEventListener("change", applyFilters), refs.clearFilters.addEventListener("click", clearFilters), refs.retryEmployeeLoadButton.addEventListener("click", () => loadEmployees(!0).catch(() => {})), refs.employeeTableWrap.addEventListener("scroll", updateDirectoryScrollButtons, {
    passive: !0
  }), refs.tableScrollUp.addEventListener("click", () => scrollEmployeeDirectory(-1)), refs.tableScrollDown.addEventListener("click", () => scrollEmployeeDirectory(1)), window.addEventListener("resize", debounce(updateDirectoryScrollButtons, 120)), refs.exportButton.addEventListener("click", exportFilteredCsv), refs.printFilteredButton.addEventListener("click", openFilteredReport), refs.chooseColumnsButton.addEventListener("click", openDashboardColumnChooser), refs.resetColumnWidthsButton.addEventListener("click", resetAllColumnWidths), refs.chooseFiltersButton.addEventListener("click", openDashboardFilterChooser), refs.savedViewsButton.addEventListener("click", openSavedFilterViews), refs.saveOrderButton.addEventListener("click", saveManualFilteredOrder), refs.resetOrderButton.addEventListener("click", resetManualFilteredOrder), refs.columnViewList.addEventListener("click", handleDashboardColumnOrder), refs.columnViewList.addEventListener("change", updateDashboardColumnCount), refs.applyColumnViewButton.addEventListener("click", applyDashboardColumnView), refs.restoreAllColumnsButton.addEventListener("click", restoreAllDashboardColumns), refs.filterViewDialog.addEventListener("input", updateFilterViewSummary), refs.filterViewDialog.addEventListener("change", updateFilterViewSummary), refs.filterViewDialog.addEventListener("scroll", updateFilterScrollButtons, {
    passive: !0
  }), refs.filterScrollUp.addEventListener("click", () => scrollFilterDialog(-1)), refs.filterScrollDown.addEventListener("click", () => scrollFilterDialog(1)), refs.savedFilterViewsPanel.addEventListener("toggle", () => setTimeout(updateFilterScrollButtons, 0)), refs.savedFilterViewList.addEventListener("click", handleNamedFilterViewAction), refs.saveNamedFilterViewButton.addEventListener("click", saveNamedFilterView), refs.savedFilterViewName.addEventListener("keydown", e => {
    "Enter" === e.key && (e.preventDefault(), saveNamedFilterView())
  }), refs.columnFilterRuleList.addEventListener("change", handleColumnFilterRuleChange), refs.columnFilterRuleList.addEventListener("click", handleColumnFilterRuleAction), refs.addColumnFilterRuleButton.addEventListener("click", addColumnFilterRule), refs.applyFilterViewButton.addEventListener("click", applyDashboardFilterView), refs.clearFilterViewButton.addEventListener("click", clearDashboardFilterView), refs.directEditToggle.addEventListener("click", toggleDirectEdit), refs.editHeadersButton.addEventListener("click", toggleHeaderEdit), refs.saveHeadersButton.addEventListener("click", saveHeaderLabels), refs.resetHeadersButton.addEventListener("click", resetHeaderLabels), refs.importButton.addEventListener("click", () => refs.csvFileInput.click()), refs.csvFileInput.addEventListener("change", importCsv), refs.replaceAllButton.addEventListener("click", () => refs.replaceCsvFileInput.click()), refs.replaceCsvFileInput.addEventListener("change", replaceAllCsv), refs.backupButton.addEventListener("click", createBackup), refs.addEmployeeButton.addEventListener("click", () => openEmployeeDialog()), refs.stickyNotesButton.addEventListener("click", openStickyNotes), refs.stickySideTab.addEventListener("click", handleStickySideTabClick), refs.stickySideTab.addEventListener("pointerdown", startStickySideTabDrag), window.addEventListener("pointermove", moveStickySideTabDrag), window.addEventListener("pointerup", endStickySideTabDrag), window.addEventListener("pointercancel", endStickySideTabDrag), refs.stickyNoteForm.addEventListener("submit", saveStickyNote), refs.stickyActiveList.addEventListener("click", handleStickyNoteAction), refs.stickyCompletedList.addEventListener("click", handleStickyNoteAction), refs.cancelStickyEditButton.addEventListener("click", cancelStickyEdit), refs.stickyFocusToggle.addEventListener("click", toggleStickyFocus), refs.stickyFocusToggle.addEventListener("pointerdown", startStickyFocusToggleDrag), refs.stickyFocusToggle.addEventListener("keydown", e => {
    state.stickyFocusCollapsed && moveStickyFocusWithKeyboard(e)
  }), refs.stickyFocusDragHandle.addEventListener("pointerdown", startStickyFocusDrag), refs.stickyFocusDragHandle.addEventListener("keydown", moveStickyFocusWithKeyboard), window.addEventListener("pointermove", moveStickyFocusDrag), window.addEventListener("pointerup", endStickyFocusDrag), window.addEventListener("pointercancel", endStickyFocusDrag), refs.stickyFocusResizeGrip.addEventListener("pointerdown", startStickyFocusResize), refs.stickyFocusResizeGrip.addEventListener("keydown", resizeStickyFocusWithKeyboard), window.addEventListener("pointermove", moveStickyFocusResize), window.addEventListener("pointerup", endStickyFocusResize), window.addEventListener("pointercancel", endStickyFocusResize), refs.stickyFocusSizeDown.addEventListener("click", () => changeStickyFocusSize(-1)), refs.stickyFocusSizeUp.addEventListener("click", () => changeStickyFocusSize(1)), refs.stickyFocusEdit.addEventListener("click", editPinnedStickyNote), refs.stickyFocusComplete.addEventListener("click", () => completeStickyNote(refs.stickyFocusComplete)), refs.stickyFocusResetLayout.addEventListener("click", resetStickyFocusLayout), refs.stickyFocusManage.addEventListener("click", openStickyNotes), refs.stickyFocusUnpin.addEventListener("click", unpinStickyFocus), window.addEventListener("resize", debounce(() => {
    applyStickyFocusLayout(), applyStickySideTabLayout()
  }, 120)), refs.stickyNoteDetails.addEventListener("input", autoFitStickyDetailsInput), refs.workDiaryButton.addEventListener("click", openWorkDiary), refs.diaryEntryForm.addEventListener("submit", saveDiaryEntry), refs.cancelDiaryEditButton.addEventListener("click", resetDiaryForm), refs.diaryEntryList.addEventListener("click", handleDiaryAction), refs.diarySearch.addEventListener("input", debounce(renderDiaryEntries, 120)), [refs.diaryMonthFilter, refs.diaryCategoryFilter, refs.diarySourceFilter, refs.diaryRecentLimit].forEach(e => e.addEventListener("change", renderDiaryEntries)), refs.clearDiaryFiltersButton.addEventListener("click", clearDiaryFilters), document.querySelectorAll("[data-diary-view]").forEach(e => e.addEventListener("click", () => {
    state.diaryView = e.dataset.diaryView, renderDiaryEntries()
  })), refs.fileRegisterButton.addEventListener("click", openFileRegister), refs.fileRecordForm.addEventListener("submit", saveFileRecord), refs.cancelFileRecordEditButton.addEventListener("click", resetFileRecordForm), refs.fileRecordList.addEventListener("click", handleFileRecordAction), refs.fileRecordSearch.addEventListener("input", debounce(renderFileRecords, 120)), refs.fileRecordStatusFilter.addEventListener("change", renderFileRecords), refs.clearFileRecordSearchButton.addEventListener("click", () => {
    refs.fileRecordSearch.value = "", refs.fileRecordStatusFilter.value = "", renderFileRecords()
  }), refs.manageColumnsButton.addEventListener("click", openColumnManager), refs.columnManagerForm.addEventListener("submit", addCustomColumn), refs.customColumnList.addEventListener("click", handleColumnManagerAction), refs.customizeStatsButton.addEventListener("click", openStatCardDialog), refs.statCardOptions.addEventListener("change", handleStatCardToggle), refs.resetStatCardsButton.addEventListener("click", resetStatCardSelection), refs.reportsButton.addEventListener("click", openReports), refs.reportForm.addEventListener("submit", generateReport), refs.reportType.addEventListener("change", updateReportControls), refs.reportResetButton.addEventListener("click", () => resetReportForm(!0)), refs.reportExportButton.addEventListener("click", exportReportCsv), refs.reportPrintButton.addEventListener("click", printReport), refs.reportPrintColumnsOptions && refs.reportPrintColumnsOptions.addEventListener("change", handleReportPrintColumnsChange), refs.reportPrintColumnsSelectAll && refs.reportPrintColumnsSelectAll.addEventListener("click", selectAllReportPrintColumns), refs.reportPrintColumnsReset && refs.reportPrintColumnsReset.addEventListener("click", resetReportPrintColumns), refs.resetReportColumnWidthsButton && refs.resetReportColumnWidthsButton.addEventListener("click", resetAllReportColumnWidths), refs.reportHeaderNote && (refs.reportHeaderNote.addEventListener("input", updateReportHeaderFooterDisplay), refs.reportFooterNote.addEventListener("input", updateReportHeaderFooterDisplay), refs.reportFooterSignatures.addEventListener("change", updateReportHeaderFooterDisplay), refs.reportFooterRepeat.addEventListener("change", updateReportHeaderFooterDisplay), refs.reportShowHeading.addEventListener("change", updateReportHeaderFooterDisplay), initReportHeaderFooterFields()), refs.reportOrientationLandscape && (refs.reportOrientationLandscape.addEventListener("change", handleReportOrientationChange), refs.reportOrientationPortrait.addEventListener("change", handleReportOrientationChange), initReportOrientationField()), refs.reportColumnAlignment && (refs.reportColumnAlignment.addEventListener("change", handleReportAlignmentChange), initReportAlignmentField()), document.querySelectorAll("[data-report-preset]").forEach(e => e.addEventListener("click", applyReportPreset)), window.addEventListener("afterprint", () => document.body.classList.remove("printing-report")), refs.employeeForm.addEventListener("submit", saveEmployee), refs.fieldDoB.addEventListener("change", updateCalculatedFields), refs.fieldStrengthStatus.addEventListener("change", updateStrengthDateState), refs.customEmployeeFields.addEventListener("input", handleCustomEmployeeFieldInput), refs.pendingWorkItemList.addEventListener("change", updateMoveCompletedWorkButton), refs.pendingWorkArchiveButton.addEventListener("click", openPendingWorkArchive), refs.moveCompletedWorkButton.addEventListener("click", moveSelectedWorkToCompleted), refs.inlineWorkItemList.addEventListener("change", updateInlineMoveWorkButton), refs.inlineMoveWorkButton.addEventListener("click", moveInlineSelectedWork), refs.inlineWorkDialog.addEventListener("close", () => {
    state.inlineWorkTargetCode = ""
  }), refs.changePasswordButton.addEventListener("click", () => refs.passwordDialog.showModal()), refs.administrationButton.addEventListener("click", openAdministrationSettings), refs.securitySettingsForm.addEventListener("submit", saveSecuritySettings), refs.staySignedInButton.addEventListener("click", staySignedIn), refs.warningSignOutButton.addEventListener("click", () => performLogout("You have been signed out.")), refs.sessionWarningDialog.addEventListener("cancel", e => e.preventDefault()), refs.detailsEditButton.addEventListener("click", editSelectedEmployee), refs.fieldFilterOptions.addEventListener("change", updateFieldFilterPickerSummary), refs.applyFieldFilter.addEventListener("click", applyParticularFieldFilter), refs.clearFieldFilter.addEventListener("click", resetParticularFieldFilter), refs.passwordForm.addEventListener("submit", changePassword), document.querySelectorAll("[data-close-dialog]").forEach(e => {
    e.addEventListener("click", () => $(e.dataset.closeDialog).close())
  }), document.addEventListener("keydown", handleKeyboardShortcut), refs.tableBody.addEventListener("click", handleTableAction), refs.tableBody.addEventListener("keydown", handleTableKeydown), refs.tableBody.addEventListener("change", handleInlineFieldChange), refs.tableBody.addEventListener("input", handleInlineLongTextResize), refs.tableHead.addEventListener("input", handleHeaderLabelInput), buildTableHeader(), updateSavedViewsButton(), renderVersionLabels(), scheduleBackendVersionProbe(), state.token ? restoreSession() : showLogin()
}

function clearAuthSessionStorage() {
  AUTH_SESSION_KEYS.forEach(e => sessionStorage.removeItem(e))
}

function normalizeSessionTimeoutMinutes(e, t = 5) {
  const r = Number(e);
  return SESSION_ALLOWED_TIMEOUT_MINUTES.includes(r) ? r : t
}

function sessionIdleTimeoutMs() {
  return 60 * normalizeSessionTimeoutMinutes(state.sessionTimeoutMinutes) * 1e3
}

function applySessionTimeoutResponse(e, t = !0) {
  const r = e && SESSION_ALLOWED_TIMEOUT_MINUTES.includes(Number(e.sessionTimeoutMinutes));
  return state.sessionTimeoutMinutes = r ? Number(e.sessionTimeoutMinutes) : t ? 5 : state.sessionTimeoutMinutes, state.token && sessionStorage.setItem(SESSION_TIMEOUT_STORAGE_KEY, String(state.sessionTimeoutMinutes)), updateSessionSecurityText(), state.sessionTimeoutMinutes
}

function updateSessionSecurityText() {
  const e = normalizeSessionTimeoutMinutes(state.sessionTimeoutMinutes);
  refs.loginSessionSecurityNote && (refs.loginSessionSecurityNote.textContent = `🔐 Automatic sign-out after ${e} minutes of inactivity or after leaving/closing the dashboard.`), refs.currentSessionTimeout && (refs.currentSessionTimeout.textContent = `${e} minutes`), refs.sessionTimeoutMinutes && (refs.sessionTimeoutMinutes.value = String(e))
}

function repairStoredSession() {
  const e = Date.now(),
    t = state.token;
  let r = !1;
  try {
    r = Boolean(localStorage.getItem(SESSION_EXIT_MARKER_KEY))
  } catch {}
  const s = Number(sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || 0),
    o = Boolean(state.token) && (!s || e - s >= sessionIdleTimeoutMs()),
    i = Boolean(state.token) && r;
  try {
    localStorage.removeItem(SESSION_EXIT_MARKER_KEY)
  } catch {}
  return o || i ? (clearAuthSessionStorage(), state.token = "", state.role = "", state.displayName = "", state.username = "", t) : (state.token || (clearAuthSessionStorage(), state.role = "", state.displayName = "", state.username = ""), "")
}

function initialiseSessionSecurity(e) {
  e && sendLogoutBeacon(e), ["pointerdown", "keydown", "touchstart", "wheel"].forEach(e => {
    window.addEventListener(e, recordSessionActivity, {
      passive: !0
    })
  }), window.addEventListener("scroll", recordSessionActivity, {
    passive: !0,
    capture: !0
  }), document.addEventListener("visibilitychange", () => {
    document.hidden || checkSessionActivity()
  }), window.addEventListener("pagehide", markDashboardPageExit), window.addEventListener("pageshow", e => {
    e.persisted && state.token && performLogout("For your security, please sign in again after returning to the dashboard.")
  }), updateSessionSecurityText()
}

function recordSessionActivity(e) {
  if (!state.token || refs.dashboardView.hidden) return;
  if (e && !1 === e.isTrusted) return;
  if (refs.sessionWarningDialog && refs.sessionWarningDialog.open) return;
  const t = Date.now();
  t - state.sessionLastActivityWrite < 1e3 || (state.sessionLastActivityWrite = t, sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(t)), clearSessionWarning(), armSessionIdleTimer(), scheduleSessionHeartbeat(t))
}

function scheduleSessionHeartbeat(e = Date.now()) {
  if (clearTimeout(state.sessionHeartbeatTimer), !state.token) return;
  const t = Math.max(0, 12e4 - (e - state.sessionLastHeartbeat));
  state.sessionHeartbeatTimer = window.setTimeout(sendSessionHeartbeat, t)
}
async function sendSessionHeartbeat() {
  if (state.sessionHeartbeatTimer = 0, state.token && !refs.dashboardView.hidden) try {
    const e = await apiRequest("ping", {});
    state.sessionLastHeartbeat = Date.now(), applySessionTimeoutResponse(e), armSessionIdleTimer()
  } catch {}
}

function armSessionIdleTimer() {
  if (clearTimeout(state.sessionIdleTimer), clearTimeout(state.sessionWarningTimer), !state.token) return;
  const e = Number(sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || 0),
    t = Math.max(0, sessionIdleTimeoutMs() - (Date.now() - e)),
    r = t - 6e4;
  r <= 0 && t > 0 ? showSessionWarning() : r > 0 && (state.sessionWarningTimer = window.setTimeout(showSessionWarning, r + 20)), state.sessionIdleTimer = window.setTimeout(checkSessionActivity, t + 50)
}

function checkSessionActivity() {
  if (!state.token) return;
  const e = Number(sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || 0);
  !e || Date.now() - e >= sessionIdleTimeoutMs() ? performLogout(`You were signed out automatically after ${normalizeSessionTimeoutMinutes(state.sessionTimeoutMinutes)} minutes of inactivity.`) : armSessionIdleTimer()
}

function showSessionWarning() {
  if (!state.token || refs.dashboardView.hidden) return;
  const e = Number(sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || 0),
    t = sessionIdleTimeoutMs() - (Date.now() - e);
  !e || t <= 0 ? checkSessionActivity() : t > 61e3 ? armSessionIdleTimer() : (updateSessionWarningCountdown(), refs.sessionWarningDialog.open || refs.sessionWarningDialog.showModal(), clearInterval(state.sessionWarningCountdownTimer), state.sessionWarningCountdownTimer = window.setInterval(updateSessionWarningCountdown, 1e3))
}

function updateSessionWarningCountdown() {
  const e = Number(sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || 0),
    t = Math.max(0, Math.ceil((sessionIdleTimeoutMs() - (Date.now() - e)) / 1e3)),
    r = String(t % 60).padStart(2, "0");
  refs.sessionWarningCountdown.textContent = `${Math.floor(t/60)}:${r}`, refs.sessionWarningMessage.textContent = `Your ${normalizeSessionTimeoutMinutes(state.sessionTimeoutMinutes)}-minute inactivity limit is almost reached.`, t <= 0 && checkSessionActivity()
}

function clearSessionWarning() {
  clearInterval(state.sessionWarningCountdownTimer), state.sessionWarningCountdownTimer = 0, refs.sessionWarningDialog && refs.sessionWarningDialog.open && refs.sessionWarningDialog.close()
}
async function staySignedIn() {
  if (state.token) {
    setButtonBusy(refs.staySignedInButton, !0, "Checking…");
    try {
      applySessionTimeoutResponse(await apiRequest("ping", {}));
      const e = Date.now();
      state.sessionLastActivityWrite = e, state.sessionLastHeartbeat = e, sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(e)), clearSessionWarning(), armSessionIdleTimer(), showToast("Session continued.")
    } catch (e) {
      "SESSION_EXPIRED" !== e.code && showToast(friendlyError(e), !0)
    } finally {
      setButtonBusy(refs.staySignedInButton, !1, "Stay signed in")
    }
  }
}

function markDashboardPageExit() {
  if (state.token) {
    try {
      localStorage.setItem(SESSION_EXIT_MARKER_KEY, String(Date.now()))
    } catch {}
    sendLogoutBeacon(state.token)
  }
}

function sendLogoutBeacon(e) {
  if (e && isApiConfigured() && navigator.sendBeacon) try {
    const t = `logout_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      r = JSON.stringify({
        action: "logout",
        data: {},
        token: e,
        requestId: t,
        origin: location.origin
      });
    navigator.sendBeacon(CONFIG.API_URL, new URLSearchParams({
      payload: r
    }))
  } catch {}
}

function renderVersionLabels() {
  const e = `v${CONFIG.FRONTEND_VERSION}`,
    t = state.backendVersion ? `v${state.backendVersion}` : "Not connected";
  refs.loginFrontendVersion && (refs.loginFrontendVersion.textContent = e), refs.dashboardFrontendVersion && (refs.dashboardFrontendVersion.textContent = e), refs.loginBackendVersion && (refs.loginBackendVersion.textContent = t), refs.dashboardBackendVersion && (refs.dashboardBackendVersion.textContent = t)
}

function readCachedBackendVersion() {
  try {
    const e = JSON.parse(localStorage.getItem(BACKEND_VERSION_CACHE_KEY) || "null");
    return !e || !e.version || Date.now() - Number(e.savedAt || 0) > 216e5 ? "" : String(e.version).trim()
  } catch {
    return ""
  }
}

function cacheBackendVersion(e) {
  const t = String(e || "").trim();
  if (t) try {
    localStorage.setItem(BACKEND_VERSION_CACHE_KEY, JSON.stringify({
      version: t,
      savedAt: Date.now()
    }))
  } catch {}
}

function cancelBackendVersionProbe() {
  state.backendProbeTimer && (window.clearTimeout(state.backendProbeTimer), state.backendProbeTimer = 0)
}

function scheduleBackendVersionProbe() {
  isApiConfigured() && !state.token && (cancelBackendVersionProbe(), state.backendProbeTimer = window.setTimeout(() => {
    state.backendProbeTimer = 0, probeBackendVersion()
  }, 1800))
}
async function probeBackendVersion() {
  if (isApiConfigured()) {
    try {
      const e = await apiRequest("getVersion", {}, !1);
      state.backendVersion = String(e.version || "").trim(), cacheBackendVersion(state.backendVersion), applySessionTimeoutResponse(e)
    } catch {
      state.backendVersion = "", applySessionTimeoutResponse(null)
    }
    renderVersionLabels()
  } else renderVersionLabels()
}

function togglePasswordVisibility() {
  const e = "password" === refs.password.type;
  refs.password.type = e ? "text" : "password", refs.togglePassword.textContent = e ? "Hide" : "Show", refs.togglePassword.setAttribute("aria-label", e ? "Hide password" : "Show password")
}
async function handleLogin(e) {
  e.preventDefault(), refs.loginError.textContent = "";
  const t = refs.username.value.trim(),
    r = refs.password.value;
  if (t && r)
    if (isApiConfigured()) {
      cancelBackendVersionProbe(), setButtonBusy(refs.loginButton, !0, "Signing in…");
      try {
        const e = await apiRequest("login", {
          username: t,
          password: r,
          bootstrap: !0
        }, !1);
        state.token = e.token, state.role = e.role, state.displayName = e.displayName, state.username = e.username, state.backendVersion = String(e.version || state.backendVersion || "").trim(), applySessionTimeoutResponse(e), cacheBackendVersion(state.backendVersion), state.sessionLastHeartbeat = Date.now(), renderVersionLabels(), sessionStorage.setItem("hrSessionToken", state.token), sessionStorage.setItem("hrRole", state.role), sessionStorage.setItem("hrDisplayName", state.displayName), sessionStorage.setItem("hrUsername", state.username), sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now())), sessionStorage.setItem(SESSION_TIMEOUT_STORAGE_KEY, String(state.sessionTimeoutMinutes)), refs.rememberUsername.checked ? localStorage.setItem("hrRememberedUsername", t) : localStorage.removeItem("hrRememberedUsername"), refs.password.value = "", showDashboard(), e.bootstrap && Array.isArray(e.bootstrap.employees) ? applyEmployeePayload(e.bootstrap, {
          refreshed: !1,
          announce: !1
        }) : await loadEmployees()
      } catch (e) {
        refs.dashboardView.hidden && (refs.loginError.textContent = friendlyError(e))
      } finally {
        setButtonBusy(refs.loginButton, !1, "Sign in securely"), state.token || scheduleBackendVersionProbe()
      }
    } else refs.loginError.textContent = "Connect the Google Apps Script URL in app.js before signing in."
}
async function restoreSession() {
  showDashboard();
  try {
    await loadEmployees()
  } catch (e) {
    "SESSION_EXPIRED" === e.code && (clearSession(), showLogin(), refs.loginError.textContent = "Your session expired. Please sign in again.")
  }
}

function showDashboard() {
  refs.loginView.hidden = !0, refs.dashboardView.hidden = !1, refs.stickySideTab.hidden = Boolean(state.stickyFocusId), refs.changePasswordButton.hidden = !1, refs.displayName.textContent = state.displayName || state.username || "User", refs.roleLabel.textContent = "admin" === state.role ? "Administrator access" : "View-only access", refs.userInitial.textContent = (state.displayName || state.username || "U").charAt(0).toUpperCase(), renderVersionLabels(), updateSessionSecurityText(), applyStickySideTabLayout(), document.querySelectorAll(".admin-only").forEach(e => {
    e.hidden = "admin" !== state.role
  }), "admin" === state.role ? state.directEditEnabled = !0 : (state.directEditEnabled = !1, state.headerEditEnabled = !1, state.inlineEditCode = "", state.headerLabelsDirty = !1), updateDirectEditButton(), updateHeaderEditButtons(), recordSessionActivity(), armSessionIdleTimer()
}

function showLogin() {
  clearTimeout(state.sessionIdleTimer), clearTimeout(state.sessionWarningTimer), clearTimeout(state.sessionHeartbeatTimer), clearSessionWarning(), state.sessionIdleTimer = 0, state.sessionWarningTimer = 0, state.sessionHeartbeatTimer = 0, state.token || clearAuthSessionStorage(), refs.loginView.hidden = !1, refs.dashboardView.hidden = !0, refs.changePasswordButton.hidden = !0, refs.stickyFocusNote.hidden = !0, refs.stickySideTab.hidden = !0, updateSessionSecurityText(), scheduleBackendVersionProbe(), setTimeout(() => refs.username.focus(), 20)
}
async function logout() {
  return performLogout("You have been signed out.")
}
async function performLogout(e) {
  if (state.logoutInProgress) return;
  state.logoutInProgress = !0;
  const t = state.token;
  clearSession(), state.employees = [], state.filtered = [], state.stickyNotes = [], state.namedFilterViews = [], showLogin(), refs.loginError.textContent = e && e.includes("automatically") ? e : "", showToast(e || "You have been signed out."), sendLogoutBeacon(t), state.logoutInProgress = !1
}

function clearSession() {
  clearTimeout(state.sessionIdleTimer), clearTimeout(state.sessionWarningTimer), clearTimeout(state.sessionHeartbeatTimer), clearTimeout(state.stickyNotesLoadTimer), clearTimeout(state.filterViewsLoadTimer), clearSessionWarning(), state.sessionIdleTimer = 0, state.sessionWarningTimer = 0, state.sessionHeartbeatTimer = 0, state.stickyNotesLoadTimer = 0, state.filterViewsLoadTimer = 0, clearAuthSessionStorage();
  try {
    localStorage.removeItem(SESSION_EXIT_MARKER_KEY)
  } catch {}
  state.token = "", state.role = "", state.displayName = "", state.username = "", state.sessionTimeoutMinutes = 5, state.directEditEnabled = !1, state.headerEditEnabled = !1, state.inlineEditCode = "", state.headerLabelsDirty = !1
}
async function loadEmployees(e, t = !0) {
  showLoading(e ? "Refreshing employee records…" : "Loading employee records…");
  try {
    applyEmployeePayload(await apiRequest("getEmployees", {
      force: Boolean(e)
    }), {
      refreshed: Boolean(e),
      announce: Boolean(e)
    })
  } catch (e) {
    if (t && "SESSION_EXPIRED" !== e.code) return refs.lastUpdated.textContent = "Retrying data…", await new Promise(e => setTimeout(e, 180)), loadEmployees(!0, !1);
    throw refs.lastUpdated.textContent = "Data load failed", showEmployeeLoadStatus("Employee data could not be loaded", `${friendlyError(e)}${e.code?` (Error: ${e.code})`:""}`, !0), showToast(friendlyError(e), !0), e
  } finally {
    hideLoading()
  }
}

function applyEmployeePayload(e, t = {}) {
  if (!Array.isArray(e && e.employees)) throw Object.assign(new Error("The backend response did not contain an employee list."), {
    code: "INVALID_RESPONSE"
  });
  state.employees = e.employees, state.columns = Array.isArray(e.columns) && e.columns.length ? e.columns.map(String) : CORE_COLUMNS.slice(), state.customColumns = Array.isArray(e.customColumns) ? e.customColumns.filter(e => e && e.key).map(e => ({
    key: String(e.key),
    label: String(e.label || e.key)
  })) : [], state.backendVersion = String(e.version || state.backendVersion || "").trim(), applySessionTimeoutResponse(e), cacheBackendVersion(state.backendVersion), renderVersionLabels(), state.columnLabels = Object.assign({}, DEFAULT_COLUMN_LABELS, e.columnLabels || {}), state.headerLabelsDirty = !1, state.page = 1, rebuildEmployeeSearchIndex(), syncDashboardColumnPreference(), populateFilters(), restoreDashboardFilterPreference(), populateFieldFilterColumns(), applyFilters(), refs.lastUpdated.textContent = "Updated " + new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date), state.employees.length ? hideEmployeeLoadStatus() : showEmployeeLoadStatus("No employee records returned", "The backend connected successfully but returned 0 rows. Check that the Employees sheet still contains data below its heading row, then choose Retry loading data.", !1), versionAtLeast(state.backendVersion, CONFIG.REQUIRED_BACKEND_VERSION) || state.backendMismatchNotified || (state.backendMismatchNotified = !0, showToast(`Backend update incomplete${state.backendVersion?` (currently v${state.backendVersion})`:""}. Deploy Code.gs v${CONFIG.REQUIRED_BACKEND_VERSION} as a new version.`, !0)), t.announce && t.refreshed && state.employees.length && showToast("Employee data refreshed."), scheduleStickyNotesLoad(), scheduleFilterViewsLoad()
}

function rebuildEmployeeSearchIndex() {
  state.employeeSearchIndex = new WeakMap, state.employees.forEach(e => {
    const t = state.columns.map(t => e[t] || "").concat(strengthStatus(e), sensitivityStatus(e)).join(" ").toLocaleLowerCase();
    state.employeeSearchIndex.set(e, t)
  })
}

function scheduleStickyNotesLoad() {
  clearTimeout(state.stickyNotesLoadTimer), state.stickyNotesLoadTimer = window.setTimeout(() => {
    state.stickyNotesLoadTimer = 0, loadStickyNotes().catch(() => {})
  }, 240)
}

function showEmployeeLoadStatus(e, t, r) {
  refs.dataLoadStatus.hidden = !1, refs.dataLoadStatus.classList.toggle("error", Boolean(r)), refs.dataLoadStatusTitle.textContent = e, refs.dataLoadStatusMessage.textContent = t
}

function hideEmployeeLoadStatus() {
  refs.dataLoadStatus.hidden = !0, refs.dataLoadStatus.classList.remove("error"), refs.dataLoadStatusTitle.textContent = "Employee data status", refs.dataLoadStatusMessage.textContent = ""
}

function buildTableHeader() {
  refs.tableHead.innerHTML = "", visibleTableColumns().concat("Actions").forEach(e => {
    const t = document.createElement("th");
    if (t.dataset.columnKey = e, "Actions" === e) t.className = "admin-column", t.hidden = "admin" !== state.role, t.textContent = state.directEditEnabled ? "Edit / Actions" : "Actions";
    else if (state.headerEditEnabled && "admin" === state.role) {
      t.className = "direct-edit-header";
      const r = document.createElement("input");
      r.className = "header-edit-input", r.type = "text", r.maxLength = 60, r.required = !0, r.value = columnLabel(e), r.dataset.headerKey = e, r.setAttribute("aria-label", `Visible header name for ${e}`), r.title = `Edit the visible name for ${e}. The protected data key will remain unchanged.`, t.appendChild(r)
    } else {
      const r = document.createElement("span");
      r.className = "column-sort-label", r.textContent = columnLabel(e);
      const s = document.createElement("span"),
        o = state.sortColumn === e;
      s.className = "column-sort-arrow" + (o ? " active" : ""), s.textContent = o ? "asc" === state.sortDirection ? "↑" : "↓" : "↕", s.setAttribute("aria-hidden", "true"), t.append(r, s), t.classList.add("sortable-header"), t.tabIndex = 0, t.setAttribute("role", "button"), t.setAttribute("aria-sort", o ? "asc" === state.sortDirection ? "ascending" : "descending" : "none"), t.setAttribute("aria-label", `${columnLabel(e)}. ${o?`Currently ${"asc"===state.sortDirection?"ascending":"descending"}. Activate to reverse order.`:"Activate to sort."}`), t.title = o ? `Sorted ${"asc"===state.sortDirection?"ascending":"descending"}. Click to reverse order.` : "Sort by " + columnLabel(e), t.addEventListener("click", () => sortBy(e)), t.addEventListener("keydown", t => {
        "Enter" === t.key && sortBy(e)
      })
    }
    const r = columnVisualClass(e);
    r && t.classList.add(r), isLongDashboardTextColumn(e) && t.classList.add("long-text-dashboard-column"), "Actions" !== e && addColumnResizeHandle(t, e), refs.tableHead.appendChild(t)
  }), updateResetColumnWidthsButton()
}

function readSavedColumnWidths() {
  try {
    const e = JSON.parse(localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY) || "{}");
    return !e || "object" != typeof e || Array.isArray(e) ? {} : Object.fromEntries(Object.entries(e).filter(([, e]) => Number.isFinite(Number(e))))
  } catch {
    return {}
  }
}

function saveColumnWidth(e, t) {
  const r = readSavedColumnWidths();
  r[e] = Math.round(t), localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(r)), updateResetColumnWidthsButton()
}

function setColumnWidth(e, t) {
  const r = Math.max(48, Math.min(480, Math.round(Number(t) || 48)));
  return refs.employeeTable.querySelectorAll("[data-column-key]").forEach(t => {
    t.dataset.columnKey === e && (t.style.width = `${r}px`, t.style.minWidth = `${r}px`, t.style.maxWidth = `${r}px`)
  }), "Sl No." === e && refs.employeeTable.classList.contains("has-frozen-serial") && refs.employeeTable.style.setProperty("--frozen-name-left", `${r}px`), r
}

function applySavedColumnWidths() {
  refs.employeeTable.style.removeProperty("--frozen-name-left");
  const e = readSavedColumnWidths();
  Object.entries(e).forEach(([e, t]) => setColumnWidth(e, t)), updateResetColumnWidthsButton()
}

function addColumnResizeHandle(e, t) {
  e.classList.add("resizable-column-header");
  const r = document.createElement("span");
  r.className = "column-resize-handle", r.dataset.resizeColumn = t, r.tabIndex = 0, r.setAttribute("role", "separator"), r.setAttribute("aria-orientation", "vertical"), r.setAttribute("aria-label", `Resize ${columnLabel(t)} column`), r.title = "Drag to resize. Use Left/Right arrow for fine adjustment. Double-click to reset this column.", r.addEventListener("pointerdown", startColumnResize), r.addEventListener("keydown", resizeColumnWithKeyboard), r.addEventListener("click", e => e.stopPropagation()), r.addEventListener("dblclick", e => {
    e.preventDefault(), e.stopPropagation(), resetOneColumnWidth(t)
  }), e.appendChild(r)
}

function startColumnResize(e) {
  if (0 !== e.button && "touch" !== e.pointerType) return;
  e.preventDefault(), e.stopPropagation();
  const t = e.currentTarget,
    r = t.closest("th"),
    s = t.dataset.resizeColumn,
    o = e.clientX,
    i = r.getBoundingClientRect().width;
  let n = i;
  document.body.classList.add("resizing-column");
  const a = e => {
      e.preventDefault(), n = setColumnWidth(s, i + e.clientX - o)
    },
    l = () => {
      document.removeEventListener("pointermove", a), document.removeEventListener("pointerup", l), document.removeEventListener("pointercancel", l), document.body.classList.remove("resizing-column"), saveColumnWidth(s, n), showToast(`${columnLabel(s)} width saved.`)
    };
  document.addEventListener("pointermove", a, {
    passive: !1
  }), document.addEventListener("pointerup", l, {
    once: !0
  }), document.addEventListener("pointercancel", l, {
    once: !0
  })
}

function resizeColumnWithKeyboard(e) {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  e.preventDefault(), e.stopPropagation();
  const t = e.currentTarget.dataset.resizeColumn,
    r = e.currentTarget.closest("th"),
    s = e.shiftKey ? 25 : 10,
    o = "ArrowRight" === e.key ? 1 : -1;
  saveColumnWidth(t, setColumnWidth(t, r.getBoundingClientRect().width + o * s))
}

function resetOneColumnWidth(e) {
  const t = readSavedColumnWidths();
  delete t[e], localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(t)), renderTable(), showToast(`${columnLabel(e)} width reset.`)
}

function resetAllColumnWidths() {
  localStorage.removeItem(COLUMN_WIDTH_STORAGE_KEY), refs.employeeTable.style.removeProperty("--frozen-name-left"), renderTable(), showToast("Original dashboard column widths restored.")
}

function updateResetColumnWidthsButton() {
  refs.resetColumnWidthsButton && (refs.resetColumnWidthsButton.disabled = 0 === Object.keys(readSavedColumnWidths()).length)
}

function setupReportColumnResizeHandles() {
  refs.reportTableHead && refs.reportTableHead.querySelectorAll("th[data-report-column-key]").forEach(e => {
    e.classList.add("resizable-column-header");
    const t = e.dataset.reportColumnKey,
      r = document.createElement("span");
    r.className = "column-resize-handle", r.dataset.resizeReportColumn = t, r.tabIndex = 0, r.setAttribute("role", "separator"), r.setAttribute("aria-orientation", "vertical"), r.setAttribute("aria-label", `Resize ${columnLabel(t)} print column`), r.title = "Drag to adjust this column's width for the printed report. Use Left/Right arrow for fine adjustment. Double-click to reset.", r.addEventListener("pointerdown", startReportColumnResize), r.addEventListener("keydown", resizeReportColumnWithKeyboard), r.addEventListener("click", e => e.stopPropagation()), r.addEventListener("dblclick", e => {
      e.preventDefault(), e.stopPropagation(), resetOneReportColumnWidth(t)
    }), e.appendChild(r)
  })
}

function startReportColumnResize(e) {
  if (0 !== e.button && "touch" !== e.pointerType) return;
  e.preventDefault(), e.stopPropagation();
  const t = e.currentTarget,
    r = t.closest("th"),
    s = t.dataset.resizeReportColumn,
    o = e.clientX,
    i = r.getBoundingClientRect().width;
  let n = i;
  document.body.classList.add("resizing-column");
  const a = e => {
      e.preventDefault(), n = setReportColumnWidth(s, i + e.clientX - o)
    },
    l = () => {
      document.removeEventListener("pointermove", a), document.removeEventListener("pointerup", l), document.removeEventListener("pointercancel", l), document.body.classList.remove("resizing-column"), saveReportColumnWidth(s, n), showToast(`${columnLabel(s)} print width saved.`)
    };
  document.addEventListener("pointermove", a, {
    passive: !1
  }), document.addEventListener("pointerup", l, {
    once: !0
  }), document.addEventListener("pointercancel", l, {
    once: !0
  })
}

function resizeReportColumnWithKeyboard(e) {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  e.preventDefault(), e.stopPropagation();
  const t = e.currentTarget.dataset.resizeReportColumn,
    r = e.currentTarget.closest("th"),
    s = e.shiftKey ? 25 : 10,
    o = "ArrowRight" === e.key ? 1 : -1;
  saveReportColumnWidth(t, setReportColumnWidth(t, r.getBoundingClientRect().width + o * s))
}

function readSavedReportColumnWidths() {
  try {
    const e = JSON.parse(localStorage.getItem(REPORT_COLUMN_WIDTH_STORAGE_KEY) || "{}");
    return !e || "object" != typeof e || Array.isArray(e) ? {} : Object.fromEntries(Object.entries(e).filter(([, e]) => Number.isFinite(Number(e))))
  } catch {
    return {}
  }
}

function saveReportColumnWidth(e, t) {
  const r = readSavedReportColumnWidths();
  r[e] = Math.round(t), localStorage.setItem(REPORT_COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(r)), updateResetReportColumnWidthsButton()
}

function setReportColumnWidth(e, t) {
  const r = Math.max(40, Math.min(480, Math.round(Number(t) || 40)));
  return refs.reportTable && refs.reportTable.querySelectorAll('[data-report-column-key]').forEach(t => {
    t.dataset.reportColumnKey === e && (t.style.width = `${r}px`, t.style.minWidth = `${r}px`, t.style.maxWidth = `${r}px`)
  }), r
}

function applySavedReportColumnWidths() {
  const e = readSavedReportColumnWidths();
  Object.entries(e).forEach(([e, t]) => setReportColumnWidth(e, t)), updateResetReportColumnWidthsButton()
}

function resetOneReportColumnWidth(e) {
  const t = readSavedReportColumnWidths();
  delete t[e], localStorage.setItem(REPORT_COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(t)), generateReport(), showToast(`${columnLabel(e)} print width reset.`)
}

function resetAllReportColumnWidths() {
  localStorage.removeItem(REPORT_COLUMN_WIDTH_STORAGE_KEY), generateReport(), showToast("Original print column widths restored.")
}

function updateResetReportColumnWidthsButton() {
  refs.resetReportColumnWidthsButton && (refs.resetReportColumnWidthsButton.disabled = 0 === Object.keys(readSavedReportColumnWidths()).length)
}

function readReportHeaderFooterPrefs() {
  try {
    const e = JSON.parse(localStorage.getItem(REPORT_HEADER_FOOTER_STORAGE_KEY) || "{}");
    return {
      headerNote: "string" == typeof e.headerNote ? e.headerNote.slice(0, 140) : "",
      footerNote: "string" == typeof e.footerNote ? e.footerNote.slice(0, 140) : "",
      signatures: Boolean(e.signatures),
      repeat: !1 !== e.repeat,
      showHeading: !1 !== e.showHeading
    }
  } catch {
    return {
      headerNote: "",
      footerNote: "",
      signatures: !1,
      repeat: !0,
      showHeading: !0
    }
  }
}

function saveReportHeaderFooterPrefs() {
  try {
    localStorage.setItem(REPORT_HEADER_FOOTER_STORAGE_KEY, JSON.stringify({
      headerNote: refs.reportHeaderNote.value.trim().slice(0, 140),
      footerNote: refs.reportFooterNote.value.trim().slice(0, 140),
      signatures: refs.reportFooterSignatures.checked,
      repeat: refs.reportFooterRepeat.checked,
      showHeading: refs.reportShowHeading.checked
    }))
  } catch {}
}

function initReportHeaderFooterFields() {
  if (!refs.reportHeaderNote) return;
  const e = readReportHeaderFooterPrefs();
  refs.reportHeaderNote.value = e.headerNote, refs.reportFooterNote.value = e.footerNote, refs.reportFooterSignatures.checked = e.signatures, refs.reportFooterRepeat.checked = e.repeat, refs.reportShowHeading.checked = e.showHeading, updateReportHeaderFooterDisplay()
}

function updateReportHeaderFooterDisplay() {
  if (!refs.reportHeaderNote) return;
  const e = refs.reportHeaderNote.value.trim(),
    t = refs.reportFooterNote.value.trim(),
    r = refs.reportFooterSignatures.checked,
    s = refs.reportFooterRepeat.checked,
    i = refs.reportShowHeading.checked;
  refs.reportHeaderNoteDisplay.hidden = !e, refs.reportHeaderNoteDisplay.textContent = e, refs.reportFooterNoteDisplay.hidden = !t, refs.reportFooterNoteDisplay.textContent = t, refs.reportSignatureBlock.hidden = !r, refs.reportPrintHeading.hidden = !i;
  const o = Boolean(e) || Boolean(t) || r;
  refs.reportPrintFooter.hidden = !o, refs.reportPrintFooter.classList.toggle("report-footer-repeat", s), saveReportHeaderFooterPrefs()
}

function readReportOrientationPref() {
  try {
    const e = localStorage.getItem(REPORT_ORIENTATION_STORAGE_KEY);
    return "portrait" === e ? "portrait" : "landscape"
  } catch {
    return "landscape"
  }
}

function saveReportOrientationPref(e) {
  try {
    localStorage.setItem(REPORT_ORIENTATION_STORAGE_KEY, e)
  } catch {}
}

function currentReportOrientation() {
  return refs.reportOrientationPortrait && refs.reportOrientationPortrait.checked ? "portrait" : "landscape"
}

function applyPrintOrientation() {
  const e = currentReportOrientation();
  let t = document.getElementById("printOrientationStyle");
  t || (t = document.createElement("style"), t.id = "printOrientationStyle", document.head.appendChild(t)), t.textContent = `@media print{@page{size:A4 ${e};margin:10mm}}`
}

function handleReportOrientationChange() {
  saveReportOrientationPref(currentReportOrientation()), applyPrintOrientation()
}

function initReportOrientationField() {
  if (!refs.reportOrientationLandscape) return;
  const e = readReportOrientationPref();
  refs.reportOrientationLandscape.checked = "landscape" === e, refs.reportOrientationPortrait.checked = "portrait" === e, applyPrintOrientation()
}

function readReportAlignmentPref() {
  try {
    const e = localStorage.getItem(REPORT_ALIGNMENT_STORAGE_KEY);
    return ["left", "center", "right"].includes(e) ? e : "auto"
  } catch {
    return "auto"
  }
}

function saveReportAlignmentPref(e) {
  try {
    localStorage.setItem(REPORT_ALIGNMENT_STORAGE_KEY, e)
  } catch {}
}

function applyReportAlignment() {
  refs.reportTable && refs.reportColumnAlignment && (refs.reportTable.classList.remove("align-left", "align-center", "align-right"), "auto" !== refs.reportColumnAlignment.value && refs.reportTable.classList.add(`align-${refs.reportColumnAlignment.value}`))
}

function handleReportAlignmentChange() {
  saveReportAlignmentPref(refs.reportColumnAlignment.value), applyReportAlignment()
}

function initReportAlignmentField() {
  if (!refs.reportColumnAlignment) return;
  refs.reportColumnAlignment.value = readReportAlignmentPref(), applyReportAlignment()
}

function columnVisualClass(e) {
  const t = String(e || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  "Actions" === e || String(columnLabel(e) || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return "employee name" === t ? "employee-name-column" : ""
}

function isLongDashboardTextColumn(e) {
  const t = String(e || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    r = String(columnLabel(e) || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return "remark admn" === t || "remark admn" === r || "remarks administration" === r || t.includes("pending work") || r.includes("pending work")
}

function visibleTableColumns() {
  const e = state.dashboardColumns.filter(e => state.columns.includes(e)),
    t = state.columns.filter(e => !isCompletedWorkHistoryColumn(e));
  return frozenColumnsFirst(e.length ? e : t)
}

function frozenColumnsFirst(e) {
  const t = ["Sl No.", "Employee Name"].filter(t => e.includes(t));
  return t.concat(e.filter(e => !t.includes(e)))
}

function readDashboardColumnPreference() {
  try {
    const e = JSON.parse(localStorage.getItem("hrDashboardColumns") || "[]");
    return Array.isArray(e) ? e.map(String) : []
  } catch {
    return []
  }
}

function saveDashboardColumnPreference() {
  try {
    localStorage.setItem("hrDashboardColumns", JSON.stringify(state.dashboardColumns))
  } catch {}
}

function readSavedManualOrders() {
  try {
    const e = JSON.parse(localStorage.getItem("hrDashboardSavedOrders") || "{}");
    return !e || "object" != typeof e || Array.isArray(e) ? {} : Object.fromEntries(Object.entries(e).filter(([, e]) => e && Array.isArray(e.codes)).map(([e, t]) => [e, {
      codes: t.codes.map(String).filter(Boolean),
      savedAt: Number(t.savedAt) || 0
    }]))
  } catch {
    return {}
  }
}

function normalizeFilterViewFromServer(e) {
  return {
    id: String(e && e.id || ""),
    name: String(e && e.name || "").trim().slice(0, 60),
    filters: e && e.filters && "object" == typeof e.filters ? e.filters : {},
    columns: Array.isArray(e && e.columns) ? e.columns.map(String) : [],
    rowOrder: Array.isArray(e && e.rowOrder) ? e.rowOrder.map(String) : [],
    savedAt: Date.parse(e && (e.updatedAt || e.createdAt) || "") || 0
  }
}

function scheduleFilterViewsLoad() {
  clearTimeout(state.filterViewsLoadTimer), state.filterViewsLoadTimer = window.setTimeout(() => {
    state.filterViewsLoadTimer = 0, loadFilterViews().catch(() => {})
  }, 240)
}

async function loadFilterViews() {
  if (!state.token) return;
  const e = await apiRequest("getFilterViews", {});
  state.namedFilterViews = Array.isArray(e.views) ? e.views.map(normalizeFilterViewFromServer) : [], renderNamedFilterViews()
}

function persistSavedManualOrders() {
  try {
    return localStorage.setItem("hrDashboardSavedOrders", JSON.stringify(state.savedManualOrders)), !0
  } catch {
    return !1
  }
}

function readDashboardFilterPreference() {
  try {
    const e = JSON.parse(localStorage.getItem("hrDashboardFilters") || "{}");
    return {
      search: String(e.search || "").slice(0, 250),
      group: String(e.group || ""),
      category: String(e.category || ""),
      status: String(e.status || ""),
      sensitivity: String(e.sensitivity || ""),
      sortColumn: String(e.sortColumn || "Sl No."),
      sortDirection: "desc" === e.sortDirection ? "desc" : "asc",
      displayColumns: Array.isArray(e.displayColumns) ? e.displayColumns.map(String) : [],
      fieldColumns: Array.isArray(e.fieldColumns) ? e.fieldColumns.map(String) : [],
      columnRules: Array.isArray(e.columnRules) ? e.columnRules.map(e => ({
        column: String(e && e.column || ""),
        operator: String(e && e.operator || "contains"),
        value: String(e && e.value || "").slice(0, 500)
      })) : []
    }
  } catch {
    return {
      search: "",
      group: "",
      category: "",
      status: "",
      sensitivity: "",
      sortColumn: "Sl No.",
      sortDirection: "asc",
      displayColumns: [],
      fieldColumns: [],
      columnRules: []
    }
  }
}

function saveDashboardFilterPreference() {
  if (refs.globalSearch) {
    state.dashboardFilterPreference = {
      search: refs.globalSearch.value.trim(),
      group: refs.groupFilter.value,
      category: refs.categoryFilter.value,
      status: refs.statusFilter.value,
      sensitivity: refs.sensitivityFilter.value,
      sortColumn: state.columns.includes(state.sortColumn) ? state.sortColumn : "Sl No.",
      sortDirection: "desc" === state.sortDirection ? "desc" : "asc",
      displayColumns: state.filterDisplayColumns.filter(e => state.columns.includes(e)),
      fieldColumns: state.fieldFilterColumns.filter(e => state.columns.includes(e)),
      columnRules: normalizeColumnFilterRules(state.columnFilterRules)
    };
    try {
      localStorage.setItem("hrDashboardFilters", JSON.stringify(state.dashboardFilterPreference))
    } catch {}
    updateChooseFiltersButton()
  }
}

function restoreDashboardFilterPreference() {
  const e = state.dashboardFilterPreference || readDashboardFilterPreference();
  refs.globalSearch.value = e.search || "", setSavedSelectValue(refs.groupFilter, e.group), setSavedSelectValue(refs.categoryFilter, e.category), setSavedSelectValue(refs.statusFilter, e.status), setSavedSelectValue(refs.sensitivityFilter, e.sensitivity), state.sortColumn = state.columns.includes(e.sortColumn) ? e.sortColumn : "Sl No.", state.sortDirection = "desc" === e.sortDirection ? "desc" : "asc";
  let t = (e.displayColumns || []).filter((e, t, r) => state.columns.includes(e) && r.indexOf(e) === t),
    r = (e.fieldColumns || []).filter((e, t, r) => state.columns.includes(e) && r.indexOf(e) === t),
    s = normalizeColumnFilterRules(e.columnRules);
  const o = s.filter(e => "show-all" === e.operator).map(e => e.column);
  s = s.filter(e => "show-all" !== e.operator), t = t.concat(o).filter((e, t, r) => state.columns.includes(e) && r.indexOf(e) === t);
  const i = state.columns.filter(e => isPendingWorkColumn(e) && !state.employees.some(t => employeeColumnFilterValue(t, e))),
    n = r.concat(s.filter(e => "filled" === e.operator).map(e => e.column)).filter((e, t, r) => i.includes(e) && r.indexOf(e) === t);
  n.length && (t = t.concat(n).filter((e, t, r) => r.indexOf(e) === t), r = r.filter(e => !n.includes(e)), s = s.filter(e => !(n.includes(e.column) && "filled" === e.operator))), state.filterDisplayColumns = [], state.fieldFilterColumns = [], state.columnFilterRules = s, updateChooseFiltersButton()
}

function isPendingWorkColumn(e) {
  const t = String(e || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    r = String(columnLabel(e) || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return t.includes("pending work") || r.includes("pending work")
}

function isCompletedWorkHistoryColumn(e) {
  const t = String(e || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    r = String(columnLabel(e) || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return "completed work history" === t || "completed work history" === r
}

function pendingWorkColumnKey() {
  return state.columns.find(e => isPendingWorkColumn(e)) || ""
}

function completedWorkHistoryColumnKey() {
  return state.columns.find(e => isCompletedWorkHistoryColumn(e)) || ""
}

function setSavedSelectValue(e, t) {
  const r = String(t || "");
  e.value = [...e.options].some(e => e.value === r) ? r : ""
}

function syncDashboardColumnPreference() {
  const e = state.dashboardColumns.filter((e, t, r) => state.columns.includes(e) && r.indexOf(e) === t),
    t = state.columns.filter(e => !isCompletedWorkHistoryColumn(e));
  state.dashboardColumns = e.length ? e : t, updateChooseColumnsButton()
}

function isDashboardColumnCustomized() {
  const e = visibleTableColumns();
  return !hasFocusedColumnFilter() && (e.length !== state.columns.length || e.some((e, t) => e !== state.columns[t]))
}

function updateChooseColumnsButton() {
  if (!refs.chooseColumnsButton) return;
  const e = state.dashboardColumns.filter(e => state.columns.includes(e)).length;
  setTwoLineActionLabel(refs.chooseColumnsButton, "Choose", e === state.columns.length ? "columns · All" : `columns · ${e}`)
}

function openDashboardColumnChooser() {
  syncDashboardColumnPreference(), renderDashboardColumnChooser(), refs.columnViewDialog.showModal()
}

function renderDashboardColumnChooser() {
  const e = new Set(state.dashboardColumns),
    t = frozenColumnsFirst(state.dashboardColumns.filter(e => state.columns.includes(e)).concat(state.columns.filter(t => !e.has(t))));
  refs.columnViewList.innerHTML = t.map((t, r) => `\n    <div class="column-view-item" data-dashboard-column="${escapeAttribute(t)}">\n      <label><input type="checkbox"${e.has(t)?" checked":""}><span>${escapeHtml(columnLabel(t))}</span></label>\n      <div class="column-order-actions"><button class="column-first-button" type="button" data-column-move="front" aria-label="Place ${escapeAttribute(columnLabel(t))} as the first data column">First</button><button type="button" data-column-move="up" aria-label="Move ${escapeAttribute(columnLabel(t))} up">↑</button><button type="button" data-column-move="down" aria-label="Move ${escapeAttribute(columnLabel(t))} down">↓</button></div>\n    </div>\n  `).join(""), refreshDashboardColumnOrderButtons(), updateDashboardColumnCount()
}

function handleDashboardColumnOrder(e) {
  const t = e.target.closest("[data-column-move]");
  if (!t) return;
  const r = t.closest("[data-dashboard-column]");
  if ("front" === t.dataset.columnMove) {
    const e = [...refs.columnViewList.children].filter(e => ["Sl No.", "Employee Name"].includes(e.dataset.dashboardColumn)).length,
      t = refs.columnViewList.children[e];
    return t !== r && refs.columnViewList.insertBefore(r, t || null), void refreshDashboardColumnOrderButtons()
  }
  const s = "up" === t.dataset.columnMove ? r.previousElementSibling : r.nextElementSibling;
  s && ("up" === t.dataset.columnMove ? refs.columnViewList.insertBefore(r, s) : refs.columnViewList.insertBefore(s, r), refreshDashboardColumnOrderButtons())
}

function refreshDashboardColumnOrderButtons() {
  const e = [...refs.columnViewList.querySelectorAll("[data-dashboard-column]")],
    t = new Set(["Sl No.", "Employee Name"]),
    r = e.filter(e => t.has(e.dataset.dashboardColumn)).length;
  e.forEach((s, o) => {
    const i = t.has(s.dataset.dashboardColumn);
    s.classList.toggle("fixed-column-order", i), s.querySelector('[data-column-move="front"]').disabled = i || o === r, s.querySelector('[data-column-move="up"]').disabled = i || o <= r, s.querySelector('[data-column-move="down"]').disabled = i || o === e.length - 1
  })
}

function selectedDashboardColumnsFromChooser() {
  return [...refs.columnViewList.querySelectorAll("[data-dashboard-column]")].filter(e => e.querySelector('input[type="checkbox"]').checked).map(e => e.dataset.dashboardColumn)
}

function updateDashboardColumnCount() {
  const e = selectedDashboardColumnsFromChooser().length;
  refs.columnViewCount.textContent = e === state.columns.length ? "All columns selected" : `${e} of ${state.columns.length} columns selected`
}

function applyDashboardColumnView() {
  const e = selectedDashboardColumnsFromChooser();
  e.length ? (state.dashboardColumns = frozenColumnsFirst(e), saveDashboardColumnPreference(), updateChooseColumnsButton(), state.inlineEditCode = "", state.page = 1, refs.columnViewDialog.close(), renderTable(), showToast(`Dashboard now shows ${e.length} selected column${1===e.length?"":"s"}.`)) : showToast("Select at least one dashboard column.", !0)
}

function restoreAllDashboardColumns() {
  state.dashboardColumns = state.columns.slice(), saveDashboardColumnPreference(), updateChooseColumnsButton(), state.inlineEditCode = "", state.page = 1, refs.columnViewDialog.close(), renderTable(), showToast("All dashboard columns restored.")
}

function dashboardFilterValues(e) {
  const t = e || {};
  return {
    search: String(t.search || "").trim().slice(0, 250),
    group: String(t.group || ""),
    category: String(t.category || ""),
    status: String(t.status || ""),
    sensitivity: String(t.sensitivity || ""),
    sortColumn: state.columns.includes(String(t.sortColumn || "")) ? String(t.sortColumn) : "Sl No.",
    sortDirection: "desc" === t.sortDirection ? "desc" : "asc",
    displayColumns: Array.isArray(t.displayColumns) ? t.displayColumns.filter((e, t, r) => state.columns.includes(e) && r.indexOf(e) === t) : [],
    fieldColumns: Array.isArray(t.fieldColumns) ? t.fieldColumns.filter((e, t, r) => state.columns.includes(e) && r.indexOf(e) === t) : [],
    columnRules: normalizeColumnFilterRules(t.columnRules)
  }
}

function normalizeColumnFilterRules(e) {
  const t = new Set(COLUMN_FILTER_OPERATORS.map(e => e.value));
  return Array.isArray(e) ? e.map(e => {
    const r = String(e && e.column || ""),
      s = String(e && e.operator || ""),
      o = "show-all" === s ? "show-all" : t.has(s) ? s : "contains",
      i = String(e && e.value || "").trim().slice(0, 500);
    return !state.columns.includes(r) || columnFilterNeedsValue(o) && !i ? null : {
      column: r,
      operator: o,
      value: i
    }
  }).filter(Boolean) : []
}

function columnFilterNeedsValue(e) {
  return !["show-all", "filled", "blank"].includes(e)
}

function columnFilterOperatorLabel(e) {
  const t = COLUMN_FILTER_OPERATORS.find(t => t.value === e);
  return t ? t.label : "Contains"
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
  })
}

function dashboardFilterCount(e) {
  const t = dashboardFilterValues(e);
  return [t.search, t.group, t.category, t.status, t.sensitivity].filter(Boolean).length + t.displayColumns.length + t.fieldColumns.length + t.columnRules.length
}

function hasActiveDashboardFilter() {
  return dashboardFilterCount(currentDashboardFilterValues()) > 0
}

function currentManualOrderKey() {
  const e = currentDashboardFilterValues();
  return JSON.stringify({
    search: e.search.toLocaleLowerCase(),
    group: e.group,
    category: e.category,
    status: e.status,
    sensitivity: e.sensitivity,
    sortColumn: e.sortColumn,
    sortDirection: e.sortDirection,
    columnRules: e.columnRules
  })
}

function currentSavedManualOrder() {
  if (!hasActiveDashboardFilter()) return null;
  const e = state.savedManualOrders[currentManualOrderKey()];
  return e && Array.isArray(e.codes) ? e : null
}

function applySavedManualOrder() {
  const e = currentSavedManualOrder();
  if (!e || !e.codes.length) return !1;
  const t = new Map(e.codes.map((e, t) => [String(e), t]));
  return state.filtered.sort((e, r) => {
    const s = String(e["Employee Code"] || ""),
      o = String(r["Employee Code"] || "");
    return (t.has(s) ? t.get(s) : Number.MAX_SAFE_INTEGER) - (t.has(o) ? t.get(o) : Number.MAX_SAFE_INTEGER)
  }), state.manualOrderActive = !0, state.savedOrderRestored = !0, !0
}

function saveManualFilteredOrder() {
  if ("admin" !== state.role || !hasActiveDashboardFilter() || state.filtered.length < 2) return void showToast("First apply a filter containing at least two employees, then arrange and save the order.", !0);
  const e = currentManualOrderKey(),
    t = state.savedManualOrders;
  if (state.savedManualOrders = Object.assign({}, state.savedManualOrders), state.savedManualOrders[e] = {
      codes: state.filtered.map(e => String(e["Employee Code"] || "")).filter(Boolean),
      savedAt: Date.now()
    }, state.savedManualOrders = Object.fromEntries(Object.entries(state.savedManualOrders).sort(([, e], [, t]) => (Number(t.savedAt) || 0) - (Number(e.savedAt) || 0)).slice(0, 25)), !persistSavedManualOrders()) return state.savedManualOrders = t, void showToast("The order could not be saved in this browser. Check whether browser storage is allowed.", !0);
  state.manualOrderActive = !0, state.savedOrderRestored = !0, renderTable(), showToast("This filter and employee order are saved. They will be restored automatically next time.")
}

function resetManualFilteredOrder() {
  if (!hasActiveDashboardFilter()) return;
  const e = currentManualOrderKey();
  state.savedManualOrders[e] && (delete state.savedManualOrders[e], persistSavedManualOrders(), state.manualOrderActive = !1, state.savedOrderRestored = !1, sortEmployees(), renderTable(), showToast("The saved order for this filter was removed. Automatic column sorting is restored."))
}

function updateSaveOrderButtons() {
  if (!refs.saveOrderButton || !refs.resetOrderButton) return;
  const e = hasActiveDashboardFilter(),
    t = Boolean(currentSavedManualOrder());
  refs.saveOrderButton.hidden = "admin" !== state.role || !e, refs.saveOrderButton.disabled = state.filtered.length < 2, refs.saveOrderButton.textContent = t && state.savedOrderRestored ? "Order saved ✓" : "Save order", refs.saveOrderButton.classList.toggle("active", t && state.savedOrderRestored), refs.resetOrderButton.hidden = "admin" !== state.role || !t;
  const r = t && state.savedOrderRestored;
  setTwoLineActionLabel(refs.printFilteredButton, "Print", r ? "saved filter" : "filtered list"), refs.printFilteredButton.title = r ? "Print the current saved filter in its restored employee order" : "Print the employees currently shown by the dashboard filter", refs.printFilteredButton.classList.toggle("saved-order-print", r)
}

function updateChooseFiltersButton() {
  if (!refs.chooseFiltersButton || !refs.globalSearch) return;
  const e = dashboardFilterCount(currentDashboardFilterValues());
  setTwoLineActionLabel(refs.chooseFiltersButton, e ? "Filters" : "Filter", e ? `active · ${e}` : "dashboard"), refs.chooseFiltersButton.classList.toggle("active", e > 0)
}

function copySelectOptions(e, t, r) {
  t.innerHTML = [...e.options].map(e => `<option value="${escapeAttribute(e.value)}">${escapeHtml(e.textContent)}</option>`).join(""), setSavedSelectValue(t, r)
}

function openDashboardFilterChooser(e = {}) {
  const t = Boolean(e && e.showSavedViews),
    r = currentDashboardFilterValues();
  loadFilterViews().catch(() => {}), showFilterViewError(""), refs.filterViewSearch.value = r.search, copySelectOptions(refs.groupFilter, refs.filterViewGroup, r.group), copySelectOptions(refs.categoryFilter, refs.filterViewCategory, r.category), copySelectOptions(refs.statusFilter, refs.filterViewStatus, r.status), copySelectOptions(refs.sensitivityFilter, refs.filterViewSensitivity, r.sensitivity), refs.filterViewSortColumn.innerHTML = state.columns.map(e => `<option value="${escapeAttribute(e)}">${escapeHtml(columnLabel(e))}</option>`).join(""), setSavedSelectValue(refs.filterViewSortColumn, r.sortColumn), refs.filterViewSortDirection.value = r.sortDirection, renderColumnFilterRules(r.columnRules), refs.savedFilterViewName.value = "", refs.savedFilterViewsPanel.open = t, renderNamedFilterViews(), updateFilterViewSummary(), refs.filterViewDialog.showModal(), refs.filterViewDialog.scrollTop = 0, setTimeout(() => {
    if (updateFilterScrollButtons(), t) {
      (refs.savedFilterViewList.querySelector('[data-saved-filter-action="open"]') || refs.savedFilterViewName).focus({
        preventScroll: !0
      })
    }
  }, 0)
}

function openSavedFilterViews() {
  openDashboardFilterChooser({
    showSavedViews: !0
  })
}

function updateSavedViewsButton() {
  if (!refs.savedViewsButton) return;
  const e = state.namedFilterViews.length;
  setTwoLineActionLabel(refs.savedViewsButton, "Saved", `views · ${e}`), refs.savedViewsButton.classList.toggle("has-saved-views", e > 0), refs.savedViewsButton.setAttribute("aria-label", e ? `Open ${e} saved filter view${1===e?"":"s"}` : "Open saved filter views")
}

function renderNamedFilterViews() {
  const e = state.namedFilterViews.slice().sort((e, t) => (Number(t.savedAt) || 0) - (Number(e.savedAt) || 0));
  updateSavedViewsButton(), refs.savedFilterViewCount.textContent = e.length ? `${e.length} saved` : "None saved", refs.savedFilterViewEmpty.hidden = e.length > 0, refs.savedFilterViewList.innerHTML = e.map(e => {
    const t = dashboardFilterValues(e.filters),
      r = dashboardFilterCount(t),
      s = e.columns.filter((e, t, r) => state.columns.includes(e) && r.indexOf(e) === t),
      i = Array.isArray(e.rowOrder) && e.rowOrder.length,
      a = state.activeFilterViewId === e.id,
      o = `${r||"No"} filter${1===r?"":"s"} · ${s.length||state.columns.length} column${1===(s.length||state.columns.length)?"":"s"} · ${"desc"===t.sortDirection?"Descending":"Ascending"}${i?" · Custom order saved":""}`;
    return `<article class="saved-filter-view-card${a?" is-active":""}" data-saved-filter-view="${escapeAttribute(e.id)}"><button class="saved-filter-main" type="button" data-saved-filter-action="open"><strong>${escapeHtml(e.name)}${a?'<span class="saved-filter-active-badge">Currently viewing</span>':""}</strong><small>${escapeHtml(o)}</small></button><div class="saved-filter-actions"><button type="button" data-saved-filter-action="open">Open</button><button type="button" data-saved-filter-action="print">Print</button><button class="delete" type="button" data-saved-filter-action="delete">Delete</button></div></article>`
  }).join(""), setTimeout(updateFilterScrollButtons, 0)
}

function setTwoLineActionLabel(e, t, r) {
  if (!e) return;
  const s = document.createElement("span");
  s.className = "action-card-label", [t, r].forEach(e => {
    const t = document.createElement("span");
    t.textContent = e, s.appendChild(t)
  }), e.replaceChildren(s)
}

async function saveNamedFilterView() {
  if (!validateColumnFilterRules()) return;
  const e = refs.savedFilterViewName.value.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!e) return showFilterViewError("Enter a short name for this saved filter view."), refs.savedFilterViewsPanel.open = !0, void refs.savedFilterViewName.focus();
  const r = state.namedFilterViews.find(t => t.name.toLocaleLowerCase() === e.toLocaleLowerCase()),
    payload = {
      id: r ? r.id : "",
      name: e,
      filters: selectedFilterViewValues(),
      columns: visibleTableColumns(),
      rowOrder: state.filtered.map(e => String(e["Employee Code"] || "")).filter(Boolean).slice(0, 1200)
    };
  setButtonBusy(refs.saveNamedFilterViewButton, !0, r ? "Updating…" : "Saving…");
  try {
    const t = await apiRequest("saveFilterView", payload);
    state.namedFilterViews = Array.isArray(t.views) ? t.views.map(normalizeFilterViewFromServer) : state.namedFilterViews, refs.savedFilterViewName.value = "", refs.savedFilterViewsPanel.open = !0, showFilterViewError(""), renderNamedFilterViews(), showToast(r ? `Saved filter view “${e}” updated.` : `Filter view “${e}” saved for every signed-in user.`)
  } catch (t) {
    showFilterViewError(friendlyError(t))
  } finally {
    setButtonBusy(refs.saveNamedFilterViewButton, !1, "Save current choices")
  }
}

async function handleNamedFilterViewAction(e) {
  const t = e.target.closest("[data-saved-filter-action]"),
    r = e.target.closest("[data-saved-filter-view]");
  if (!t || !r) return;
  const s = state.namedFilterViews.find(e => e.id === r.dataset.savedFilterView);
  if (!s) return;
  const o = t.dataset.savedFilterAction;
  if ("delete" === o) {
    if (!confirm(`Delete the saved filter view “${s.name}” for everyone?`)) return;
    setButtonBusy(t, !0, "Deleting…");
    try {
      const e = await apiRequest("deleteFilterView", {
        id: s.id
      });
      state.namedFilterViews = Array.isArray(e.views) ? e.views.map(normalizeFilterViewFromServer) : state.namedFilterViews.filter(e => e.id !== s.id), renderNamedFilterViews(), showToast(`Saved filter view “${s.name}” deleted.`)
    } catch (e) {
      showFilterViewError(friendlyError(e)), showToast(friendlyError(e), !0), setButtonBusy(t, !1, "Delete")
    }
    return
  }
  applyNamedFilterView(s, "print" === o)
}

function applyNamedFilterView(e, t) {
  const r = e.columns.filter((e, t, r) => state.columns.includes(e) && r.indexOf(e) === t);
  r.length && (state.dashboardColumns = frozenColumnsFirst(r), saveDashboardColumnPreference(), updateChooseColumnsButton()), setCurrentDashboardFilters(e.filters), state.inlineEditCode = "", state.page = 1, refs.filterViewDialog.close(), applyFilters();
  if (Array.isArray(e.rowOrder) && e.rowOrder.length) {
    const s = new Map(e.rowOrder.map((e, t) => [String(e), t]));
    state.filtered.sort((e, t) => {
      const r = String(e["Employee Code"] || ""),
        o = String(t["Employee Code"] || "");
      return (s.has(r) ? s.get(r) : Number.MAX_SAFE_INTEGER) - (s.has(o) ? s.get(o) : Number.MAX_SAFE_INTEGER)
    }), state.manualOrderActive = !0, state.savedOrderRestored = !0
  }
  state.activeFilterViewId = e.id, state.activeFilterViewName = e.name, renderTable(), renderNamedFilterViews(), showToast(`Saved filter view “${e.name}” opened.`), t && setTimeout(openFilteredReport, 80)
}

function scrollFilterDialog(e) {
  const t = Math.max(260, Math.round(.68 * refs.filterViewDialog.clientHeight));
  refs.filterViewDialog.scrollBy({
    top: e * t,
    behavior: "smooth"
  }), setTimeout(updateFilterScrollButtons, 360)
}

function updateFilterScrollButtons() {
  if (!refs.filterViewDialog || !refs.filterScrollUp || !refs.filterScrollDown) return;
  const e = Math.max(0, refs.filterViewDialog.scrollHeight - refs.filterViewDialog.clientHeight);
  refs.filterScrollUp.disabled = refs.filterViewDialog.scrollTop <= 2, refs.filterScrollDown.disabled = refs.filterViewDialog.scrollTop >= e - 2, refs.filterScrollDown.title = e > 2 ? "Scroll down through more filter options" : "All filter options are already visible"
}

function renderColumnFilterRules(e) {
  const t = Array.isArray(e) ? e : [];
  refs.columnFilterRuleList.innerHTML = t.map((e, t) => columnFilterRuleMarkup(e, t)).join(""), refs.columnFilterRuleEmpty.hidden = t.length > 0, refs.columnFilterRuleList.querySelectorAll(".column-filter-rule").forEach(updateColumnFilterRuleValueState), setTimeout(updateFilterScrollButtons, 0)
}

function columnFilterRuleMarkup(e, t) {
  return `<div class="column-filter-rule" data-filter-rule-index="${t}"><label><span>Column</span><select data-rule-part="column">${'<option value="">Choose any column…</option>'+state.columns.map(t=>`<option value="${escapeAttribute(t)}"${e.column===t?" selected":""}>${escapeHtml(columnLabel(t))}</option>`).join("")}</select></label><label><span>Condition</span><select data-rule-part="operator">${COLUMN_FILTER_OPERATORS.map(t=>`<option value="${t.value}"${e.operator===t.value?" selected":""}>${escapeHtml(t.label)}</option>`).join("")}</select></label><label class="column-filter-value"><span>Value</span><input data-rule-part="value" type="text" maxlength="500" value="${escapeAttribute(e.value||"")}" list="columnFilterSuggestions${t}" placeholder="Type or choose a value"><datalist id="columnFilterSuggestions${t}" data-rule-suggestions></datalist></label><button class="column-filter-remove" type="button" data-rule-action="remove" aria-label="Remove this filter rule">Remove</button></div>`
}

function rawColumnFilterRulesFromChooser() {
  return [...refs.columnFilterRuleList.querySelectorAll(".column-filter-rule")].map(e => ({
    column: e.querySelector('[data-rule-part="column"]').value,
    operator: e.querySelector('[data-rule-part="operator"]').value,
    value: e.querySelector('[data-rule-part="value"]').value
  }))
}

function addColumnFilterRule() {
  const e = rawColumnFilterRulesFromChooser();
  e.push({
    column: "",
    operator: "filled",
    value: ""
  }), renderColumnFilterRules(e), showFilterViewError("");
  const t = refs.columnFilterRuleList.lastElementChild;
  t && t.querySelector('[data-rule-part="column"]').focus(), updateFilterViewSummary()
}

function handleColumnFilterRuleChange(e) {
  const t = e.target.closest(".column-filter-rule");
  t && updateColumnFilterRuleValueState(t), showFilterViewError(""), updateFilterViewSummary()
}

function handleColumnFilterRuleAction(e) {
  const t = e.target.closest('[data-rule-action="remove"]');
  t && (t.closest(".column-filter-rule").remove(), [...refs.columnFilterRuleList.children].forEach((e, t) => {
    e.dataset.filterRuleIndex = String(t)
  }), refs.columnFilterRuleEmpty.hidden = refs.columnFilterRuleList.children.length > 0, showFilterViewError(""), updateFilterViewSummary())
}

function updateColumnFilterRuleValueState(e) {
  const t = e.querySelector('[data-rule-part="column"]').value,
    r = e.querySelector('[data-rule-part="operator"]').value,
    s = e.querySelector('[data-rule-part="value"]'),
    o = e.querySelector("[data-rule-suggestions]"),
    i = columnFilterNeedsValue(r);
  s.disabled = !i, s.required = Boolean(t && i), s.placeholder = t ? `Type or choose ${columnLabel(t)}` : "Type or choose a value", o.innerHTML = columnFilterSuggestions(t).map(e => `<option value="${escapeAttribute(e)}"></option>`).join(""), i || (s.value = ""), e.classList.toggle("value-not-required", !i)
}

function validateColumnFilterRules() {
  for (const e of refs.columnFilterRuleList.querySelectorAll(".column-filter-rule")) {
    const t = e.querySelector('[data-rule-part="column"]'),
      r = t.value,
      s = e.querySelector('[data-rule-part="operator"]').value,
      o = e.querySelector('[data-rule-part="value"]');
    if (!r) return showFilterViewError("Choose a column for every added filter rule, or remove the unused rule."), t.focus(), !1;
    if (columnFilterNeedsValue(s) && !o.value.trim()) return showFilterViewError(`Enter or choose a value for the ${columnLabel(r)} filter.`), o.focus(), !1
  }
  return !0
}

function columnFilterSuggestions(e) {
  return state.columns.includes(e) ? [...new Set(state.employees.map(t => employeeColumnFilterValue(t, e)).filter(Boolean))].sort((e, t) => e.localeCompare(t, void 0, {
    numeric: !0,
    sensitivity: "base"
  })).slice(0, 150) : []
}

function showFilterViewError(e) {
  refs.filterViewError.textContent = e || "", refs.filterViewError.hidden = !e
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
  })
}

function updateFilterViewSummary() {
  if (!refs.filterViewSummary) return;
  const e = selectedFilterViewValues(),
    t = [];
  e.search && t.push(`Search: “${e.search}”`), e.group && t.push(`Group: ${e.group}`), e.category && t.push(`Category: ${e.category}`), e.status && t.push(`Status: ${e.status}`), e.sensitivity && t.push(`Post: ${e.sensitivity}`), e.columnRules.forEach(e => t.push(`${columnLabel(e.column)} ${columnFilterOperatorLabel(e.operator).toLocaleLowerCase()}${columnFilterNeedsValue(e.operator)?` “${e.value}”`:""}`));
  const r = `Arrange by ${columnLabel(e.sortColumn)} · ${"desc"===e.sortDirection?"Descending":"Ascending"}`;
  refs.filterViewSummary.textContent = t.length ? `${t.length} filter${1===t.length?"":"s"} · ${t.join(" · ")} · ${r}` : `All employees · ${r}`
}

function setCurrentDashboardFilters(e) {
  const t = dashboardFilterValues(e);
  refs.globalSearch.value = t.search, setSavedSelectValue(refs.groupFilter, t.group), setSavedSelectValue(refs.categoryFilter, t.category), setSavedSelectValue(refs.statusFilter, t.status), setSavedSelectValue(refs.sensitivityFilter, t.sensitivity), state.sortColumn = t.sortColumn, state.sortDirection = t.sortDirection, state.filterDisplayColumns = [], state.fieldFilterColumns = [], state.columnFilterRules = t.columnRules, populateFieldFilterColumns()
}

function applyDashboardFilterView() {
  if (!validateColumnFilterRules()) return;
  const e = selectedFilterViewValues();
  setCurrentDashboardFilters(e), state.inlineEditCode = "", state.page = 1, refs.filterViewDialog.close(), applyFilters();
  const t = dashboardFilterCount(e);
  showToast(t ? `${t} dashboard filter${1===t?"":"s"} saved. Filtered rows are ready for direct editing.` : "Default dashboard filters cleared. All employees are shown.")
}

function clearDashboardFilterView() {
  setCurrentDashboardFilters(dashboardFilterValues({})), refs.filterViewDialog.close(), state.inlineEditCode = "", state.page = 1, applyFilters(), showToast("Saved dashboard filters cleared. All employees are shown.")
}

function columnLabel(e) {
  return String(state.columnLabels[e] || DEFAULT_COLUMN_LABELS[e] || e)
}

function defaultLabelsForColumns() {
  const e = new Map(state.customColumns.map(e => [e.key, e.label]));
  return state.columns.reduce((t, r) => (t[r] = DEFAULT_COLUMN_LABELS[r] || e.get(r) || r, t), {})
}

function applyColumnMetadata(e) {
  Array.isArray(e && e.columns) && e.columns.length && (state.columns = e.columns.map(String)), Array.isArray(e && e.customColumns) && (state.customColumns = e.customColumns.filter(e => e && e.key).map(e => ({
    key: String(e.key),
    label: String(e.label || e.key)
  }))), e && e.columnLabels && (state.columnLabels = Object.assign({}, DEFAULT_COLUMN_LABELS, e.columnLabels)), state.columns.includes(state.sortColumn) || (state.sortColumn = "Sl No.", state.sortDirection = "asc")
}

function handleHeaderLabelInput(e) {
  e.target.closest("[data-header-key]") && "admin" === state.role && (state.headerLabelsDirty = !0, refs.saveHeadersButton.disabled = !1)
}
async function saveHeaderLabels() {
  if ("admin" !== state.role) return;
  const e = [...refs.tableHead.querySelectorAll("[data-header-key]")];
  if (!e.length) return void showToast("No visible dashboard headings are available to edit.", !0);
  const t = new Set(e.map(e => e.dataset.headerKey)),
    r = state.columns.reduce((e, t) => (e[t] = columnLabel(t).trim() || DEFAULT_COLUMN_LABELS[t] || t, e), {}),
    s = new Map;
  state.columns.forEach(e => {
    t.has(e) || s.set(r[e].toLocaleLowerCase(), e)
  });
  for (const t of e) {
    const e = t.value.trim();
    if (!e) return showToast("Every column must have a header name.", !0), void t.focus();
    const o = e.toLocaleLowerCase();
    if (s.has(o)) return showToast(`Each header name must be different. “${e}” is already used by another column.`, !0), void t.focus();
    s.set(o, t.dataset.headerKey), r[t.dataset.headerKey] = e
  }
  setButtonBusy(refs.saveHeadersButton, !0, "Saving…");
  try {
    const e = await apiRequest("saveColumnLabels", {
      columnLabels: r
    });
    applyColumnMetadata(e), state.columnLabels = Object.assign({}, DEFAULT_COLUMN_LABELS, e.columnLabels || r), state.headerLabelsDirty = !1, showToast("Visible header names saved. Hidden column headings were preserved."), state.headerEditEnabled = !1, buildTableHeader(), updateHeaderEditButtons()
  } catch (e) {
    showToast(friendlyError(e), !0)
  } finally {
    setButtonBusy(refs.saveHeadersButton, !1, "Save headers"), refs.saveHeadersButton.disabled = !state.headerLabelsDirty
  }
}
async function resetHeaderLabels() {
  if ("admin" === state.role && confirm("Restore all visible dashboard headers to their standard names?")) {
    setButtonBusy(refs.resetHeadersButton, !0, "Resetting…");
    try {
      const e = await apiRequest("saveColumnLabels", {
        columnLabels: defaultLabelsForColumns()
      });
      applyColumnMetadata(e), state.columnLabels = Object.assign({}, DEFAULT_COLUMN_LABELS, e.columnLabels || {}), state.headerLabelsDirty = !1, state.headerEditEnabled = !1, buildTableHeader(), updateHeaderEditButtons(), showToast("Standard header names restored.")
    } catch (e) {
      showToast(friendlyError(e), !0)
    } finally {
      setButtonBusy(refs.resetHeadersButton, !1, "Reset headers")
    }
  }
}

function openColumnManager() {
  "admin" === state.role && (refs.columnManagerError.textContent = "", refs.newColumnName.value = "", renderColumnManager(), refs.columnManagerDialog.showModal(), setTimeout(() => refs.newColumnName.focus(), 30))
}

function renderColumnManager() {
  refs.customColumnEmpty.hidden = 0 !== state.customColumns.length, refs.customColumnList.innerHTML = state.customColumns.map(e => `\n    <div class="custom-column-item">\n      <div><strong>${escapeHtml(columnLabel(e.key))}</strong><small>Custom employee field · editable in every employee record</small></div>\n      <button class="column-delete-btn" type="button" data-delete-column="${escapeAttribute(e.key)}">Delete column</button>\n    </div>\n  `).join("")
}
async function addCustomColumn(e) {
  e.preventDefault();
  const t = refs.newColumnName.value.trim();
  if (refs.columnManagerError.textContent = "", !t) return;
  const r = refs.columnManagerForm.querySelector('button[type="submit"]');
  setButtonBusy(r, !0, "Adding…");
  try {
    applyColumnMetadata(await apiRequest("addCustomColumn", {
      label: t
    })), refs.newColumnName.value = "", renderColumnManager(), showToast(`Column “${t}” added. It is now available in employee records.`), await loadEmployees(!0), renderColumnManager()
  } catch (e) {
    refs.columnManagerError.textContent = friendlyError(e)
  } finally {
    setButtonBusy(r, !1, "Add column")
  }
}
async function handleColumnManagerAction(e) {
  const t = e.target.closest("[data-delete-column]");
  if (!t || "admin" !== state.role) return;
  const r = t.dataset.deleteColumn;
  if (!state.customColumns.find(e => e.key === r)) return;
  const s = columnLabel(r);
  if (confirm(`Delete the custom column “${s}”?\n\nAll values stored in this column will be removed. A Drive backup will be created first.`)) {
    setButtonBusy(t, !0, "Deleting…"), refs.columnManagerError.textContent = "";
    try {
      const e = await apiRequest("deleteCustomColumn", {
        key: r
      });
      applyColumnMetadata(e), renderColumnManager(), showToast(`Column “${s}” deleted. Backup created: ${e.backupFileName||"employee backup"}.`), await loadEmployees(!0), renderColumnManager()
    } catch (e) {
      refs.columnManagerError.textContent = friendlyError(e)
    } finally {
      t.isConnected && setButtonBusy(t, !1, "Delete column")
    }
  }
}

function populateFilters() {
  populateSelect(refs.groupFilter, uniqueValues("Grp"), "All groups"), populateSelect(refs.categoryFilter, uniqueValues("Cat"), "All categories");
  const e = [...new Set(STRENGTH_STATUSES.concat(state.employees.some(e => !String(e["Strength Status"] || "").trim()) ? ["Not set"] : []))];
  populateSelect(refs.statusFilter, e, "All strength statuses");
  const t = [...new Set(SENSITIVITY_VALUES.concat(state.employees.some(e => !String(e["Post Sensitivity"] || "").trim()) ? ["Not set"] : []))];
  populateSelect(refs.sensitivityFilter, t, "All post sensitivities")
}

function populateFieldFilterColumns() {
  const e = new Set(state.fieldFilterColumns.filter(e => state.columns.includes(e)));
  state.fieldFilterColumns = [...e], refs.fieldFilterOptions.innerHTML = state.columns.map(t => `<label><input type="checkbox" value="${escapeAttribute(t)}"${e.has(t)?" checked":""}><span>${escapeHtml(columnLabel(t))}</span></label>`).join(""), updateFieldFilterPickerSummary()
}

function selectedFieldFilterColumns() {
  return [...refs.fieldFilterOptions.querySelectorAll('input[type="checkbox"]:checked')].map(e => e.value).filter(e => state.columns.includes(e))
}

function updateFieldFilterPickerSummary() {
  const e = selectedFieldFilterColumns();
  e.length ? e.length <= 2 ? refs.fieldFilterPickerSummary.textContent = e.map(columnLabel).join(" + ") : refs.fieldFilterPickerSummary.textContent = `${e.length} columns selected` : refs.fieldFilterPickerSummary.textContent = "Choose columns…"
}

function applyParticularFieldFilter() {
  const e = selectedFieldFilterColumns();
  e.length ? (state.fieldFilterColumns = e, state.inlineEditCode = "", state.page = 1, refs.clearFieldFilter.disabled = !1, refs.fieldFilterPicker.open = !1, applyFilters(), showToast(`Showing employees where ${e.map(columnLabel).join(", ")} ${1===e.length?"is":"are"} filled. Use Edit filtered row beside any result.`)) : showToast("Select at least one field or subject column.", !0)
}

function resetParticularFieldFilter() {
  state.fieldFilterColumns = [], state.inlineEditCode = "", refs.fieldFilterOptions.querySelectorAll('input[type="checkbox"]').forEach(e => {
    e.checked = !1
  }), updateFieldFilterPickerSummary(), refs.fieldFilterPicker.open = !1, refs.clearFieldFilter.disabled = !0, state.page = 1, applyFilters()
}

function hasParticularFieldFilter() {
  return state.fieldFilterColumns.length > 0
}

function hasFocusedColumnFilter() {
  return state.filterDisplayColumns.length > 0 || hasParticularFieldFilter() || state.columnFilterRules.length > 0
}

function employeeColumnFilterValue(e, t) {
  return "Strength Status" === t ? strengthStatus(e) : "Post Sensitivity" === t ? sensitivityStatus(e) : String(null == e[t] ? "" : e[t]).trim()
}

function employeeMatchesColumnRule(e, t) {
  const r = employeeColumnFilterValue(e, t.column),
    s = r.toLocaleLowerCase(),
    o = String(t.value || "").trim().toLocaleLowerCase();
  return "show-all" === t.operator || ("filled" === t.operator ? Boolean(r) : "blank" === t.operator ? !r : "equals" === t.operator ? s === o : "not-equals" === t.operator ? s !== o : "starts-with" === t.operator ? s.startsWith(o) : s.includes(o))
}

function uniqueValues(e) {
  return [...new Set(state.employees.map(t => String(t[e] || "").trim()).filter(Boolean))].sort((e, t) => e.localeCompare(t, void 0, {
    numeric: !0
  }))
}

function populateSelect(e, t, r) {
  const s = e.value;
  e.innerHTML = `<option value="">${escapeHtml(r)}</option>` + t.map(e => `<option value="${escapeAttribute(e)}">${escapeHtml(e)}</option>`).join(""), t.includes(s) && (e.value = s)
}

function applyFilters() {
  state.page = 1, state.manualOrderActive = !1, state.savedOrderRestored = !1, state.activeFilterViewId = "", state.activeFilterViewName = "";
  const e = refs.globalSearch.value.trim().toLocaleLowerCase(),
    t = refs.groupFilter.value,
    r = refs.categoryFilter.value,
    s = refs.statusFilter.value,
    o = refs.sensitivityFilter.value,
    i = state.fieldFilterColumns,
    n = state.columnFilterRules;
  state.search = e, saveDashboardFilterPreference(), state.filtered = state.employees.filter(a => {
    const l = state.employeeSearchIndex.get(a) || "",
      d = i.every(e => String(null == a[e] ? "" : a[e]).trim()),
      c = n.every(e => employeeMatchesColumnRule(a, e));
    return (!e || l.includes(e)) && (!t || a.Grp === t) && (!r || a.Cat === r) && (!s || strengthStatus(a) === s) && (!o || sensitivityStatus(a) === o) && (!i.length || d) && (!n.length || c)
  }), sortEmployees(), applySavedManualOrder(), updateStats(), updateFieldFilterSummary(), updateChooseFiltersButton(), resetDirectoryScrollPosition(), renderTable()
}

function resetDirectoryScrollPosition() {
  refs.employeeTableWrap && (refs.employeeTableWrap.scrollTop = 0, requestAnimationFrame(updateDirectoryScrollButtons))
}

function scrollEmployeeDirectory(e) {
  const t = refs.employeeTableWrap;
  if (!t) return;
  const r = Math.max(180, Math.round(.72 * t.clientHeight));
  t.scrollBy({
    top: e * r,
    behavior: "smooth"
  }), window.setTimeout(updateDirectoryScrollButtons, 280)
}

function updateDirectoryScrollButtons() {
  const e = refs.employeeTableWrap;
  if (!e || !refs.tableScrollUp || !refs.tableScrollDown) return;
  const t = e.scrollHeight > e.clientHeight + 2;
  refs.tableScrollUp.disabled = !t || e.scrollTop <= 2, refs.tableScrollDown.disabled = !t || e.scrollTop + e.clientHeight >= e.scrollHeight - 2
}

function clearFilters() {
  refs.globalSearch.value = "", refs.groupFilter.value = "", refs.categoryFilter.value = "", refs.statusFilter.value = "", refs.sensitivityFilter.value = "", state.filterDisplayColumns = [], state.fieldFilterColumns = [], state.columnFilterRules = [], refs.fieldFilterOptions.querySelectorAll('input[type="checkbox"]').forEach(e => {
    e.checked = !1
  }), updateFieldFilterPickerSummary(), refs.fieldFilterPicker.open = !1, refs.clearFieldFilter.disabled = !0, state.page = 1, applyFilters(), showToast("Filters cleared. The saved default filter view has been reset.")
}

function updateFieldFilterSummary() {
  if (!hasParticularFieldFilter()) return refs.fieldFilterSummary.textContent = "Choose one or more columns. Employees whose selected columns are all filled will appear for direct editing.", void(refs.clearFieldFilter.disabled = !0);
  const e = state.fieldFilterColumns.map(columnLabel);
  refs.fieldFilterSummary.textContent = `${state.filtered.length} employee${1===state.filtered.length?"":"s"} have all selected columns filled: ${e.join(", ")}. Choose Edit filtered row below.`, refs.clearFieldFilter.disabled = !1
}

function sortBy(e) {
  state.sortColumn === e ? state.sortDirection = "asc" === state.sortDirection ? "desc" : "asc" : (state.sortColumn = e, state.sortDirection = "asc"), state.manualOrderActive = !1, state.savedOrderRestored = !1, saveDashboardFilterPreference(), sortEmployees(), renderTable()
}

function sortEmployees() {
  const e = "asc" === state.sortDirection ? 1 : -1,
    t = state.sortColumn,
    r = new Set(["DoB", "DoR", "DoJ Govt", "DoJ in Current Office", "Relieving Date"]);
  state.filtered.sort((s, o) => {
    const i = "Strength Status" === t ? strengthStatus(s) : "Post Sensitivity" === t ? sensitivityStatus(s) : String(null == s[t] ? "" : s[t]).trim(),
      n = "Strength Status" === t ? strengthStatus(o) : "Post Sensitivity" === t ? sensitivityStatus(o) : String(null == o[t] ? "" : o[t]).trim();
    if (!i && !n) return 0;
    if (!i) return 1;
    if (!n) return -1;
    if (r.has(t)) {
      const t = parseDate(i),
        r = parseDate(n);
      if (t && r) return (t.getTime() - r.getTime()) * e
    }
    return i.localeCompare(n, void 0, {
      numeric: !0,
      sensitivity: "base"
    }) * e
  })
}

function moveFilteredEmployee(e, t) {
  if (!hasActiveDashboardFilter()) return;
  const r = state.filtered.findIndex(t => String(t["Employee Code"] || "") === String(e || "")),
    s = r + t;
  r < 0 || s < 0 || s >= state.filtered.length || ([state.filtered[r], state.filtered[s]] = [state.filtered[s], state.filtered[r]], state.manualOrderActive = !0, state.savedOrderRestored = !1, state.inlineEditCode = "", renderTable(), showToast(`Employee moved ${t<0?"up":"down"}. Serial numbers have been updated for this filtered view.`))
}

function renderTable() {
  buildTableHeader();
  const e = visibleTableColumns();
  refs.employeeTable.classList.toggle("has-frozen-serial", e.includes("Sl No.")), refs.employeeTable.classList.toggle("has-frozen-employee-name", e.includes("Employee Name")), refs.employeeTable.classList.toggle("focused-columns-table", hasFocusedColumnFilter()), refs.employeeTable.classList.toggle("customized-columns-table", isDashboardColumnCustomized()), refs.employeeTable.classList.toggle("wide-actions-table", "admin" === state.role && (state.directEditEnabled || hasActiveDashboardFilter()));
  const t = state.filtered.length,
    r = state.filtered;
  refs.tableBody.innerHTML = r.map((r, s) => {
    const o = 0 + s + 1,
      i = String(r["Employee Code"] || ""),
      n = hasActiveDashboardFilter(),
      a = state.inlineEditCode === i,
      l = e.map(e => {
        if (a) return renderInlineCell(r, e, o);
        let t = "Sl No." === e ? String(o) : null == r[e] ? "" : String(r[e]),
          s = ["DoB", "DoR", "DoJ Govt", "DoJ in Current Office", "Relieving Date"].includes(e) ? formatDate(t) : t,
          i = highlight(s, state.search);
        "Grp" === e && t && (i = `<span class="badge group">${escapeHtml(t)}</span>`), "Cat" === e && t && (i = `<span class="badge category">${escapeHtml(t)}</span>`), "Strength Status" === e && (s = strengthStatus(r), i = `<span class="badge strength ${strengthClass(s)}">${escapeHtml(s)}</span>`), "Post Sensitivity" === e && (s = sensitivityStatus(r), i = `<span class="badge sensitivity ${sensitivityClass(s)}">${escapeHtml(s)}</span>`);
        const n = [];
        ["REMARK ADMN", "Present/Permanent Address"].includes(e) && n.push("remarks-cell"), isLongDashboardTextColumn(e) && n.push("long-text-dashboard-column");
        const l = columnVisualClass(e);
        l && n.push(l);
        const d = ["Grp", "Cat", "Strength Status", "Post Sensitivity"].includes(e) && i,
          c = !String(s || "").trim();
        let u = i || "—";
        c || "employee-name-column" !== l || (u = `<span class="employee-name-deep-blue">${i}</span>`), !c && isPendingWorkColumn(e) && (u = `<span class="pending-work-red-text">${i}</span>`);
        const m = d ? i : `<span class="cell-text value-highlight${c?" empty-value":""}">${u}</span>`;
        return `<td class="${n.join(" ")}" data-column-key="${escapeAttribute(e)}" title="${escapeAttribute(s)}">${m}</td>`
      }).join(""),
      d = escapeAttribute(r["Employee Name"] || "employee");
    let c = "";
    if ("admin" === state.role)
      if (a) {
        const e = pendingWorkColumnKey(),
          t = e ? pendingWorkItems(r[e]).length : 0,
          s = e ? `<button class="row-action inline-finished-work" data-action="inline-work" data-code="${escapeAttribute(i)}">Move finished${t?` · ${t}`:""}</button>` : "";
        c = `<td class="admin-column" data-column-key="Actions"><div class="action-cell inline-actions"><button class="row-action save" data-action="inline-save" data-code="${escapeAttribute(i)}">Save</button>${s}<button class="row-action" data-action="inline-cancel" data-code="${escapeAttribute(i)}">Cancel</button></div></td>`
      } else if (state.directEditEnabled || n) {
      c = `<td class="admin-column" data-column-key="Actions"><div class="action-cell">${n?`<span class="manual-order-controls" aria-label="Manually arrange this employee in the filtered list"><button class="row-action order-arrow" data-action="move-up" data-code="${escapeAttribute(i)}" title="Move employee up" aria-label="Move ${d} up"${0===s?" disabled":""}>↑</button><button class="row-action order-arrow" data-action="move-down" data-code="${escapeAttribute(i)}" title="Move employee down" aria-label="Move ${d} down"${s===t-1?" disabled":""}>↓</button></span>`:""}<button class="row-action inline-edit" data-action="inline-edit" data-code="${escapeAttribute(i)}">${n?"Edit filtered row":"Edit row"}</button><button class="row-action" data-action="edit" data-code="${escapeAttribute(i)}">Full form</button><button class="row-action delete" data-action="delete" data-code="${escapeAttribute(i)}">Delete</button></div></td>`
    } else c = `<td class="admin-column" data-column-key="Actions"><div class="action-cell"><button class="row-action" data-action="edit" data-code="${escapeAttribute(i)}">Edit</button><button class="row-action delete" data-action="delete" data-code="${escapeAttribute(i)}">Delete</button></div></td>`;
    const u = escapeAttribute(r["Employee Code"]);
    return `<tr class="${a?"employee-row inline-row-active":"employee-row"}" tabindex="${a?"-1":"0"}" data-employee-code="${u}" aria-label="${a?"Editing":"View full details for"} ${d}">${l}${c}</tr>`
  }).join(""), refs.tableBody.querySelectorAll(".inline-long-text").forEach(e => {
    e.style.height = "auto", e.style.height = `${e.scrollHeight}px`
  }), applySavedColumnWidths(), refs.emptyState.hidden = 0 !== t, refs.employeeTable.hidden = 0 === t;
  const s = state.headerEditEnabled ? " · Header editing is on — rename headings, then choose Save headers" : hasActiveDashboardFilter() ? " · Filtered view — click a header arrow to sort or use row ↑ ↓ to arrange manually; choose Edit filtered row, then Save" + (state.activeFilterViewName ? ` · Saved view: "${state.activeFilterViewName}"` : state.savedOrderRestored ? " · Saved order restored" : state.manualOrderActive ? " · Unsaved manual order" : "") : isDashboardColumnCustomized() ? ` · Custom view: ${e.length} selected columns` : state.directEditEnabled ? " · Row editing is on — choose Edit row, then Save" : t ? " · Click a row for full details" : "";
  refs.resultSummary.textContent = `${t} record${1===t?"":"s"}${state.search?" matching search":""}${s}`, refs.pageInfo.textContent = t ? `Showing all ${t} employee${1===t?"":"s"} · Use the visible ▲ ▼ buttons or scrollbar to view every row` : "Showing 0 employees", updateSaveOrderButtons(), requestAnimationFrame(updateDirectoryScrollButtons)
}

function toggleDirectEdit() {
  "admin" === state.role && (state.directEditEnabled && state.inlineEditCode && !confirm("Turn off row editing and discard the unsaved row changes?") || !state.directEditEnabled && state.headerEditEnabled && state.headerLabelsDirty && !confirm("Discard the unsaved header-name changes and start editing rows?") || (state.headerEditEnabled = !1, state.headerLabelsDirty = !1, state.directEditEnabled = !state.directEditEnabled, state.inlineEditCode = "", updateDirectEditButton(), updateHeaderEditButtons(), renderTable(), showToast(state.directEditEnabled ? "Row editing is on. Choose Edit row beside an employee." : "Row editing is off.")))
}

function updateDirectEditButton() {
  refs.directEditToggle && (refs.directEditToggle.classList.toggle("active", state.directEditEnabled), refs.directEditToggle.setAttribute("aria-pressed", String(state.directEditEnabled)), refs.directEditToggle.textContent = state.directEditEnabled ? "Finish row edit" : "Edit rows")
}

function toggleHeaderEdit() {
  "admin" === state.role && (state.headerEditEnabled && state.headerLabelsDirty && !confirm("Finish header editing and discard the unsaved header-name changes?") || (state.headerEditEnabled || !state.inlineEditCode || confirm("Discard the unsaved row changes and start editing headers?")) && (state.directEditEnabled = !1, state.inlineEditCode = "", state.headerEditEnabled = !state.headerEditEnabled, state.headerLabelsDirty = !1, updateDirectEditButton(), updateHeaderEditButtons(), renderTable(), showToast(state.headerEditEnabled ? "Header editing is on. Rename a heading and choose Save headers." : "Header editing is off.")))
}

function updateHeaderEditButtons() {
  if (!refs.editHeadersButton) return;
  refs.editHeadersButton.classList.toggle("active", state.headerEditEnabled), refs.editHeadersButton.setAttribute("aria-pressed", String(state.headerEditEnabled)), refs.editHeadersButton.textContent = state.headerEditEnabled ? "Cancel header edit" : "Edit headers";
  const e = "admin" === state.role && state.headerEditEnabled;
  refs.saveHeadersButton.hidden = !e, refs.resetHeadersButton.hidden = !e, refs.saveHeadersButton.disabled = !state.headerLabelsDirty
}

function renderInlineCell(e, t, r) {
  const s = "Sl No." === t ? String(r) : null == e[t] ? "" : String(e[t]),
    o = columnVisualClass(t);
  if ("Sl No." === t || "AGE" === t) return `<td class="inline-readonly-cell${o?` ${o}`:""}" data-column-key="${escapeAttribute(t)}"><span class="inline-readonly" data-inline-calculated="${escapeAttribute(t)}">${escapeHtml(s||"—")}</span></td>`;
  if ("Strength Status" === t) return `<td class="${o}" data-column-key="${escapeAttribute(t)}">${inlineSelect(t,s,STRENGTH_STATUSES,!0)}</td>`;
  if ("Post Sensitivity" === t) return `<td class="${o}" data-column-key="${escapeAttribute(t)}">${inlineSelect(t,s,SENSITIVITY_VALUES,!0)}</td>`;
  const i = ["DoB", "DoR", "Relieving Date", "DoJ Govt", "DoJ in Current Office"].includes(t) ? "date" : "Email" === t ? "email" : "Mob" === t ? "tel" : "text",
    n = "date" === i ? toIsoDate(s) : s,
    a = ["Employee Name", "Employee Code"].includes(t) ? " required" : "",
    l = "Relieving Date" === t && isPresentStrengthStatus(strengthStatus(e)) ? " disabled" : "",
    d = inlineMaxLength(t),
    c = [];
  return ["REMARK ADMN", "Present/Permanent Address"].includes(t) && c.push("remarks-cell"), isLongDashboardTextColumn(t) && c.push("long-text-dashboard-column"), o && c.push(o), isLongDashboardTextColumn(t) ? `<td class="${c.join(" ")}" data-column-key="${escapeAttribute(t)}"><textarea class="inline-edit-input inline-long-text" data-inline-field="${escapeAttribute(t)}" rows="2" aria-label="${escapeAttribute(detailLabel(t))}"${a}${d?` maxlength="${d}"`:""}>${escapeHtml(n)}</textarea></td>` : `<td class="${c.join(" ")}" data-column-key="${escapeAttribute(t)}"><input class="inline-edit-input" type="${i}" data-inline-field="${escapeAttribute(t)}" value="${escapeAttribute(n)}" aria-label="${escapeAttribute(detailLabel(t))}"${a}${l}${d?` maxlength="${d}"`:""}></td>`
}

function handleInlineLongTextResize(e) {
  const t = e.target.closest(".inline-long-text");
  t && (t.style.height = "auto", t.style.height = `${t.scrollHeight}px`)
}

function inlineSelect(e, t, r, s) {
  const o = (t && !r.includes(t) ? [t].concat(r) : r).map(e => `<option value="${escapeAttribute(e)}"${e===t?" selected":""}>${escapeHtml(e)}</option>`).join("");
  return `<select class="inline-edit-select" data-inline-field="${escapeAttribute(e)}" aria-label="${escapeAttribute(detailLabel(e))}"${s?" required":""}><option value="">Select…</option>${o}</select>`
}

function inlineMaxLength(e) {
  return state.customColumns.some(t => t.key === e) ? 500 : {
    "Employee Name": 100,
    "Employee Code": 30,
    Designation: 80,
    Grp: 30,
    "REMARK ADMN": 500,
    Cat: 30,
    "Present/Permanent Address": 500,
    Mob: 15,
    Email: 120
  } [e] || 0
}

function statCardCatalog() {
  const e = state.employees,
    t = new Date,
    r = new Date(t.getFullYear() + 2, t.getMonth(), t.getDate()),
    s = {
      Present: "✓",
      "Present Oth Off": "P",
      Relieved: "R",
      "Relieved Oth Off": "R",
      Transferred: "T",
      "Transferred Oth Off": "T",
      Retired: "Rt",
      "Retired Oth Off": "Rt"
    },
    o = [{
      id: "total",
      icon: "👥",
      short: "Total",
      label: "Total employees",
      note: "Employee master",
      count: e.length
    }, {
      id: "present",
      icon: "✓",
      short: "Present",
      label: "Present strength",
      note: "Marked present",
      count: e.filter(e => isPresentStrengthStatus(strengthStatus(e))).length
    }, {
      id: "present-sensitive",
      icon: "S",
      short: "Sensitive",
      label: "Present · Sensitive",
      note: "Sensitive posts",
      count: e.filter(e => isPresentStrengthStatus(strengthStatus(e)) && "Sensitive" === sensitivityStatus(e)).length
    }, {
      id: "present-nonsensitive",
      icon: "NS",
      short: "Non-Sens.",
      label: "Present · Non-Sensitive",
      note: "Non-Sensitive posts",
      count: e.filter(e => isPresentStrengthStatus(strengthStatus(e)) && "Non-Sensitive" === sensitivityStatus(e)).length
    }, {
      id: "retiring-24",
      icon: "⌛",
      short: "Retiring",
      label: "Retiring in 24 months",
      note: "Based on DoR",
      count: e.filter(e => {
        const s = parseDate(e.DoR);
        return s && s >= t && s <= r
      }).length
    }];
  STRENGTH_STATUSES.forEach(t => {
    o.push({
      id: `strength-${t}`,
      icon: s[t] || t.charAt(0),
      short: t.length > 10 ? t.slice(0, 9) + "…" : t,
      label: `${t} employees`,
      note: "Strength status",
      count: e.filter(e => strengthStatus(e) === t).length
    })
  }), uniqueValues("Grp").forEach(e => {
    o.push({
      id: `group-${e}`,
      icon: e.charAt(0).toUpperCase(),
      short: `Grp ${e}`,
      label: `Group ${e} employees`,
      note: "Current records",
      count: state.employees.filter(t => String(t.Grp || "").trim() === e).length
    })
  }), uniqueValues("Cat").forEach(e => {
    o.push({
      id: `category-${e}`,
      icon: "C",
      short: `Cat ${e}`,
      label: `Category ${e} employees`,
      note: "Current records",
      count: state.employees.filter(t => String(t.Cat || "").trim() === e).length
    })
  });
  const i = ["blue", "teal", "rose", "aqua", "amber", "violet"];
  return o.map((e, t) => Object.assign({
    color: i[t % i.length]
  }, e))
}

function readStatCardSelection() {
  try {
    const e = JSON.parse(localStorage.getItem(STAT_CARD_STORAGE_KEY) || "null");
    return Array.isArray(e) && e.length ? e.slice(0, 6) : null
  } catch {
    return null
  }
}

function saveStatCardSelection(e) {
  try {
    localStorage.setItem(STAT_CARD_STORAGE_KEY, JSON.stringify(e))
  } catch {}
}

function statCardHtml(e) {
  return `<article class="stat-card ${e.color}"><div class="stat-icon">${escapeHtml(e.icon)}</div><div><span data-short="${escapeAttribute(e.short)}">${escapeHtml(e.label)}</span><strong>${e.count.toLocaleString("en-IN")}</strong><small>${escapeHtml(e.note)}</small></div></article>`
}

function updateStats() {
  if (!refs.statCardGrid) return;
  const e = statCardCatalog(),
    t = new Map(e.map(e => [e.id, e])),
    r = ["total", "present", "present-sensitive", "present-nonsensitive", "retiring-24", "group-B"];
  let s = (state.statCardSelection || readStatCardSelection() || r).filter(e => t.has(e));
  s.length || (s = r.filter(e => t.has(e))), s.length || (s = e.slice(0, 6).map(e => e.id)), state.statCardSelection = s, refs.statCardGrid.innerHTML = s.map(e => statCardHtml(t.get(e))).join("")
}

function openStatCardDialog() {
  renderStatCardOptions(), refs.statCardDialog.showModal()
}

function renderStatCardOptions() {
  const e = statCardCatalog(),
    t = new Set(state.statCardSelection || []);
  refs.statCardOptions.innerHTML = e.map(e => `<label class="stat-card-option${t.has(e.id)?" is-checked":""}"><input type="checkbox" value="${escapeAttribute(e.id)}"${t.has(e.id)?" checked":""}${!t.has(e.id)&&t.size>=6?" disabled":""}><span class="stat-card-option-icon">${escapeHtml(e.icon)}</span><span class="stat-card-option-text"><strong>${escapeHtml(e.label)}</strong><small>${e.count.toLocaleString("en-IN")} · ${escapeHtml(e.note)}</small></span></label>`).join(""), updateStatCardPickerSummary()
}

function updateStatCardPickerSummary() {
  const e = (state.statCardSelection || []).length;
  refs.statCardPickerSummary.textContent = `${e} of 6 selected`
}

function handleStatCardToggle(e) {
  const t = e.target.closest('input[type="checkbox"]');
  if (!t) return;
  let r = (state.statCardSelection || []).slice();
  t.checked ? r.length < 6 && r.push(t.value) : r = r.filter(e => e !== t.value), state.statCardSelection = r, saveStatCardSelection(r), updateStats(), renderStatCardOptions()
}

function resetStatCardSelection() {
  state.statCardSelection = null, localStorage.removeItem(STAT_CARD_STORAGE_KEY), updateStats(), renderStatCardOptions(), showToast("Default stat cards restored.")
}

function openReports() {
  resetReportForm(!1), generateReport(), refs.reportDialog.showModal(), setTimeout(() => refs.reportType.focus(), 30)
}

function openFilteredReport() {
  state.reportPrintColumns = null, refs.reportType.value = "filtered", updateReportControls(), generateReport(), refs.reportDialog.showModal(), setTimeout(() => refs.reportPrintButton.focus(), 30)
}

function currentFilterCriteria() {
  const e = [],
    t = refs.globalSearch.value.trim();
  return t && e.push(`Search contains “${t}”`), refs.groupFilter.value && e.push(`Group: ${refs.groupFilter.value}`), refs.categoryFilter.value && e.push(`Category: ${refs.categoryFilter.value}`), refs.statusFilter.value && e.push(`Strength Status: ${refs.statusFilter.value}`), refs.sensitivityFilter.value && e.push(`Post Sensitivity: ${refs.sensitivityFilter.value}`), state.columnFilterRules.forEach(t => e.push(`${columnLabel(t.column)} ${columnFilterOperatorLabel(t.operator).toLocaleLowerCase()}${columnFilterNeedsValue(t.operator)?` “${t.value}”`:""}`)), state.savedOrderRestored && e.push("Saved employee order restored"), e.length ? e.join(" · ") : "No dashboard filter applied; all employees are included."
}

function resetReportForm(e) {
  refs.reportForm.reset(), refs.reportType.value = "age", refs.reportReferenceDate.value = isoToday(), refs.reportAgeMin.value = "50", refs.reportAgeMax.value = "60", refs.reportFromDate.value = isoToday(), refs.reportToDate.value = toIsoLocal(addYears(new Date, 2)), refs.reportTextValue.value = "", initReportHeaderFooterFields(), initReportOrientationField(), initReportAlignmentField(), updateReportControls(), e && generateReport()
}

function updateReportControls() {
  const e = refs.reportType.value,
    t = "age" === e,
    r = Object.prototype.hasOwnProperty.call(DATE_REPORTS, e),
    s = ["strength", "sensitivity", "group", "category"].includes(e);
  if (state.reportPrintColumns = null, refs.reportPrintColumnsField && renderReportPrintColumnsOptions(), refs.reportReferenceField.hidden = !t, refs.reportAgeMinField.hidden = !t, refs.reportAgeMaxField.hidden = !t, refs.reportFromField.hidden = !r, refs.reportToField.hidden = !r, refs.reportValueField.hidden = !s, refs.reportTextField.hidden = "designation" !== e, !s) return;
  const o = {
    strength: {
      label: "Strength status",
      first: "All strength statuses",
      values: STRENGTH_STATUSES.concat("Not set")
    },
    sensitivity: {
      label: "Post sensitivity",
      first: "All post sensitivities",
      values: SENSITIVITY_VALUES.concat("Not set")
    },
    group: {
      label: "Employee group",
      first: "All groups",
      values: uniqueValues("Grp")
    },
    category: {
      label: "Employee category",
      first: "All categories",
      values: uniqueValues("Cat")
    }
  } [e];
  refs.reportValueLabel.textContent = o.label, populateSelect(refs.reportValue, o.values, o.first)
}

function applyReportPreset(e) {
  const t = e.currentTarget.dataset.reportPreset;
  "age-50-60" === t ? (refs.reportType.value = "age", updateReportControls(), refs.reportReferenceDate.value = isoToday(), refs.reportAgeMin.value = "50", refs.reportAgeMax.value = "60") : "retiring-2-years" === t ? (refs.reportType.value = "retirement", updateReportControls(), refs.reportFromDate.value = isoToday(), refs.reportToDate.value = toIsoLocal(addYears(new Date, 2))) : "present-strength" === t ? (refs.reportType.value = "strength", updateReportControls(), refs.reportValue.value = "Present") : "present-sensitive" === t ? (refs.reportType.value = "sensitivity", updateReportControls(), refs.reportValue.value = "Sensitive") : "present-non-sensitive" === t ? (refs.reportType.value = "sensitivity", updateReportControls(), refs.reportValue.value = "Non-Sensitive") : "filtered" === t ? (state.reportPrintColumns = null, refs.reportType.value = "filtered", updateReportControls()) : "not-present" === t && (refs.reportType.value = "not-present", updateReportControls()), generateReport()
}

function generateReport(e) {
  e && e.preventDefault();
  const t = refs.reportType.value,
    r = parseDate(refs.reportReferenceDate.value) || new Date,
    s = Number(refs.reportAgeMin.value),
    o = Number(refs.reportAgeMax.value),
    i = parseDate(refs.reportFromDate.value),
    n = parseDate(refs.reportToDate.value),
    a = refs.reportValue.value,
    l = refs.reportTextValue.value.trim().toLocaleLowerCase();
  if ("age" === t && (!Number.isFinite(s) || !Number.isFinite(o) || s < 0 || o > 100 || s > o)) return void showToast("Enter a valid age range from 0 to 100. Minimum age cannot exceed maximum age.", !0);
  if (Object.prototype.hasOwnProperty.call(DATE_REPORTS, t) && i && n && i > n) return void showToast("The From date cannot be after the To date.", !0);
  let d = ("filtered" === t ? state.filtered : state.employees).filter(e => {
    if ("filtered" === t) return !0;
    if ("age" === t) {
      const t = ageOnDate(e.DoB, r);
      return null != t && t >= s && t <= o
    }
    if (Object.prototype.hasOwnProperty.call(DATE_REPORTS, t)) {
      const r = parseDate(e[DATE_REPORTS[t].field]);
      return Boolean(r && (!i || r >= i) && (!n || r <= n))
    }
    return "strength" === t ? !a || strengthStatus(e) === a : "sensitivity" === t ? isPresentStrengthStatus(strengthStatus(e)) && (!a || sensitivityStatus(e) === a) : "not-present" === t ? !isPresentStrengthStatus(strengthStatus(e)) && "Not set" !== strengthStatus(e) : "group" === t ? !a || String(e.Grp || "") === a : "category" === t ? !a || String(e.Cat || "") === a : "designation" !== t || (!l || String(e.Designation || "").toLocaleLowerCase().includes(l))
  });
  d = d.slice(), "filtered" !== t && d.sort((e, s) => {
    if ("age" === t) {
      const t = ageOnDate(e.DoB, r) - ageOnDate(s.DoB, r);
      if (t) return t
    }
    if (Object.prototype.hasOwnProperty.call(DATE_REPORTS, t)) {
      const r = parseDate(e[DATE_REPORTS[t].field]),
        o = parseDate(s[DATE_REPORTS[t].field]);
      if (r && o && r.getTime() !== o.getTime()) return r - o
    }
    return String(e["Employee Name"] || "").localeCompare(String(s["Employee Name"] || ""), void 0, {
      sensitivity: "base"
    })
  });
  const c = describeReport(t, {
    referenceDate: r,
    minimumAge: s,
    maximumAge: o,
    fromDate: i,
    toDate: n,
    selectedValue: a,
    textValue: l
  });
  state.reportRows = d, state.reportColumns = reportColumns(t, r), state.reportTitle = c.title, state.reportCriteria = c.criteria, state.reportType = t, renderReport()
}

function describeReport(e, t) {
  const r = t.selectedValue || "All";
  if ("age" === e) return {
    title: `Employees aged ${t.minimumAge}–${t.maximumAge} on ${formatDate(toIsoLocal(t.referenceDate))}`,
    criteria: "Age is calculated from Date of Birth on the selected reference date. Both ages are included."
  };
  if (Object.prototype.hasOwnProperty.call(DATE_REPORTS, e)) {
    const r = reportPeriod(t.fromDate, t.toDate);
    return {
      title: `${DATE_REPORTS[e].title} ${r.title}`,
      criteria: `${DATE_REPORTS[e].field}: ${r.criteria}. Both boundary dates are included.`
    }
  }
  return "strength" === e ? {
    title: "All" === r ? "Employees by strength status" : `${r} employees`,
    criteria: "All" === r ? "All strength statuses are included." : `Strength Status is ${r}.`
  } : "sensitivity" === e ? {
    title: "All" === r ? "Present employees by post sensitivity" : `Present employees on ${r.toLowerCase()} posts`,
    criteria: "All" === r ? "All present employees are included, grouped by Post Sensitivity." : `Strength Status is Present and Post Sensitivity is ${r}.`
  } : "filtered" === e ? {
    title: state.savedOrderRestored ? "Saved Filter Employee Report" : "Filtered Employee Report",
    criteria: currentFilterCriteria()
  } : "not-present" === e ? {
    title: "Relieved, transferred and retired employees",
    criteria: "Employees not forming part of present strength, based on Strength Status."
  } : "group" === e ? {
    title: "All" === r ? "Group-wise employee report" : `${r} employees`,
    criteria: "All" === r ? "All employee groups are included." : `Employee group is ${r}.`
  } : "category" === e ? {
    title: "All" === r ? "Category-wise employee report" : `${r} category employees`,
    criteria: "All" === r ? "All employee categories are included." : `Employee category is ${r}.`
  } : "designation" === e ? {
    title: t.textValue ? `Employees with designation containing “${refs.reportTextValue.value.trim()}”` : "Designation-wise employee report",
    criteria: t.textValue ? "Designation contains the entered text." : "All designations are included."
  } : {
    title: "Complete employee list",
    criteria: "All employee records are included."
  }
}

function reportPeriod(e, t) {
  return e && t ? {
    title: `from ${formatDate(toIsoLocal(e))} to ${formatDate(toIsoLocal(t))}`,
    criteria: `${formatDate(toIsoLocal(e))} to ${formatDate(toIsoLocal(t))}`
  } : e ? {
    title: `on or after ${formatDate(toIsoLocal(e))}`,
    criteria: `On or after ${formatDate(toIsoLocal(e))}`
  } : t ? {
    title: `up to ${formatDate(toIsoLocal(t))}`,
    criteria: `Up to ${formatDate(toIsoLocal(t))}`
  } : {
    title: "for all recorded dates",
    criteria: "All recorded dates"
  }
}

function reportColumnCatalog(e, t) {
  const r = {
      key: "Sl No.",
      label: "Sl No.",
      get: (e, t) => t + 1
    },
    s = {
      label: "Employee Name",
      get: e => e["Employee Name"] || ""
    },
    o = {
      label: "Employee Code",
      get: e => e["Employee Code"] || ""
    },
    i = {
      label: "Designation",
      get: e => e.Designation || ""
    },
    n = {
      label: "Group",
      get: e => e.Grp || ""
    },
    a = {
      label: "Category",
      get: e => e.Cat || ""
    },
    l = {
      label: "Date of Birth",
      get: e => formatDate(e.DoB || "")
    },
    d = {
      label: "Date of Retirement",
      get: e => formatDate(e.DoR || "")
    },
    c = {
      label: "Strength Status",
      get: e => strengthStatus(e)
    },
    u = {
      label: "Post Sensitivity",
      get: e => sensitivityStatus(e)
    },
    m = {
      label: "Relieving / Exit Date",
      get: e => formatDate(e["Relieving Date"] || "")
    },
    p = {
      label: "Current Age",
      get: e => {
        const t = ageOnDate(e.DoB, new Date);
        return null == t ? "" : t
      }
    };
  if ("age" === e) {
    return [r, s, o, i, n, u, l, {
      label: `Age on ${formatDate(toIsoLocal(t))}`,
      get: e => ageOnDate(e.DoB, t)
    }, d, c]
  }
  if (Object.prototype.hasOwnProperty.call(DATE_REPORTS, e)) {
    const t = DATE_REPORTS[e].field;
    return [r, s, o, i, n, u, {
      label: detailLabel(t),
      get: e => formatDate(e[t] || "")
    }, c, "relieving" === e ? d : m]
  }
  return "sensitivity" === e ? [r, s, o, i, n, a, u, c] : "filtered" === e ? dashboardFullColumnCatalog() : [r, s, o, i, n, a, u, l, p, d, c, m]
}

function dashboardFullColumnCatalog() {
  const e = new Set(["DoB", "DoR", "DoJ Govt", "DoJ in Current Office", "Relieving Date"]);
  return frozenColumnsFirst(state.columns).map(t => ({
    key: t,
    label: columnLabel(t),
    get: (r, s) => {
      if ("Sl No." === t) return s + 1;
      if ("Strength Status" === t) return strengthStatus(r);
      if ("Post Sensitivity" === t) return sensitivityStatus(r);
      const o = null == r[t] ? "" : r[t];
      return e.has(t) ? formatDate(o) : o
    }
  }))
}

function reportColumns(e, t) {
  const r = reportColumnCatalog(e, t);
  if (Array.isArray(state.reportPrintColumns) && state.reportPrintColumns.length) {
    const s = new Set(state.reportPrintColumns),
      o = r.filter(e => s.has(e.label));
    if (o.length) return o
  }
  return r
}

function renderReportPrintColumnsOptions() {
  if (!refs.reportPrintColumnsOptions) return;
  const e = reportColumnCatalog(refs.reportType.value, parseDate(refs.reportReferenceDate.value) || new Date),
    t = new Set(effectiveReportPrintColumnLabels(e));
  refs.reportPrintColumnsOptions.innerHTML = e.map(e => `<label><input type="checkbox" value="${escapeAttribute(e.label)}"${t.has(e.label)?" checked":""}><span>${escapeHtml(e.label)}</span></label>`).join(""), updateReportPrintColumnsSummary(e)
}

function effectiveReportPrintColumnLabels(e) {
  if (Array.isArray(state.reportPrintColumns) && state.reportPrintColumns.length) {
    const t = new Set(e.map(e => e.label)),
      r = state.reportPrintColumns.filter(e => t.has(e));
    if (r.length) return r
  }
  return e.map(e => e.label)
}

function updateReportPrintColumnsSummary(e) {
  if (!refs.reportPrintColumnsSummary) return;
  const t = e || reportColumnCatalog(refs.reportType.value, parseDate(refs.reportReferenceDate.value) || new Date),
    r = effectiveReportPrintColumnLabels(t).length,
    s = t.length,
    o = Array.isArray(state.reportPrintColumns) && state.reportPrintColumns.length;
  refs.reportPrintColumnsSummary.textContent = o ? `${r} of ${s} columns selected` : `Using default columns (${r})`
}

function handleReportPrintColumnsChange() {
  if (!refs.reportPrintColumnsOptions) return;
  const e = [...refs.reportPrintColumnsOptions.querySelectorAll('input[type="checkbox"]:checked')].map(e => e.value);
  state.reportPrintColumns = e.length ? e : [], updateReportPrintColumnsSummary(), generateReport()
}

function selectAllReportPrintColumns() {
  const e = reportColumnCatalog(refs.reportType.value, parseDate(refs.reportReferenceDate.value) || new Date);
  state.reportPrintColumns = e.map(e => e.label), renderReportPrintColumnsOptions(), generateReport()
}

function resetReportPrintColumns() {
  state.reportPrintColumns = null, renderReportPrintColumnsOptions(), generateReport()
}

function renderReport() {
  const e = state.reportRows.length;
  refs.reportTitle.textContent = state.reportTitle, refs.reportCriteria.textContent = state.reportCriteria, refs.reportCount.textContent = `${e.toLocaleString("en-IN")} employee${1===e?"":"s"}`, refs.reportGeneratedAt.textContent = `Generated ${new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(new Date)}`, refs.reportTableHead.innerHTML = state.reportColumns.map(e => `<th class="${reportColumnClass(e.key||e.label)}" data-report-column-key="${escapeAttribute(e.key||e.label)}">${escapeHtml(e.label)}</th>`).join(""), refs.reportTableBody.innerHTML = state.reportRows.map((e, t) => `<tr>${state.reportColumns.map(r=>{const s=r.get(e,t),o=null==s||""===s?"—":s,i=r.key||r.label,n=reportColumnClass(i),c=escapeAttribute(i);return"Post Sensitivity"===i?`<td class="${n}" data-report-column-key="${c}"><span class="badge sensitivity ${sensitivityClass(o)}">${escapeHtml(o)}</span></td>`:"Strength Status"===i?`<td class="${n}" data-report-column-key="${c}"><span class="badge strength ${strengthClass(o)}">${escapeHtml(o)}</span></td>`:`<td class="${n}" data-report-column-key="${c}">${escapeHtml(o)}</td>`}).join("")}</tr>`).join(""), setupReportColumnResizeHandles(), applySavedReportColumnWidths(), refs.reportTableWrap.hidden = 0 === e, refs.reportEmptyState.hidden = 0 !== e, refs.reportExportButton.disabled = 0 === e, refs.reportPrintButton.disabled = 0 === e, refs.reportFooterSummary.textContent = e ? `${e.toLocaleString("en-IN")} matching employee${1===e?"":"s"} ready to print` : "No matching employees", applyReportAlignment()
}

function reportColumnClass(e) {
  return "Post Sensitivity" === e ? "report-sensitivity-column" : "Strength Status" === e ? "report-strength-column" : ""
}

function exportReportCsv() {
  if (!state.reportRows.length) return;
  const e = [state.reportColumns.map(e => e.label)].concat(state.reportRows.map((e, t) => state.reportColumns.map(r => r.get(e, t)))).map(e => e.map(csvEscape).join(",")).join("\r\n"),
    t = state.reportType.replace(/[^a-z0-9]+/gi, "_");
  downloadBlob(new Blob(["\ufeff" + e], {
    type: "text/csv;charset=utf-8"
  }), `ADG_HR_Report_${t}_${isoToday()}.csv`), showToast(`Exported ${state.reportRows.length} report row(s).`)
}

function printReport() {
  state.reportRows.length && (applyPrintOrientation(), refs.reportGeneratedAt.textContent = `Printed ${new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(new Date)}`, document.body.classList.add("printing-report"), window.print())
}

function ageOnDate(e, t) {
  const r = parseDate(e),
    s = t instanceof Date ? t : parseDate(t);
  if (!r || !s || r > s) return null;
  let o = s.getFullYear() - r.getFullYear();
  return (s.getMonth() < r.getMonth() || s.getMonth() === r.getMonth() && s.getDate() < r.getDate()) && (o -= 1), o >= 0 ? o : null
}

function addYears(e, t) {
  const r = new Date(e.getFullYear() + t, e.getMonth(), e.getDate());
  return r.getMonth() !== e.getMonth() && r.setDate(0), r
}

function handleTableAction(e) {
  const t = e.target.closest("[data-action]");
  if (t) {
    if ("admin" !== state.role) return;
    const e = findEmployee(t.dataset.code);
    if (!e) return;
    return "move-up" === t.dataset.action && moveFilteredEmployee(t.dataset.code, -1), "move-down" === t.dataset.action && moveFilteredEmployee(t.dataset.code, 1), "inline-edit" === t.dataset.action && beginInlineEdit(e), "inline-work" === t.dataset.action && openInlinePendingWork(e, t.closest("tr")), "inline-save" === t.dataset.action && saveInlineEmployee(t.dataset.code, t.closest("tr"), t), "inline-cancel" === t.dataset.action && cancelInlineEdit(), "edit" === t.dataset.action && openEmployeeDialog(e), void("delete" === t.dataset.action && deleteEmployee(e))
  }
  const r = e.target.closest("[data-employee-code]");
  r && !e.target.closest("input, select, textarea") && openEmployeeDetails(findEmployee(r.dataset.employeeCode))
}

function handleTableKeydown(e) {
  if (!["Enter", " "].includes(e.key) || e.target.closest("button, input, select, textarea")) return;
  const t = e.target.closest("[data-employee-code]");
  t && (e.preventDefault(), openEmployeeDetails(findEmployee(t.dataset.employeeCode)))
}

function beginInlineEdit(e) {
  const t = String(e["Employee Code"] || "");
  if (state.inlineEditCode && state.inlineEditCode !== t && !confirm("Discard the unsaved changes in the other row?")) return;
  state.inlineEditCode = t, renderTable();
  const r = refs.tableBody.querySelector(`[data-employee-code="${cssEscape(t)}"]`),
    s = r && r.querySelector("input, select");
  s && s.focus()
}

function cancelInlineEdit() {
  state.inlineEditCode = "", renderTable(), showToast("Row changes discarded.")
}

function handleInlineFieldChange(e) {
  const t = e.target.closest("[data-inline-field]");
  if (!t) return;
  const r = t.closest("tr");
  if (r) {
    if ("Strength Status" === t.dataset.inlineField) {
      const e = r.querySelector('[data-inline-field="Relieving Date"]');
      if (e) {
        const r = !isPresentStrengthStatus(t.value);
        e.disabled = !r, e.required = r, r || (e.value = "")
      }
    }
    if ("DoB" === t.dataset.inlineField) {
      const e = r.querySelector('[data-inline-calculated="AGE"]');
      e && (e.textContent = calculateAge(t.value) || "—")
    }
  }
}

function inlineEmployeeValue(e, t, r) {
  if (!r) return "";
  const s = e && e.querySelector(`[data-inline-field="${cssEscape(r)}"]`);
  return String(s ? s.value || "" : t && t[r] || "")
}

function setInlineEmployeeValue(e, t, r) {
  if (!e || !t) return null;
  let s = e.querySelector(`[data-inline-field="${cssEscape(t)}"]`);
  return s || (s = document.createElement("input"), s.type = "hidden", s.dataset.inlineField = t, (e.querySelector(".inline-actions") || e.lastElementChild || e).appendChild(s)), s.value = String(r || ""), s.classList.contains("inline-long-text") && (s.style.height = "auto", s.style.height = `${s.scrollHeight}px`), s
}

function openInlinePendingWork(e, t) {
  const r = pendingWorkColumnKey();
  if (!r || !t) return void showToast("Add a custom column named Pending Work or Pending Works first.", !0);
  const s = pendingWorkItems(inlineEmployeeValue(t, e, r)),
    o = completedWorkHistoryColumnKey(),
    i = o ? completedWorkHistoryItems(inlineEmployeeValue(t, e, o)) : [];
  state.inlineWorkTargetCode = String(e["Employee Code"] || ""), refs.inlineWorkEmployeeName.textContent = e["Employee Name"] || state.inlineWorkTargetCode || "Employee", refs.inlineWorkNote.textContent = s.length ? "Tick every work item that is finished. It will be removed from Pending Works and added to the dated completed history." : "No pending work item is currently entered in this row. Enter one item per line in Pending Works first.", refs.inlineWorkItemList.innerHTML = s.length ? s.map((e, t) => `\n    <label class="pending-work-check-row">\n      <input type="checkbox" data-inline-pending-work-index="${t}">\n      <span>${escapeHtml(e)}</span>\n    </label>\n  `).join("") : '<p class="pending-work-archive-empty">No unfinished work is recorded in this row.</p>', refs.inlineWorkHistoryCount.textContent = `${i.length} hidden item${1===i.length?"":"s"}`, refs.inlineWorkHistoryList.innerHTML = i.length ? `<ol>${i.map(e=>`<li>${escapeHtml(e)}</li>`).join("")}</ol>` : '<p class="pending-work-archive-empty">No completed work has been archived.</p>', refs.inlineWorkError.textContent = "", updateInlineMoveWorkButton(), refs.inlineWorkDialog.showModal()
}

function updateInlineMoveWorkButton() {
  const e = refs.inlineWorkItemList.querySelectorAll("[data-inline-pending-work-index]:checked").length;
  refs.inlineMoveWorkButton.disabled = 0 === e, refs.inlineMoveWorkButton.textContent = e ? `✓ Move ${e} selected into completed` : "✓ Move selected into completed"
}
async function moveInlineSelectedWork() {
  const e = state.inlineWorkTargetCode,
    t = findEmployee(e),
    r = refs.tableBody.querySelector(`[data-employee-code="${cssEscape(e)}"]`),
    s = pendingWorkColumnKey(),
    o = new Set([...refs.inlineWorkItemList.querySelectorAll("[data-inline-pending-work-index]:checked")].map(e => Number(e.dataset.inlinePendingWorkIndex)));
  if (t && r && state.inlineEditCode === e && s && o.size) {
    setButtonBusy(refs.inlineMoveWorkButton, !0, "Moving…"), refs.inlineWorkError.textContent = "";
    try {
      const e = await ensureCompletedWorkHistoryColumn(),
        i = pendingWorkItems(inlineEmployeeValue(r, t, s)),
        n = i.filter((e, t) => o.has(t)),
        a = i.filter((e, t) => !o.has(t));
      if (!n.length) throw new Error("Choose at least one current Pending Works item.");
      const l = formatDate(isoToday()),
        d = n.map(e => `Completed on ${l} — ${e}`),
        c = completedWorkHistoryItems(inlineEmployeeValue(r, t, e)),
        u = d.concat(c).join("\n");
      if (u.length > 500) throw new Error("Completed Work History can hold 500 characters. Remove or export older history before moving more work.");
      setInlineEmployeeValue(r, s, a.join("\n")), setInlineEmployeeValue(r, e, u);
      const m = r.querySelector('[data-action="inline-work"]');
      m && (m.textContent = `Moved ${n.length} · Save row`, m.classList.add("has-work-draft")), refs.inlineWorkDialog.close(), showToast(`${n.length} finished work item${1===n.length?"":"s"} moved in this filtered row. Choose Save to keep the change.`)
    } catch (e) {
      refs.inlineWorkError.textContent = friendlyError(e)
    } finally {
      setButtonBusy(refs.inlineMoveWorkButton, !1, "✓ Move selected into completed"), updateInlineMoveWorkButton()
    }
  } else refs.inlineWorkError.textContent = "The filtered row is no longer available. Close this window and choose Edit filtered row again."
}
async function saveInlineEmployee(e, t, r) {
  if (!t) return;
  const s = [...t.querySelectorAll("[data-inline-field]")],
    o = s.find(e => !e.checkValidity());
  if (o) return void o.reportValidity();
  const i = findEmployee(e);
  if (!i) return void showToast("The employee record is no longer available. Refresh and try again.", !0);
  const n = {};
  if (state.columns.forEach(e => {
      n[e] = null == i[e] ? "" : String(i[e])
    }), s.forEach(e => {
      n[e.dataset.inlineField] = e.value.trim()
    }), n["Employee Name"] && n["Employee Code"]) {
    if (isPresentStrengthStatus(n["Strength Status"]) && (n["Relieving Date"] = ""), !isPresentStrengthStatus(n["Strength Status"]) && !n["Relieving Date"]) {
      showToast("Relieving date is required for relieved, transferred or retired employees, including Other Office statuses.", !0);
      const e = t.querySelector('[data-inline-field="Relieving Date"]');
      return void(e && e.focus())
    }
    setButtonBusy(r, !0, "Saving…");
    try {
      await apiRequest("saveEmployee", {
        employee: n,
        originalEmployeeCode: e
      }), state.inlineEditCode = "", showToast("Employee row updated."), await loadEmployees()
    } catch (e) {
      showToast(friendlyError(e), !0)
    } finally {
      r.isConnected && setButtonBusy(r, !1, "Save")
    }
  } else showToast("Employee name and employee code are required.", !0)
}
async function openWorkDiary() {
  refs.diaryEntryError.textContent = "", refs.diaryEmployeeSuggestions.innerHTML = state.employees.map(e => `<option value="${escapeAttribute(e["Employee Name"]||e["Employee Code"]||"")}"></option>`).join(""), refs.diaryEntryDate.value || (refs.diaryEntryDate.value = (new Date).toISOString().slice(0, 10)), refs.workDiaryDialog.open || refs.workDiaryDialog.showModal();
  try {
    const e = await apiRequest("getDiaryEntries", {});
    state.diaryEntries = Array.isArray(e.entries) ? e.entries : [], populateDiaryFilters(), renderDiaryEntries()
  } catch (e) {
    refs.diaryEntryError.textContent = friendlyError(e)
  }
}

function populateDiaryFilters() {
  const e = [...new Set(state.diaryEntries.map(e => String(e.entryDate || "").slice(0, 7)).filter(Boolean))].sort().reverse(),
    t = [...new Set(state.diaryEntries.map(e => e.category).filter(Boolean))].sort(),
    r = [...new Set(state.diaryEntries.map(e => e.source).filter(Boolean))].sort(),
    s = refs.diaryMonthFilter.value,
    o = refs.diaryCategoryFilter.value,
    i = refs.diarySourceFilter.value;
  refs.diaryMonthFilter.innerHTML = '<option value="">All months</option>' + e.map(e => `<option value="${escapeAttribute(e)}">${escapeHtml(new Date(`${e}-01T00:00:00`).toLocaleDateString("en-IN",{month:"long",year:"numeric"}))}</option>`).join(""), refs.diaryCategoryFilter.innerHTML = '<option value="">All categories</option>' + t.map(e => `<option>${escapeHtml(e)}</option>`).join(""), refs.diarySourceFilter.innerHTML = '<option value="">All sources</option>' + r.map(e => `<option>${escapeHtml(e)}</option>`).join(""), e.includes(s) && (refs.diaryMonthFilter.value = s), t.includes(o) && (refs.diaryCategoryFilter.value = o), r.includes(i) && (refs.diarySourceFilter.value = i)
}

function diaryFilteredEntries() {
  const e = refs.diarySearch.value.trim().toLowerCase(),
    t = refs.diaryMonthFilter.value,
    r = refs.diaryCategoryFilter.value,
    s = refs.diarySourceFilter.value;
  return state.diaryEntries.filter(o => !(t && !String(o.entryDate).startsWith(t)) && ((!r || o.category === r) && ((!s || o.source === s) && (!("learning" === state.diaryView && !o.learning) && !(e && ![o.title, o.details, o.category, o.tags, o.relatedEmployee, o.source, o.createdBy].join(" ").toLowerCase().includes(e))))))
}

function renderDiaryEntries() {
  document.querySelectorAll("[data-diary-view]").forEach(e => e.classList.toggle("active", e.dataset.diaryView === state.diaryView));
  let e = diaryFilteredEntries();
  if ("recent" === state.diaryView && (e = e.slice(0, Number(refs.diaryRecentLimit.value) || 5)), refs.diaryLearningCount.textContent = `${state.diaryEntries.filter(e=>e.learning).length} learnings`, refs.diaryResultSummary.textContent = "recent" === state.diaryView ? `Latest ${e.length} entries` : `${e.length} matching entries`, refs.diaryEmptyState.hidden = e.length > 0, "monthly" === state.diaryView) {
    const t = e.reduce((e, t) => {
      const r = String(t.entryDate).slice(0, 7) || "Undated";
      return (e[r] || (e[r] = [])).push(t), e
    }, {});
    refs.diaryEntryList.innerHTML = Object.entries(t).map(([e, t]) => `<section class="diary-group"><h3>${escapeHtml("Undated"===e?e:new Date(`${e}-01T00:00:00`).toLocaleDateString("en-IN",{month:"long",year:"numeric"}))}<span>${t.length}</span></h3>${t.map(diaryEntryMarkup).join("")}</section>`).join("")
  } else if ("daily" === state.diaryView) {
    const t = e.reduce((e, t) => {
      const r = t.entryDate || "Undated";
      return (e[r] || (e[r] = [])).push(t), e
    }, {});
    refs.diaryEntryList.innerHTML = Object.entries(t).map(([e, t]) => `<section class="diary-group"><h3>${escapeHtml("Undated"===e?e:formatDate(e))}<span>${t.length}</span></h3>${t.map(diaryEntryMarkup).join("")}</section>`).join("")
  } else refs.diaryEntryList.innerHTML = e.map(diaryEntryMarkup).join("")
}

function diaryEntryMarkup(e) {
  const t = "admin" === state.role || e.createdBy === state.username,
    r = `${e.learning?'<span class="diary-badge learning">💡 Learning</span>':""}${e.important?'<span class="diary-badge important">★ Important</span>':""}<span class="diary-badge source">${escapeHtml(e.source||"Manual")}</span>`;
  return `<article class="diary-card${e.important?" is-important":""}"><header><time>${escapeHtml(formatDate(e.entryDate))}</time><div>${r}</div></header><h4>${escapeHtml(e.title)}</h4><p>${escapeHtml(e.details)}</p><div class="diary-meta">${e.category?`<span>${escapeHtml(e.category)}</span>`:""}${e.tags?`<span># ${escapeHtml(e.tags)}</span>`:""}${e.relatedEmployee?`<span>👤 ${escapeHtml(e.relatedEmployee)}</span>`:""}${e.createdBy?`<span>By ${escapeHtml(e.createdBy)}</span>`:""}</div><footer>${e.link?`<a href="${escapeAttribute(e.link)}" target="_blank" rel="noopener">Open link ↗</a>`:"<span></span>"}${t?`<div><button type="button" data-edit-diary="${escapeAttribute(e.id)}">Edit</button><button type="button" class="delete" data-delete-diary="${escapeAttribute(e.id)}">Delete</button></div>`:""}</footer></article>`
}
async function saveDiaryEntry(e) {
  e.preventDefault(), refs.diaryEntryError.textContent = "";
  const t = {
    id: state.diaryEditId,
    entryDate: refs.diaryEntryDate.value,
    title: refs.diaryEntryTitle.value.trim(),
    details: refs.diaryEntryDetails.value.trim(),
    category: refs.diaryEntryCategory.value,
    tags: refs.diaryEntryTags.value.trim(),
    relatedEmployee: refs.diaryEntryEmployee.value.trim(),
    link: refs.diaryEntryLink.value.trim(),
    visibility: refs.diaryEntryVisibility.value,
    learning: refs.diaryEntryLearning.checked,
    important: refs.diaryEntryImportant.checked
  };
  setButtonBusy(refs.saveDiaryEntryButton, !0, "Saving…");
  try {
    const e = await apiRequest("saveDiaryEntry", t);
    state.diaryEntries = e.entries || [], resetDiaryForm(), populateDiaryFilters(), renderDiaryEntries(), showToast("Diary entry saved.")
  } catch (e) {
    refs.diaryEntryError.textContent = friendlyError(e)
  } finally {
    setButtonBusy(refs.saveDiaryEntryButton, !1, "Save diary entry")
  }
}

function handleDiaryAction(e) {
  const t = e.target.closest("[data-edit-diary]"),
    r = e.target.closest("[data-delete-diary]");
  t && editDiaryEntry(t.dataset.editDiary), r && deleteDiaryEntry(r.dataset.deleteDiary)
}

function editDiaryEntry(e) {
  const t = state.diaryEntries.find(t => t.id === e);
  t && (state.diaryEditId = e, refs.diaryEntryId.value = e, refs.diaryEntryDate.value = t.entryDate, refs.diaryEntryTitle.value = t.title, refs.diaryEntryDetails.value = t.details, refs.diaryEntryCategory.value = t.category || "Work", refs.diaryEntryTags.value = t.tags || "", refs.diaryEntryEmployee.value = t.relatedEmployee || "", refs.diaryEntryLink.value = t.link || "", refs.diaryEntryVisibility.value = t.visibility || "Private", refs.diaryEntryLearning.checked = Boolean(t.learning), refs.diaryEntryImportant.checked = Boolean(t.important), refs.diaryFormHeading.textContent = "Edit diary entry", refs.cancelDiaryEditButton.hidden = !1, refs.diaryEntryTitle.focus())
}
async function deleteDiaryEntry(e) {
  const t = state.diaryEntries.find(t => t.id === e);
  if (t && confirm(`Delete diary entry “${t.title}”?`)) try {
    const t = await apiRequest("deleteDiaryEntry", {
      id: e
    });
    state.diaryEntries = t.entries || [], populateDiaryFilters(), renderDiaryEntries(), showToast("Diary entry deleted.")
  } catch (e) {
    showToast(friendlyError(e), !0)
  }
}

function resetDiaryForm() {
  state.diaryEditId = "", refs.diaryEntryForm.reset(), refs.diaryEntryDate.value = (new Date).toISOString().slice(0, 10), refs.diaryEntryVisibility.value = "Private", refs.diaryFormHeading.textContent = "New diary entry", refs.cancelDiaryEditButton.hidden = !0, refs.diaryEntryError.textContent = ""
}

function clearDiaryFilters() {
  refs.diarySearch.value = "", refs.diaryMonthFilter.value = "", refs.diaryCategoryFilter.value = "", refs.diarySourceFilter.value = "", state.diaryView = "recent", renderDiaryEntries()
}
async function openFileRegister() {
  refs.fileRecordError.textContent = "", refs.fileRegisterDialog.open || refs.fileRegisterDialog.showModal();
  try {
    const [e, t] = await Promise.all([apiRequest("getFileRecords", {}), apiRequest("getFileRegisterSettings", {})]);
    state.fileRecords = e.records || [], refs.fileRegisterStorageNote.textContent = t.usesMainSpreadsheet ? "Using the File Register tab in the HR spreadsheet." : "Connected to a separate Google Sheet.", renderFileRecords()
  } catch (e) {
    refs.fileRecordError.textContent = friendlyError(e)
  }
}

function renderFileRecords() {
  const e = refs.fileRecordSearch.value.trim().toLowerCase(),
    t = refs.fileRecordStatusFilter.value,
    r = state.fileRecords.filter(r => (!t || r.status === t) && (!e || [r.fileNo, r.subject, r.category, r.section, r.status, r.remarks].join(" ").toLowerCase().includes(e)));
  refs.fileRecordSummary.textContent = `${r.length} file record${1===r.length?"":"s"}`, refs.fileRecordEmpty.hidden = r.length > 0, refs.fileRecordList.innerHTML = r.map(e => `<article class="file-record-card"><div class="file-number">${escapeHtml(e.fileNo)}</div><div class="file-record-main"><strong>${escapeHtml(e.subject)}</strong><p>${escapeHtml(e.remarks||"")}</p><small>${[e.category,e.section,e.status].filter(Boolean).map(escapeHtml).join(" · ")}</small></div><div class="file-record-actions">${e.fileLink?`<a href="${escapeAttribute(e.fileLink)}" target="_blank" rel="noopener">Open ↗</a>`:""}${"admin"===state.role?`<button data-edit-file-record="${escapeAttribute(e.id)}">Edit</button><button class="delete" data-delete-file-record="${escapeAttribute(e.id)}">Delete</button>`:""}</div></article>`).join("")
}
async function saveFileRecord(e) {
  e.preventDefault(), refs.fileRecordError.textContent = "";
  const t = {
    id: state.fileRecordEditId,
    fileNo: refs.fileRecordNo.value.trim(),
    subject: refs.fileRecordSubject.value.trim(),
    category: refs.fileRecordCategory.value.trim(),
    section: refs.fileRecordSection.value.trim(),
    status: refs.fileRecordStatus.value,
    remarks: refs.fileRecordRemarks.value.trim(),
    fileLink: refs.fileRecordLink.value.trim()
  };
  setButtonBusy(refs.saveFileRecordButton, !0, "Saving…");
  try {
    const e = await apiRequest("saveFileRecord", t);
    state.fileRecords = e.records || [], resetFileRecordForm(), renderFileRecords(), showToast("File record saved.")
  } catch (e) {
    refs.fileRecordError.textContent = friendlyError(e)
  } finally {
    setButtonBusy(refs.saveFileRecordButton, !1, "Save file record")
  }
}

function handleFileRecordAction(e) {
  const t = e.target.closest("[data-edit-file-record]"),
    r = e.target.closest("[data-delete-file-record]");
  t && editFileRecord(t.dataset.editFileRecord), r && deleteFileRecord(r.dataset.deleteFileRecord)
}

function editFileRecord(e) {
  const t = state.fileRecords.find(t => t.id === e);
  t && (state.fileRecordEditId = e, refs.fileRecordId.value = e, refs.fileRecordNo.value = t.fileNo, refs.fileRecordSubject.value = t.subject, refs.fileRecordCategory.value = t.category || "", refs.fileRecordSection.value = t.section || "", refs.fileRecordStatus.value = t.status || "Active", refs.fileRecordRemarks.value = t.remarks || "", refs.fileRecordLink.value = t.fileLink || "", refs.fileRecordFormHeading.textContent = "Edit file record", refs.cancelFileRecordEditButton.hidden = !1, refs.fileRecordNo.focus())
}
async function deleteFileRecord(e) {
  const t = state.fileRecords.find(t => t.id === e);
  if (t && confirm(`Delete File No. ${t.fileNo}?`)) try {
    const t = await apiRequest("deleteFileRecord", {
      id: e
    });
    state.fileRecords = t.records || [], renderFileRecords(), showToast("File record deleted.")
  } catch (e) {
    showToast(friendlyError(e), !0)
  }
}

function resetFileRecordForm() {
  state.fileRecordEditId = "", refs.fileRecordForm.reset(), refs.fileRecordStatus.value = "Active", refs.fileRecordFormHeading.textContent = "Add file record", refs.cancelFileRecordEditButton.hidden = !0, refs.fileRecordError.textContent = ""
}

function cssEscape(e) {
  return window.CSS && "function" == typeof window.CSS.escape ? window.CSS.escape(e) : String(e).replace(/["\\]/g, "\\$&")
}

function findEmployee(e) {
  return state.employees.find(t => t["Employee Code"] === e)
}
async function openStickyNotes() {
  refs.stickyNoteError.textContent = "", refs.stickyNotesDialog.open || refs.stickyNotesDialog.showModal();
  try {
    await loadStickyNotes()
  } catch (e) {
    refs.stickyNoteError.textContent = friendlyError(e)
  }
}
async function loadStickyNotes() {
  if (!state.token) return;
  const e = await apiRequest("getStickyNotes", {});
  state.stickyNotes = Array.isArray(e.notes) ? e.notes : [], renderStickyNotes()
}

function renderStickyNotes() {
  const e = state.stickyNotes.filter(e => "Completed" !== e.status),
    t = state.stickyNotes.filter(e => "Completed" === e.status);
  refs.stickyActiveCount.textContent = String(e.length), refs.stickyActiveSummary.textContent = `${e.length} active note${1===e.length?"":"s"}`, refs.stickyCompletedCount.textContent = String(t.length), refs.stickyActiveEmpty.hidden = e.length > 0, refs.stickyCompletedEmpty.hidden = t.length > 0, refs.stickySideCount.textContent = String(e.length), refs.stickyActiveList.innerHTML = e.map(e => stickyNoteMarkup(e, !1)).join(""), refs.stickyCompletedList.innerHTML = t.map(e => stickyNoteMarkup(e, !0)).join(""), renderStickyFocusNote()
}

function stickyNoteMarkup(e, t) {
  const r = ["yellow", "pink", "blue", "green", "purple", "orange"].includes(e.colour) ? e.colour : "yellow",
    s = e.dueDate ? `<span class="sticky-due">Due ${escapeHtml(formatDate(e.dueDate))}</span>` : '<span class="sticky-due no-date">No due date</span>',
    o = t ? `<small>Completed ${escapeHtml(e.completedAt||"")} ${e.completedBy?`by ${escapeHtml(e.completedBy)}`:""}</small>` : "",
    i = t ? "" : `<button class="sticky-mini-btn pin${state.stickyFocusId===e.id?" is-pinned":""}" type="button" data-pin-sticky-note="${escapeAttribute(e.id)}" aria-pressed="${state.stickyFocusId===e.id}">📌 ${state.stickyFocusId===e.id?"Pinned":"Keep open"}</button>`,
    n = "admin" === state.role ? `${t?"":`<button class="sticky-mini-btn edit" type="button" data-edit-sticky-note="${escapeAttribute(e.id)}">Edit</button><button class="sticky-complete-btn" type="button" data-complete-sticky-note="${escapeAttribute(e.id)}">✓ Completed</button>`}<button class="sticky-mini-btn delete" type="button" data-delete-sticky-note="${escapeAttribute(e.id)}">Delete</button>` : "",
    a = i || n ? `<div class="sticky-card-actions">${i}${n}</div>` : "";
  return `<article class="sticky-note-card ${r}${t?" is-completed":""}"><header><span>${escapeHtml(e.type||"Reminder")}</span>${s}</header><h4>${escapeHtml(e.title||"Untitled note")}</h4>${e.details?`<p>${escapeHtml(e.details)}</p>`:""}<footer>${o}${a}</footer></article>`
}
async function saveStickyNote(e) {
  e.preventDefault(), refs.stickyNoteError.textContent = "";
  const t = refs.stickyNoteForm.querySelector('input[name="stickyColour"]:checked'),
    r = {
      id: state.stickyEditId,
      type: refs.stickyNoteType.value,
      title: refs.stickyNoteTitle.value.trim(),
      details: refs.stickyNoteDetails.value.trim(),
      dueDate: refs.stickyNoteDueDate.value,
      colour: t ? t.value : "yellow"
    };
  if (!r.title) return refs.stickyNoteError.textContent = "Enter a title for the target or reminder.", void refs.stickyNoteTitle.focus();
  const s = Boolean(state.stickyEditId);
  setButtonBusy(refs.saveStickyNoteButton, !0, s ? "Updating…" : "Saving…");
  try {
    const e = await apiRequest("saveStickyNote", r);
    state.stickyNotes = Array.isArray(e.notes) ? e.notes : state.stickyNotes, cancelStickyEdit(), renderStickyNotes(), showToast(s ? "Target / reminder updated." : "Target / reminder saved.")
  } catch (e) {
    refs.stickyNoteError.textContent = friendlyError(e)
  } finally {
    setButtonBusy(refs.saveStickyNoteButton, !1, state.stickyEditId ? "Update note" : "Save note")
  }
}

function handleStickyNoteAction(e) {
  const t = e.target.closest("[data-pin-sticky-note]");
  if (t) return pinStickyFocus(t.dataset.pinStickyNote);
  const r = e.target.closest("[data-edit-sticky-note]");
  if (r) return editStickyNote(r.dataset.editStickyNote);
  const s = e.target.closest("[data-complete-sticky-note]");
  if (s) return completeStickyNote(s);
  const o = e.target.closest("[data-delete-sticky-note]");
  return o ? deleteStickyNote(o) : void 0
}

function readStickyFocusId() {
  try {
    return localStorage.getItem(STICKY_FOCUS_ID_STORAGE_KEY) || ""
  } catch {
    return ""
  }
}

function readStickyFocusCollapsed() {
  try {
    return "1" === localStorage.getItem(STICKY_FOCUS_COLLAPSED_STORAGE_KEY)
  } catch {
    return !1
  }
}

function readStickyFocusLayout() {
  try {
    const e = JSON.parse(localStorage.getItem(STICKY_FOCUS_LAYOUT_STORAGE_KEY) || "{}");
    return {
      size: Number.isInteger(e.size) ? Math.max(0, Math.min(STICKY_FOCUS_SIZES.length - 1, e.size)) : 1,
      x: Number.isFinite(e.x) ? e.x : null,
      y: Number.isFinite(e.y) ? e.y : null,
      width: Number.isFinite(e.width) ? e.width : null,
      height: Number.isFinite(e.height) ? e.height : null
    }
  } catch {
    return {
      size: 1,
      x: null,
      y: null,
      width: null,
      height: null
    }
  }
}

function saveStickyFocusPreference() {
  try {
    state.stickyFocusId ? localStorage.setItem(STICKY_FOCUS_ID_STORAGE_KEY, state.stickyFocusId) : localStorage.removeItem(STICKY_FOCUS_ID_STORAGE_KEY), localStorage.setItem(STICKY_FOCUS_COLLAPSED_STORAGE_KEY, state.stickyFocusCollapsed ? "1" : "0"), localStorage.setItem(STICKY_FOCUS_LAYOUT_STORAGE_KEY, JSON.stringify(state.stickyFocusLayout))
  } catch {}
}

function readStickySideTabLayout() {
  try {
    const e = JSON.parse(localStorage.getItem(STICKY_SIDE_TAB_LAYOUT_STORAGE_KEY) || "{}");
    return {
      x: Number.isFinite(e.x) ? e.x : null,
      y: Number.isFinite(e.y) ? e.y : null
    }
  } catch {
    return {
      x: null,
      y: null
    }
  }
}

function saveStickySideTabLayout() {
  try {
    localStorage.setItem(STICKY_SIDE_TAB_LAYOUT_STORAGE_KEY, JSON.stringify(state.stickySideTabLayout))
  } catch {}
}

function applyStickySideTabLayout() {
  if (!refs.stickySideTab || refs.stickySideTab.hidden) return;
  const e = Number.isFinite(state.stickySideTabLayout.x) && Number.isFinite(state.stickySideTabLayout.y);
  if (refs.stickySideTab.classList.toggle("is-dragged", e), !e) return refs.stickySideTab.style.removeProperty("left"), refs.stickySideTab.style.removeProperty("top"), refs.stickySideTab.style.removeProperty("right"), void refs.stickySideTab.style.removeProperty("bottom");
  const t = refs.stickySideTab.getBoundingClientRect(),
    r = Math.max(8, window.innerWidth - t.width - 8),
    s = Math.max(8, window.innerHeight - t.height - 8),
    o = Math.max(8, Math.min(r, state.stickySideTabLayout.x)),
    i = Math.max(8, Math.min(s, state.stickySideTabLayout.y));
  state.stickySideTabLayout.x = o, state.stickySideTabLayout.y = i, refs.stickySideTab.style.left = `${o}px`, refs.stickySideTab.style.top = `${i}px`, refs.stickySideTab.style.right = "auto", refs.stickySideTab.style.bottom = "auto"
}

function startStickySideTabDrag(e) {
  if ("mouse" === e.pointerType && 0 !== e.button) return;
  const t = refs.stickySideTab.getBoundingClientRect();
  state.stickySideTabDrag = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    originX: t.left,
    originY: t.top,
    moved: !1
  }, state.stickySideTabLayout.x = t.left, state.stickySideTabLayout.y = t.top, refs.stickySideTab.classList.add("is-dragged");
  try {
    refs.stickySideTab.setPointerCapture(e.pointerId)
  } catch {}
  document.body.classList.add("sticky-focus-dragging"), e.preventDefault()
}

function moveStickySideTabDrag(e) {
  const t = state.stickySideTabDrag;
  if (!t || t.pointerId !== e.pointerId) return;
  const r = refs.stickySideTab.getBoundingClientRect(),
    s = Math.max(8, window.innerWidth - r.width - 8),
    o = Math.max(8, window.innerHeight - r.height - 8),
    i = Math.max(8, Math.min(s, t.originX + e.clientX - t.startX)),
    n = Math.max(8, Math.min(o, t.originY + e.clientY - t.startY));
  (Math.abs(e.clientX - t.startX) > 3 || Math.abs(e.clientY - t.startY) > 3) && (t.moved = !0), state.stickySideTabLayout.x = i, state.stickySideTabLayout.y = n, refs.stickySideTab.style.left = `${i}px`, refs.stickySideTab.style.top = `${n}px`, refs.stickySideTab.style.right = "auto", refs.stickySideTab.style.bottom = "auto", e.preventDefault()
}

function endStickySideTabDrag(e) {
  const t = state.stickySideTabDrag;
  if (t && t.pointerId === e.pointerId) {
    state.stickySideTabDrag = null, t.moved && (state.stickySideTabMoved = !0);
    try {
      refs.stickySideTab.releasePointerCapture(e.pointerId)
    } catch {}
    document.body.classList.remove("sticky-focus-dragging"), saveStickySideTabLayout()
  }
}

function handleStickySideTabClick(e) {
  if (state.stickySideTabMoved) return void(state.stickySideTabMoved = !1);
  openStickyNotes(e)
}

function pinStickyFocus(e) {
  const t = state.stickyNotes.find(t => t.id === e && "Completed" !== t.status);
  t && (state.stickyFocusId = e, state.stickyFocusCollapsed = !1, saveStickyFocusPreference(), renderStickyNotes(), showToast(`“${t.title||"Reminder"}” will remain open over the dashboard.`))
}

function unpinStickyFocus() {
  state.stickyFocusId = "", state.stickyFocusCollapsed = !1, saveStickyFocusPreference(), renderStickyNotes(), showToast("The sticky note was unpinned and collapsed to the side tab.")
}

function toggleStickyFocus() {
  if (state.stickyFocusToggleMoved) return void(state.stickyFocusToggleMoved = !1);
  state.stickyFocusId && (state.stickyFocusCollapsed = !state.stickyFocusCollapsed, saveStickyFocusPreference(), renderStickyFocusNote())
}

function changeStickyFocusSize(e) {
  const t = Math.max(0, Math.min(STICKY_FOCUS_SIZES.length - 1, state.stickyFocusLayout.size + e));
  t !== state.stickyFocusLayout.size && (state.stickyFocusLayout.size = t, state.stickyFocusLayout.width = STICKY_FOCUS_SIZES[t].width, state.stickyFocusLayout.height = STICKY_FOCUS_SIZES[t].height, saveStickyFocusPreference(), renderStickyFocusNote())
}

function resetStickyFocusLayout() {
  state.stickyFocusLayout = {
    size: 1,
    x: null,
    y: null,
    width: null,
    height: null
  }, saveStickyFocusPreference(), renderStickyFocusNote(), showToast("Sticky note returned to automatic fit and its original position.")
}

function startStickyFocusDrag(e) {
  if ("mouse" === e.pointerType && 0 !== e.button) return;
  const t = refs.stickyFocusNote.getBoundingClientRect();
  state.stickyFocusDrag = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    originX: t.left,
    originY: t.top,
    el: e.currentTarget,
    moved: !1
  }, state.stickyFocusLayout.x = t.left, state.stickyFocusLayout.y = t.top;
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {}
  document.body.classList.add("sticky-focus-dragging"), e.preventDefault()
}

function startStickyFocusToggleDrag(e) {
  state.stickyFocusCollapsed && startStickyFocusDrag(e)
}

function moveStickyFocusDrag(e) {
  const t = state.stickyFocusDrag;
  if (!t || t.pointerId !== e.pointerId) return;
  const r = refs.stickyFocusNote.getBoundingClientRect(),
    s = Math.max(8, window.innerWidth - r.width - 8),
    o = Math.max(8, window.innerHeight - r.height - 8),
    i = Math.max(8, Math.min(s, t.originX + e.clientX - t.startX)),
    n = Math.max(8, Math.min(o, t.originY + e.clientY - t.startY));
  (Math.abs(e.clientX - t.startX) > 3 || Math.abs(e.clientY - t.startY) > 3) && (t.moved = !0), state.stickyFocusLayout.x = i, state.stickyFocusLayout.y = n, refs.stickyFocusNote.style.left = `${i}px`, refs.stickyFocusNote.style.top = `${n}px`, refs.stickyFocusNote.style.right = "auto", refs.stickyFocusNote.style.bottom = "auto", e.preventDefault()
}

function endStickyFocusDrag(e) {
  const t = state.stickyFocusDrag;
  if (t && t.pointerId === e.pointerId) {
    state.stickyFocusDrag = null, t.moved && t.el === refs.stickyFocusToggle && (state.stickyFocusToggleMoved = !0);
    try {
      (t.el || refs.stickyFocusDragHandle).releasePointerCapture(e.pointerId)
    } catch {}
    document.body.classList.remove("sticky-focus-dragging"), saveStickyFocusPreference()
  }
}

function startStickyFocusResize(e) {
  if ("mouse" === e.pointerType && 0 !== e.button) return;
  if (state.stickyFocusCollapsed) return;
  const t = refs.stickyFocusNote.getBoundingClientRect();
  state.stickyFocusResize = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    startWidth: t.width,
    startHeight: t.height
  }, state.stickyFocusLayout.x = t.left, state.stickyFocusLayout.y = t.top;
  try {
    refs.stickyFocusResizeGrip.setPointerCapture(e.pointerId)
  } catch {}
  document.body.classList.add("sticky-focus-resizing"), e.preventDefault()
}

function moveStickyFocusResize(e) {
  const t = state.stickyFocusResize;
  if (!t || t.pointerId !== e.pointerId) return;
  const r = Math.max(240, window.innerWidth - (Number(state.stickyFocusLayout.x) || 8) - 8),
    s = Math.max(150, window.innerHeight - (Number(state.stickyFocusLayout.y) || 8) - 8),
    o = Math.max(240, Math.min(r, t.startWidth + e.clientX - t.startX)),
    i = Math.max(150, Math.min(s, t.startHeight + e.clientY - t.startY));
  state.stickyFocusLayout.width = o, state.stickyFocusLayout.height = i, refs.stickyFocusNote.style.width = `${o}px`, refs.stickyFocusNote.style.height = `${i}px`, e.preventDefault()
}

function endStickyFocusResize(e) {
  const t = state.stickyFocusResize;
  if (t && t.pointerId === e.pointerId) {
    state.stickyFocusResize = null;
    try {
      refs.stickyFocusResizeGrip.releasePointerCapture(e.pointerId)
    } catch {}
    document.body.classList.remove("sticky-focus-resizing"), saveStickyFocusPreference()
  }
}

function resizeStickyFocusWithKeyboard(e) {
  const t = {
    ArrowLeft: [-20, 0],
    ArrowRight: [20, 0],
    ArrowUp: [0, -20],
    ArrowDown: [0, 20]
  } [e.key];
  if (!t || state.stickyFocusCollapsed) return;
  const r = refs.stickyFocusNote.getBoundingClientRect();
  state.stickyFocusLayout.width = Math.max(240, r.width + t[0]), state.stickyFocusLayout.height = Math.max(150, r.height + t[1]), applyStickyFocusLayout(), saveStickyFocusPreference(), e.preventDefault()
}

function moveStickyFocusWithKeyboard(e) {
  const t = {
    ArrowLeft: [-20, 0],
    ArrowRight: [20, 0],
    ArrowUp: [0, -20],
    ArrowDown: [0, 20]
  } [e.key];
  if (!t) return;
  const r = refs.stickyFocusNote.getBoundingClientRect();
  state.stickyFocusLayout.x = (Number.isFinite(state.stickyFocusLayout.x) ? state.stickyFocusLayout.x : r.left) + t[0], state.stickyFocusLayout.y = (Number.isFinite(state.stickyFocusLayout.y) ? state.stickyFocusLayout.y : r.top) + t[1], applyStickyFocusLayout(), saveStickyFocusPreference(), e.preventDefault()
}

function applyStickyFocusLayout() {
  if (!refs.stickyFocusNote || refs.stickyFocusNote.hidden) return;
  const e = Math.max(0, Math.min(STICKY_FOCUS_SIZES.length - 1, state.stickyFocusLayout.size));
  state.stickyFocusLayout.size = e, refs.stickyFocusSizeLabel.textContent = STICKY_FOCUS_SIZES[e].label, refs.stickyFocusSizeDown.disabled = 0 === e, refs.stickyFocusSizeUp.disabled = e === STICKY_FOCUS_SIZES.length - 1;
  const t = Math.max(240, window.innerWidth - 16),
    r = Math.max(150, window.innerHeight - 16);
  if (!state.stickyFocusCollapsed && Number.isFinite(state.stickyFocusLayout.width) ? (state.stickyFocusLayout.width = Math.max(240, Math.min(t, state.stickyFocusLayout.width)), refs.stickyFocusNote.style.width = `${state.stickyFocusLayout.width}px`) : refs.stickyFocusNote.style.removeProperty("width"), !state.stickyFocusCollapsed && Number.isFinite(state.stickyFocusLayout.height) ? (state.stickyFocusLayout.height = Math.max(150, Math.min(r, state.stickyFocusLayout.height)), refs.stickyFocusNote.style.height = `${state.stickyFocusLayout.height}px`) : refs.stickyFocusNote.style.removeProperty("height"), !Number.isFinite(state.stickyFocusLayout.x) || !Number.isFinite(state.stickyFocusLayout.y)) return refs.stickyFocusNote.style.removeProperty("left"), refs.stickyFocusNote.style.removeProperty("top"), refs.stickyFocusNote.style.removeProperty("right"), void refs.stickyFocusNote.style.removeProperty("bottom");
  const s = refs.stickyFocusNote.getBoundingClientRect(),
    o = Math.max(8, window.innerWidth - s.width - 8),
    i = Math.max(8, window.innerHeight - s.height - 8),
    n = Math.max(8, Math.min(o, state.stickyFocusLayout.x)),
    a = Math.max(8, Math.min(i, state.stickyFocusLayout.y));
  state.stickyFocusLayout.x = n, state.stickyFocusLayout.y = a, refs.stickyFocusNote.style.left = `${n}px`, refs.stickyFocusNote.style.top = `${a}px`, refs.stickyFocusNote.style.right = "auto", refs.stickyFocusNote.style.bottom = "auto"
}

function renderStickyFocusNote() {
  const e = state.stickyNotes.find(e => e.id === state.stickyFocusId && "Completed" !== e.status);
  if (!e || refs.dashboardView.hidden) return state.stickyFocusId && !e && (state.stickyFocusId = "", state.stickyFocusCollapsed = !1, saveStickyFocusPreference()), refs.stickyFocusNote.hidden = !0, refs.stickySideTab.hidden = refs.dashboardView.hidden, void applyStickySideTabLayout();
  const t = ["yellow", "pink", "blue", "green", "purple", "orange"].includes(e.colour) ? e.colour : "yellow",
    r = Math.max(0, Math.min(STICKY_FOCUS_SIZES.length - 1, state.stickyFocusLayout.size));
  refs.stickyFocusNote.className = `sticky-focus-note ${t} ${STICKY_FOCUS_SIZES[r].className}${state.stickyFocusCollapsed?" is-collapsed":""}`, refs.stickyFocusType.textContent = e.type || "Reminder", refs.stickyFocusTitle.textContent = e.title || "Untitled note", refs.stickyFocusDetails.textContent = e.details || "No additional details.", refs.stickyFocusDue.textContent = e.dueDate ? `Due ${formatDate(e.dueDate)}` : "No due date", refs.stickyFocusEdit.dataset.stickyNoteId = e.id, refs.stickyFocusComplete.dataset.completeStickyNote = e.id, refs.stickyFocusToggle.setAttribute("aria-expanded", String(!state.stickyFocusCollapsed)), refs.stickyFocusChevron.textContent = state.stickyFocusCollapsed ? "+" : "−", refs.stickyFocusNote.hidden = !1, refs.stickySideTab.hidden = !0, applyStickyFocusLayout()
}

function editPinnedStickyNote() {
  const e = refs.stickyFocusEdit.dataset.stickyNoteId || state.stickyFocusId;
  e && openStickyNotes().then(() => editStickyNote(e)).catch(() => {})
}

function autoFitStickyDetailsInput() {
  const e = refs.stickyNoteDetails;
  e.style.height = "auto";
  const t = Math.max(88, Math.min(300, e.scrollHeight));
  e.style.height = `${t}px`, e.style.overflowY = e.scrollHeight > 300 ? "auto" : "hidden"
}

function editStickyNote(e) {
  const t = state.stickyNotes.find(t => t.id === e && "Completed" !== t.status);
  if (!t) return;
  state.stickyEditId = e, refs.stickyNoteType.value = t.type || "Reminder", refs.stickyNoteTitle.value = t.title || "", refs.stickyNoteDetails.value = t.details || "", autoFitStickyDetailsInput(), refs.stickyNoteDueDate.value = toIsoDate(t.dueDate || "");
  const r = refs.stickyNoteForm.querySelector(`input[name="stickyColour"][value="${CSS.escape(t.colour||"yellow")}"]`);
  r && (r.checked = !0), refs.saveStickyNoteButton.textContent = "Update note", refs.cancelStickyEditButton.hidden = !1, refs.stickyNoteError.textContent = "", refs.stickyNoteTitle.focus(), refs.stickyNoteForm.scrollIntoView({
    behavior: "smooth",
    block: "start"
  })
}

function cancelStickyEdit() {
  state.stickyEditId = "", refs.stickyNoteForm.reset(), refs.saveStickyNoteButton.textContent = "Save note", refs.cancelStickyEditButton.hidden = !0, refs.stickyNoteError.textContent = "", autoFitStickyDetailsInput()
}
async function completeStickyNote(e) {
  setButtonBusy(e, !0, "Moving…");
  try {
    const t = await apiRequest("completeStickyNote", {
      id: e.dataset.completeStickyNote
    });
    state.stickyNotes = Array.isArray(t.notes) ? t.notes : state.stickyNotes, renderStickyNotes(), showToast("Completed note was removed from active reminders and saved in the diary.")
  } catch (t) {
    showToast(friendlyError(t), !0), e.isConnected && setButtonBusy(e, !1, "✓ Completed")
  }
}
async function deleteStickyNote(e) {
  const t = e.dataset.deleteStickyNote,
    r = state.stickyNotes.find(e => e.id === t);
  if (r && window.confirm(`Delete “${r.title||"this note"}” permanently?`)) {
    setButtonBusy(e, !0, "Deleting…");
    try {
      const e = await apiRequest("deleteStickyNote", {
        id: t
      });
      state.stickyNotes = Array.isArray(e.notes) ? e.notes : state.stickyNotes, state.stickyEditId === t && cancelStickyEdit(), renderStickyNotes(), showToast("Target / reminder deleted.")
    } catch (t) {
      showToast(friendlyError(t), !0), e.isConnected && setButtonBusy(e, !1, "Delete")
    }
  }
}

function openEmployeeDetails(e) {
  if (!e) return;
  state.detailEmployeeCode = e["Employee Code"] || "";
  const t = e["Employee Name"] || "Employee details",
    r = e.Designation || "Designation not recorded",
    s = e["Employee Code"] || "No employee code",
    o = strengthStatus(e),
    i = sensitivityStatus(e);
  refs.detailsAvatar.textContent = initials(t), refs.detailsEmployeeName.textContent = t, refs.detailsEmployeeSubtitle.textContent = `${r} · ${s}`, refs.detailsStrengthStatus.className = `badge strength ${strengthClass(o)}`, refs.detailsStrengthStatus.textContent = o, refs.detailsPostSensitivity.className = `badge sensitivity ${sensitivityClass(i)}`, refs.detailsPostSensitivity.textContent = `Post: ${i}`;
  const n = completedWorkHistoryColumnKey(),
    a = state.columns.filter((e, t, r) => e !== n && r.indexOf(e) === t),
    l = DETAIL_SECTIONS.map(e => ({
      title: e.title,
      fields: e.fields.filter(e => a.includes(e))
    })).filter(e => e.fields.length),
    d = new Set(l.flatMap(e => e.fields)),
    c = a.filter(e => !d.has(e));
  c.length && l.push({
    title: "Additional information",
    fields: c
  });
  const u = n ? completedWorkHistoryDetailsMarkup(e[n]) : "";
  refs.employeeDetailsContent.innerHTML = l.map(t => `\n    <section class="detail-section">\n      <h3>${escapeHtml(t.title)}</h3>\n      <dl>${t.fields.map(t=>detailRow(t,e[t])).join("")}</dl>\n    </section>\n  `).join("") + u, refs.detailsEditButton.hidden = "admin" !== state.role, refs.employeeDetailsDialog.open || refs.employeeDetailsDialog.showModal()
}

function completedWorkHistoryDetailsMarkup(e) {
  const t = completedWorkHistoryItems(e),
    r = t.length ? `<ol>${t.map(e=>`<li>${escapeHtml(e)}</li>`).join("")}</ol>` : '<p class="detail-empty">No completed work has been archived.</p>';
  return `<details class="completed-work-profile"><summary><span>Completed work history</span><b>${t.length} hidden item${1===t.length?"":"s"}</b></summary><div>${r}</div></details>`
}

function detailRow(e, t) {
  let r = null == t ? "" : String(t).trim();
  "Strength Status" === e && (r = r || "Not set"), "Post Sensitivity" === e && (r = r || "Not set");
  let s = r ? escapeHtml(r) : '<span class="detail-empty">Not recorded</span>';
  ["DoB", "DoR", "DoJ Govt", "DoJ in Current Office", "Relieving Date"].includes(e) && r && (s = escapeHtml(formatDate(r))), "Strength Status" === e && (s = `<span class="badge strength ${strengthClass(r)}">${escapeHtml(r)}</span>`), "Post Sensitivity" === e && (s = `<span class="badge sensitivity ${sensitivityClass(r)}">${escapeHtml(r)}</span>`), "Email" === e && r && (s = `<a href="mailto:${escapeAttribute(r)}">${escapeHtml(r)}</a>`), "Mob" === e && r && (s = `<a href="tel:${escapeAttribute(r)}">${escapeHtml(r)}</a>`);
  const o = "REMARK ADMN" === e ? "detail-value remarks" : "detail-value",
    i = ["detail-row"];
  ["REMARK ADMN", "Present/Permanent Address"].includes(e) && i.push("detail-wide");
  const n = columnVisualClass(e);
  return n && i.push(n), r && "employee-name-column" === n && (s = `<span class="employee-name-deep-blue">${s}</span>`), r && isPendingWorkColumn(e) && (s = `<span class="pending-work-red-text">${s}</span>`), `<div class="${i.join(" ")}" data-field="${escapeAttribute(e)}"><dt>${escapeHtml(detailLabel(e))}</dt><dd class="${o}">${s}</dd></div>`
}

function detailLabel(e) {
  return columnLabel(e) || e
}

function editSelectedEmployee() {
  const e = findEmployee(state.detailEmployeeCode);
  e && "admin" === state.role && (refs.employeeDetailsDialog.close(), openEmployeeDialog(e))
}

function openEmployeeDialog(e) {
  const t = e || {};
  refs.employeeForm.reset(), refs.employeeFormError.textContent = "", refs.employeeDialogTitle.textContent = e ? "Edit employee" : "Add employee", refs.fieldDoJOfficeLabel.textContent = columnLabel("DoJ in Current Office") || "DoJ in ADG", refs.originalEmployeeCode.value = t["Employee Code"] || "", refs.fieldEmployeeName.value = t["Employee Name"] || "", refs.fieldEmployeeCode.value = t["Employee Code"] || "", refs.fieldDesignation.value = t.Designation || "", setSelectValue(refs.fieldGroup, t.Grp || ""), refs.fieldRemarks.value = t["REMARK ADMN"] || "", refs.fieldDoB.value = toIsoDate(t.DoB || ""), refs.fieldDoR.value = toIsoDate(t.DoR || ""), setSelectValue(refs.fieldCategory, t.Cat || ""), refs.fieldDoJGovt.value = toIsoDate(t["DoJ Govt"] || ""), refs.fieldDoJOffice.value = toIsoDate(t["DoJ in Current Office"] || t["DoJ in ADG"] || ""), refs.fieldAddress.value = t["Present/Permanent Address"] || t["Present/Permanent"] || "", setSelectValue(refs.fieldPostSensitivity, t["Post Sensitivity"] || ""), setSelectValue(refs.fieldStrengthStatus, t["Strength Status"] || (e ? "" : "Present")), refs.fieldRelievingDate.value = toIsoDate(t["Relieving Date"] || ""), refs.fieldMobile.value = t.Mob || "", refs.fieldEmail.value = t.Email || "", refs.fieldAge.value = t.AGE || "", renderCustomEmployeeFields(t), renderPendingWorkArchiveTools(), updateStrengthDateState(), refs.employeeDialog.showModal(), setTimeout(() => refs.fieldEmployeeName.focus(), 30)
}

function renderCustomEmployeeFields(e) {
  const t = state.customColumns.filter(e => !isCompletedWorkHistoryColumn(e.key)),
    r = t.map(t => {
      const r = e[t.key] || "";
      return isPendingWorkColumn(t.key) ? `<label class="span-two pending-work-edit-field"><span>${escapeHtml(columnLabel(t.key))}</span><textarea rows="3" maxlength="500" data-custom-employee-field="${escapeAttribute(t.key)}" placeholder="Enter one pending work item per line">${escapeHtml(r)}</textarea><small>Keep each work item on a separate line so completed items can be moved individually.</small></label>` : `<label><span>${escapeHtml(columnLabel(t.key))}</span><input type="text" maxlength="500" data-custom-employee-field="${escapeAttribute(t.key)}" value="${escapeAttribute(r)}"></label>`
    }).join(""),
    s = completedWorkHistoryColumnKey(),
    o = s ? `<input type="hidden" maxlength="500" data-custom-employee-field="${escapeAttribute(s)}" value="${escapeAttribute(e[s]||"")}">` : "";
  refs.customEmployeeFields.innerHTML = r + o, refs.customEmployeeFields.closest(".custom-fields-section").hidden = 0 === t.length
}

function pendingWorkItems(e) {
  return String(e || "").split(/\r?\n/).map(e => e.trim()).filter(Boolean)
}

function completedWorkHistoryItems(e) {
  return String(e || "").split(/\r?\n/).map(e => e.trim()).filter(Boolean)
}

function customEmployeeField(e) {
  return e ? refs.customEmployeeFields.querySelector(`[data-custom-employee-field="${cssEscape(e)}"]`) : null
}

function handleCustomEmployeeFieldInput(e) {
  const t = e.target.closest("[data-custom-employee-field]");
  t && isPendingWorkColumn(t.dataset.customEmployeeField) && renderPendingWorkArchiveTools(!0)
}

function renderPendingWorkArchiveTools(e) {
  const t = pendingWorkColumnKey(),
    r = customEmployeeField(t),
    s = e && refs.pendingWorkArchiveSection.open,
    o = Boolean(t && r);
  if (refs.pendingWorkArchiveButton.disabled = !o, refs.pendingWorkArchiveButton.textContent = o ? "Move finished pending work" : "Pending Work column needed", refs.pendingWorkArchiveToolbarNote.textContent = o ? "Select finished items and move them into the dated completed history." : "Use Manage columns once to add a column named Pending Work or Pending Works.", refs.pendingWorkArchiveSection.hidden = !t || !r, !t || !r) return;
  refs.pendingWorkArchiveSection.open = Boolean(s);
  const i = pendingWorkItems(r.value);
  refs.pendingWorkArchiveSummary.textContent = i.length ? `${i.length} pending work item${1===i.length?"":"s"}` : "No pending work", refs.pendingWorkArchiveNote.textContent = i.length ? "Select finished items below. They will leave Pending Works and move into the dated hidden history when you save the employee." : "Enter pending work above, keeping one item on each line.", refs.pendingWorkItemList.innerHTML = i.length ? i.map((e, t) => `\n    <label class="pending-work-check-row">\n      <input type="checkbox" data-pending-work-index="${t}">\n      <span>${escapeHtml(e)}</span>\n    </label>\n  `).join("") : '<p class="pending-work-archive-empty">No unfinished work is recorded.</p>', renderCompletedWorkHistoryEditor(), updateMoveCompletedWorkButton(), refs.pendingWorkArchiveButton.textContent = i.length ? `Move finished work · ${i.length}` : "Move finished pending work"
}

function openPendingWorkArchive() {
  refs.pendingWorkArchiveButton.disabled || refs.pendingWorkArchiveSection.hidden || (refs.pendingWorkArchiveSection.open = !0, requestAnimationFrame(() => {
    refs.pendingWorkArchiveSection.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
    const e = refs.pendingWorkItemList.querySelector("[data-pending-work-index]");
    e && e.focus({
      preventScroll: !0
    })
  }))
}

function renderCompletedWorkHistoryEditor() {
  const e = customEmployeeField(completedWorkHistoryColumnKey()),
    t = completedWorkHistoryItems(e ? e.value : "");
  refs.completedWorkHistoryCount.textContent = `${t.length} hidden item${1===t.length?"":"s"}`, refs.completedWorkHistoryList.innerHTML = t.length ? `<ol>${t.map(e=>`<li>${escapeHtml(e)}</li>`).join("")}</ol>` : '<p class="pending-work-archive-empty">No completed work has been archived.</p>'
}

function updateMoveCompletedWorkButton() {
  const e = refs.pendingWorkItemList.querySelectorAll("[data-pending-work-index]:checked").length;
  refs.moveCompletedWorkButton.disabled = 0 === e, refs.moveCompletedWorkButton.textContent = e ? `✓ Move ${e} selected to completed` : "✓ Move selected to completed"
}
async function ensureCompletedWorkHistoryColumn() {
  let e = completedWorkHistoryColumnKey();
  if (e) return e;
  const t = await apiRequest("addCustomColumn", {
    label: "Completed Work History"
  });
  if (applyColumnMetadata(t), e = String(t.key || completedWorkHistoryColumnKey()), !e) throw new Error("Completed Work History could not be created.");
  return refs.customEmployeeFields.insertAdjacentHTML("beforeend", `<input type="hidden" maxlength="500" data-custom-employee-field="${escapeAttribute(e)}" value="">`), state.dashboardColumns = state.dashboardColumns.filter(e => state.columns.includes(e)), saveDashboardColumnPreference(), updateChooseColumnsButton(), e
}
async function moveSelectedWorkToCompleted() {
  const e = customEmployeeField(pendingWorkColumnKey()),
    t = new Set([...refs.pendingWorkItemList.querySelectorAll("[data-pending-work-index]:checked")].map(e => Number(e.dataset.pendingWorkIndex)));
  if (e && t.size) {
    setButtonBusy(refs.moveCompletedWorkButton, !0, "Moving…"), refs.employeeFormError.textContent = "";
    try {
      const r = customEmployeeField(await ensureCompletedWorkHistoryColumn()),
        s = pendingWorkItems(e.value),
        o = s.filter((e, r) => t.has(r)),
        i = s.filter((e, r) => !t.has(r)),
        n = formatDate(isoToday()),
        a = o.map(e => `Completed on ${n} — ${e}`),
        l = completedWorkHistoryItems(r ? r.value : ""),
        d = a.concat(l).join("\n");
      if (d.length > 500) throw new Error("Completed Work History can hold 500 characters. Remove or export older history before moving more work.");
      e.value = i.join("\n"), r.value = d, renderPendingWorkArchiveTools(!0), refs.completedWorkHistoryDetails.open = !1, showToast(`${o.length} work item${1===o.length?"":"s"} moved to completed history. Choose Save employee to keep the change.`)
    } catch (e) {
      refs.employeeFormError.textContent = friendlyError(e)
    } finally {
      setButtonBusy(refs.moveCompletedWorkButton, !1, "✓ Move selected to completed"), updateMoveCompletedWorkButton()
    }
  }
}

function setSelectValue(e, t) {
  t && ![...e.options].some(e => e.value === t) && e.add(new Option(t, t)), e.value = t
}

function updateCalculatedFields() {
  refs.fieldAge.value = calculateAge(refs.fieldDoB.value), refs.fieldDoR.value || (refs.fieldDoR.value = calculateGovernmentRetirement(refs.fieldDoB.value))
}

function updateStrengthDateState() {
  const e = refs.fieldStrengthStatus.value,
    t = Boolean(e && !isPresentStrengthStatus(e));
  refs.fieldRelievingDate.disabled = !t, refs.fieldRelievingDate.required = t, t || (refs.fieldRelievingDate.value = ""), refs.relievingDateHint.textContent = t ? "Required for relieved, transferred or retired staff, including Other Office statuses" : "Not required for Present or Present Oth Off"
}
async function saveEmployee(e) {
  if (e.preventDefault(), refs.employeeFormError.textContent = "", !refs.employeeForm.reportValidity()) return;
  const t = {
    "Employee Name": refs.fieldEmployeeName.value.trim(),
    "Employee Code": refs.fieldEmployeeCode.value.trim(),
    Designation: refs.fieldDesignation.value.trim(),
    Grp: refs.fieldGroup.value,
    "REMARK ADMN": refs.fieldRemarks.value.trim(),
    DoB: refs.fieldDoB.value,
    DoR: refs.fieldDoR.value,
    Cat: refs.fieldCategory.value,
    "DoJ Govt": refs.fieldDoJGovt.value,
    "DoJ in Current Office": refs.fieldDoJOffice.value,
    "Present/Permanent Address": refs.fieldAddress.value.trim(),
    Mob: refs.fieldMobile.value.trim(),
    Email: refs.fieldEmail.value.trim(),
    AGE: refs.fieldAge.value,
    "Post Sensitivity": refs.fieldPostSensitivity.value,
    "Strength Status": refs.fieldStrengthStatus.value,
    "Relieving Date": refs.fieldRelievingDate.value
  };
  refs.customEmployeeFields.querySelectorAll("[data-custom-employee-field]").forEach(e => {
    t[e.dataset.customEmployeeField] = e.value.trim()
  }), setButtonBusy(refs.saveEmployeeButton, !0, "Saving…");
  try {
    await apiRequest("saveEmployee", {
      employee: t,
      originalEmployeeCode: refs.originalEmployeeCode.value
    }), refs.employeeDialog.close(), showToast(refs.originalEmployeeCode.value ? "Employee record updated." : "Employee added."), await loadEmployees()
  } catch (e) {
    refs.employeeFormError.textContent = friendlyError(e)
  } finally {
    setButtonBusy(refs.saveEmployeeButton, !1, "Save employee")
  }
}
async function deleteEmployee(e) {
  if (confirm(`Delete the record of ${e["Employee Name"]}?\n\nThis action will be recorded in the activity log.`)) {
    showLoading("Deleting employee record…");
    try {
      await apiRequest("deleteEmployee", {
        employeeCode: e["Employee Code"]
      }), showToast("Employee record deleted."), await loadEmployees()
    } catch (e) {
      showToast(friendlyError(e), !0)
    } finally {
      hideLoading()
    }
  }
}
async function importCsv(e) {
  const t = e.target.files[0];
  if (e.target.value = "", t) try {
    const e = parseCsv(await t.text());
    if (!e.length) throw new Error("The CSV file contains no employee rows.");
    if (e.length > 1e3) throw new Error("Import a maximum of 1,000 employees at a time.");
    if (!confirm(`Import ${e.length} employee record(s)? Existing employee codes will be updated.`)) return;
    showLoading(`Importing ${e.length} employee records…`);
    const r = await apiRequest("importEmployees", {
      employees: e
    });
    showToast(`Import complete: ${r.created} added, ${r.updated} updated${r.skipped?`, ${r.skipped} skipped`:""}.`), await loadEmployees()
  } catch (e) {
    showToast(friendlyError(e), !0)
  } finally {
    hideLoading()
  }
}
async function replaceAllCsv(e) {
  const t = e.target.files[0];
  if (e.target.value = "", t) try {
    const e = parseCsv(await t.text());
    if (!e.length) throw new Error("The CSV file contains no employee rows.");
    if (e.length > 1e3) throw new Error("Import a maximum of 1,000 employees at a time.");
    const r = findDuplicateEmployeeCode(e);
    if (r) throw new Error(`Employee code appears more than once: ${r}`);
    if (!confirm(`Replace ALL dashboard employee data with ${e.length} record(s)?\n\nThe current employee list will be backed up automatically in Google Drive before it is deleted.`)) return;
    if ("REPLACE" !== prompt("Final confirmation: type REPLACE to continue.")) return void showToast("Replace-all cancelled. No data was changed.");
    showLoading(`Backing up current data and replacing it with ${e.length} records…`);
    const s = await apiRequest("replaceEmployees", {
      employees: e
    });
    showToast(`Replacement complete: ${s.replaced} employee record(s) loaded; ${s.previous} previous record(s) backed up.`), await loadEmployees(!0), s.backupFileUrl && confirm(`Automatic backup created: ${s.backupFileName}. Open it in Google Drive?`) && window.open(s.backupFileUrl, "_blank", "noopener")
  } catch (e) {
    showToast(friendlyError(e), !0)
  } finally {
    hideLoading()
  }
}

function parseCsv(e) {
  const t = [];
  let r = [],
    s = "",
    o = !1;
  e = String(e || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < e.length; i += 1) {
    const n = e[i];
    o ? '"' === n && '"' === e[i + 1] ? (s += '"', i += 1) : '"' === n ? o = !1 : s += n : '"' === n ? o = !0 : "," === n ? (r.push(s), s = "") : "\n" === n ? (r.push(s.replace(/\r$/, "")), t.push(r), r = [], s = "") : s += n
  }
  if ((s || r.length) && (r.push(s.replace(/\r$/, "")), t.push(r)), !t.length) return [];
  const i = t.findIndex(e => {
    const t = e.map(e => e.trim());
    return t.includes("Employee Name") && t.includes("Employee Code")
  });
  if (i < 0) throw new Error("CSV columns missing: Employee Name and Employee Code.");
  const n = new Map;
  state.columns.forEach(e => {
    [e, columnLabel(e), DEFAULT_COLUMN_LABELS[e]].filter(Boolean).forEach(t => n.set(String(t).trim().toLocaleLowerCase(), e))
  }), Object.entries(CSV_HEADER_ALIASES).forEach(([e, t]) => n.set(e.toLocaleLowerCase(), t));
  const a = t[i].map(e => {
    const t = e.trim();
    return n.get(t.toLocaleLowerCase()) || CSV_HEADER_ALIASES[t] || t
  });
  return ["Employee Name", "Employee Code"].forEach(e => {
    if (!a.includes(e)) throw new Error(`CSV column missing: ${e}`)
  }), t.slice(i + 1).map(e => {
    const t = {};
    return a.forEach((r, s) => {
      state.columns.includes(r) && (t[r] = null == e[s] ? "" : e[s].trim())
    }), t
  }).filter(e => state.columns.some(t => !["Sl No.", "AGE"].includes(t) && String(e[t] || "").trim()))
}

function findDuplicateEmployeeCode(e) {
  const t = new Set;
  for (const r of e) {
    const e = String(r["Employee Code"] || "").trim().toLowerCase();
    if (e) {
      if (t.has(e)) return r["Employee Code"];
      t.add(e)
    }
  }
  return ""
}

function exportFilteredCsv() {
  const e = [state.columns.map(e => columnLabel(e))].concat(state.filtered.map(e => state.columns.map(t => e[t] || ""))).map(e => e.map(csvEscape).join(",")).join("\r\n");
  downloadBlob(new Blob(["\ufeff" + e], {
    type: "text/csv;charset=utf-8"
  }), `ADG_HR_Employees_${isoToday()}.csv`), showToast(`Exported ${state.filtered.length} employee record(s).`)
}
async function createBackup() {
  showLoading("Creating a Drive backup…");
  try {
    const e = await apiRequest("createBackup", {});
    showToast("Backup created in Google Drive."), e.fileUrl && confirm("Backup created successfully. Open it in Google Drive?") && window.open(e.fileUrl, "_blank", "noopener")
  } catch (e) {
    showToast(friendlyError(e), !0)
  } finally {
    hideLoading()
  }
}
async function openAdministrationSettings() {
  if ("admin" === state.role) {
    refs.securitySettingsError.textContent = "", refs.sessionTimeoutMinutes.value = String(normalizeSessionTimeoutMinutes(state.sessionTimeoutMinutes)), refs.administrationDialog.showModal();
    try {
      applySessionTimeoutResponse(await apiRequest("getSecuritySettings", {})), refs.sessionTimeoutMinutes.value = String(state.sessionTimeoutMinutes);
      const e = await apiRequest("getFileRegisterSettings", {});
      refs.fileRegisterSpreadsheetUrl.value = e.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${e.spreadsheetId}/edit` : ""
    } catch (e) {
      state.sessionTimeoutMinutes = 5, updateSessionSecurityText(), armSessionIdleTimer(), refs.securitySettingsError.textContent = `The saved setting could not be loaded. Secure fallback: 5 minutes. ${friendlyError(e)}`
    }
  }
}
async function saveSecuritySettings(e) {
  if (e.preventDefault(), "admin" !== state.role) return;
  refs.securitySettingsError.textContent = "";
  const t = normalizeSessionTimeoutMinutes(refs.sessionTimeoutMinutes.value, 0);
  if (t) {
    setButtonBusy(refs.saveSecuritySettingsButton, !0, "Saving…");
    try {
      await apiRequest("saveFileRegisterSettings", {
        spreadsheetUrl: refs.fileRegisterSpreadsheetUrl.value.trim()
      });
      applySessionTimeoutResponse(await apiRequest("saveSecuritySettings", {
        sessionTimeoutMinutes: t
      }));
      const e = Date.now();
      state.sessionLastActivityWrite = e, state.sessionLastHeartbeat = e, sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(e)), clearSessionWarning(), armSessionIdleTimer(), refs.administrationDialog.close(), showToast(`Automatic sign-out changed to ${t} minutes for every user.`)
    } catch (e) {
      refs.securitySettingsError.textContent = friendlyError(e)
    } finally {
      setButtonBusy(refs.saveSecuritySettingsButton, !1, "Save security setting")
    }
  } else refs.securitySettingsError.textContent = "Choose 5, 10, 15, 20 or 30 minutes."
}
async function changePassword(e) {
  if (e.preventDefault(), refs.passwordFormError.textContent = "", refs.newPassword.value === refs.confirmPassword.value) try {
    await apiRequest("changePassword", {
      currentPassword: refs.currentPassword.value,
      newPassword: refs.newPassword.value
    }), refs.passwordDialog.close(), refs.passwordForm.reset(), showToast("Password changed. Please sign in again."), clearSession(), showLogin()
  } catch (e) {
    refs.passwordFormError.textContent = friendlyError(e)
  } else refs.passwordFormError.textContent = "New passwords do not match."
}

function apiRequest(e, t, r = !0) {
  return new Promise((s, o) => {
    if (!isApiConfigured()) return void o(Object.assign(new Error("Google Apps Script URL is not configured."), {
      code: "NOT_CONFIGURED"
    }));
    const i = `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      n = document.createElement("iframe");
    n.name = `hr_api_${i}`, n.title = "HR API response", n.style.display = "none";
    const a = document.createElement("form");
    a.method = "POST", a.action = CONFIG.API_URL, a.target = n.name, a.style.display = "none";
    const l = document.createElement("input");
    l.type = "hidden", l.name = "payload", l.value = JSON.stringify({
      action: e,
      data: t || {},
      token: r ? state.token : "",
      requestId: i,
      origin: location.origin
    }), a.appendChild(l);
    let d = !1;
    const c = () => {
        window.removeEventListener("message", m), a.remove(), setTimeout(() => n.remove(), 0)
      },
      u = setTimeout(() => {
        d || (d = !0, c(), o(Object.assign(new Error("The backend took too long to respond."), {
          code: "TIMEOUT"
        })))
      }, CONFIG.REQUEST_TIMEOUT_MS),
      m = e => {
        if (e.data && e.data.channel === CONFIG.CHANNEL && e.data.requestId === i && !d)
          if (d = !0, clearTimeout(u), c(), e.data.ok) s(e.data.data || {});
          else {
            const t = Object.assign(new Error(e.data.message || "Request failed."), {
              code: e.data.code || "API_ERROR"
            });
            r && "SESSION_EXPIRED" === t.code && state.token && window.setTimeout(() => {
              clearSession(), state.employees = [], state.filtered = [], state.stickyNotes = [], state.namedFilterViews = [], showLogin(), refs.loginError.textContent = "Your session expired. Please sign in again."
            }, 0), o(t)
          }
      };
    window.addEventListener("message", m), document.body.append(n, a), a.submit()
  })
}

function isApiConfigured() {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(CONFIG.API_URL)
}

function showLoading(e) {
  refs.loadingText.textContent = e || "Loading…", refs.loadingOverlay.hidden = !1
}

function hideLoading() {
  refs.loadingOverlay.hidden = !0
}

function showToast(e, t) {
  const r = document.createElement("div");
  r.className = "toast" + (t ? " error" : ""), r.textContent = e, refs.toastRegion.appendChild(r), setTimeout(() => r.remove(), 4500)
}

function setButtonBusy(e, t, r) {
  e.disabled = t;
  (e.querySelector("span") || e).textContent = r
}

function friendlyError(e) {
  return {
    INVALID_LOGIN: "Incorrect username or password.",
    LOGIN_BLOCKED: "Too many failed attempts. Please wait 10 minutes.",
    SESSION_EXPIRED: "Your session expired. Please sign in again.",
    FORBIDDEN: "Your account does not have permission for this action.",
    DUPLICATE_CODE: "That employee code already exists.",
    DUPLICATE_IMPORT_CODE: "The CSV contains a duplicate employee code.",
    INVALID_IMPORT_ROW: e.message,
    INVALID_SENSITIVITY: "Select Sensitive or Non-Sensitive for Post Sensitivity.",
    INVALID_COLUMN_NAME: "Enter a clear name for the new column.",
    INVALID_STICKY_NOTE: "Enter a title for the target or reminder.",
    INVALID_SESSION_TIMEOUT: "Choose 5, 10, 15, 20 or 30 minutes.",
    STICKY_NOTE_NOT_FOUND: "That target or reminder is no longer available. Refresh and try again.",
    INVALID_FILTER_VIEW: "Enter a short name for this saved filter view.",
    FILTER_VIEW_LIMIT: "A maximum of 30 saved filter views can be stored. Delete one before adding another.",
    FILTER_VIEW_NOT_FOUND: "That saved filter view is no longer available. Refresh and try again.",
    DUPLICATE_COLUMN_LABEL: "Every column name must be different.",
    CUSTOM_COLUMN_LIMIT: "A maximum of 12 custom columns can be added.",
    PROTECTED_COLUMN: "The 18 essential HR columns are protected and cannot be deleted.",
    ORIGIN_BLOCKED: "This GitHub address is not allowed by the backend.",
    NOT_SETUP: "The backend is not linked to the employee spreadsheet. Run setupHRDashboard() once in Apps Script.",
    SHEET_UNAVAILABLE: "The backend cannot open the Employees sheet. Check the spreadsheet and the Apps Script account permission.",
    INVALID_RESPONSE: "The backend replied without employee data. Confirm that the current Apps Script deployment contains the getEmployees action.",
    SERVER_ERROR: "The backend encountered an error while reading the employee sheet. Check the latest Apps Script execution log.",
    UNKNOWN_ACTION: `Backend update incomplete. Deploy Code.gs v${CONFIG.REQUIRED_BACKEND_VERSION} as a new version, sign in again, and retry.`,
    SHEET_SCHEMA_MISMATCH: "The Sheet columns cannot be safely matched. Use Replace all data with the corrected CSV.",
    TIMEOUT: "The backend did not respond. Check the Apps Script deployment and internet connection.",
    NOT_CONFIGURED: "Connect the Apps Script web app URL in app.js first."
  } [e.code] || e.message || "Something went wrong. Please try again."
}

function versionAtLeast(e, t) {
  const r = e => String(e || "").split(".").map(e => Number(e) || 0),
    s = r(e),
    o = r(t);
  for (let e = 0; e < Math.max(s.length, o.length); e += 1) {
    if ((s[e] || 0) > (o[e] || 0)) return !0;
    if ((s[e] || 0) < (o[e] || 0)) return !1
  }
  return Boolean(e)
}

function calculateAge(e) {
  const t = ageOnDate(e, new Date);
  return null == t ? "" : String(t)
}

function calculateGovernmentRetirement(e) {
  const t = parseDate(e);
  if (!t) return "";
  const r = t.getFullYear() + 60,
    s = t.getMonth();
  return toIsoLocal(1 === t.getDate() ? new Date(r, s, 0) : new Date(r, s + 1, 0))
}

function strengthStatus(e) {
  return String(e && e["Strength Status"] || "").trim() || "Not set"
}

function isPresentStrengthStatus(e) {
  return ["Present", "Present Oth Off"].includes(String(e || "").trim())
}

function strengthClass(e) {
  return String(e || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "") || "not-set"
}

function sensitivityStatus(e) {
  return String(e && e["Post Sensitivity"] || "").trim() || "Not set"
}

function sensitivityClass(e) {
  return String(e || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "") || "not-set"
}

function initials(e) {
  return String(e || "E").trim().split(/\s+/).slice(0, 2).map(e => e.charAt(0)).join("").toUpperCase() || "E"
}

function parseDate(e) {
  if (!e) return null;
  const t = toIsoDate(e);
  if (!t) return null;
  const r = t.split("-").map(Number),
    s = new Date(r[0], r[1] - 1, r[2]);
  return Number.isNaN(s.getTime()) ? null : s
}

function toIsoDate(e) {
  const t = String(e || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const r = t.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  return r ? `${r[3]}-${r[2].padStart(2,"0")}-${r[1].padStart(2,"0")}` : ""
}

function toIsoLocal(e) {
  return `${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`
}

function formatDate(e) {
  const t = parseDate(e);
  return t ? new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(t) : e
}

function isoToday() {
  return toIsoLocal(new Date)
}

function csvEscape(e) {
  const t = String(null == e ? "" : e);
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g,'""')}"` : t
}

function downloadBlob(e, t) {
  const r = URL.createObjectURL(e),
    s = document.createElement("a");
  s.href = r, s.download = t, document.body.appendChild(s), s.click(), s.remove(), setTimeout(() => URL.revokeObjectURL(r), 1e3)
}

function highlight(e, t) {
  const r = escapeHtml(e);
  if (!t) return r;
  const s = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return r.replace(new RegExp(`(${s})`, "ig"), "<mark>$1</mark>")
}

function escapeHtml(e) {
  return String(null == e ? "" : e).replace(/[&<>"']/g, e => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  } [e]))
}

function escapeAttribute(e) {
  return escapeHtml(e).replace(/`/g, "&#096;")
}

function debounce(e, t) {
  let r;
  return (...s) => {
    clearTimeout(r), r = setTimeout(() => e(...s), t)
  }
}

function handleKeyboardShortcut(e) {
  !e.metaKey && !e.ctrlKey || "k" !== e.key.toLowerCase() || refs.dashboardView.hidden || (e.preventDefault(), refs.globalSearch.focus())
}
document.addEventListener("DOMContentLoaded", init);