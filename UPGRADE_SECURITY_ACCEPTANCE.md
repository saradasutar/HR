# Coordinated HR Dashboard Upgrade — Security and Acceptance Checklist

This branch is a **staging branch**. Do not publish it until tested with the private Apps Script backend. It must not contain employee records, credentials, or private backend source.

## Deployment separation
- Public GitHub Pages: static frontend assets only.
- Private Apps Script project: employee data access, authentication, authorization, audit events and FR 56(j) review saves.
- Restricted Google Sheets / Drive: employee master, review history, backups.
- Do not assume hiding a button enforces permissions; every backend action must validate role and session.
- Review Git history for previously committed sensitive files; deleting a file in the latest commit does not remove history.
- Rotate exposed credentials if found. Do not commit credentials or tokens.

## FR 56(j) acceptance tests (not yet verified)
- Review each age-50, age-55, FR 56(l), and Rule 42 trigger for applicability.
- Verify actual qualifying-service date from the service book; DoJ + 30 years is provisional.
- Keep employee counts distinct from review-trigger counts.
- Save review history separately from employee master.
- Test already-reviewed entries, deferred entries, and former employees.
- Verify historical entries do not generate current pending tasks.
- Print quarter reports and compare with verified register.

## UI acceptance tests (not yet verified)
- Login page: deep-clear button visible on desktop and mobile; prompts before sign-out.
- Cache clearing must not modify backend employee records.
- Column drag widths persist on the same browser, reset when intentionally cleared.
- All forms show explicit save success/failure.
- Search, filter, mobile, printing and keyboard access continue to work.

## Current scope
The first commit implements the login maintenance control and reduced-motion CSS. Remaining items are a documented backlog, **not yet implemented**.
