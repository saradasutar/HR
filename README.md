# ADG(B) HR Dashboard

A responsive employee master dashboard designed for O/o ADG(B), CPWD Bengaluru.

The GitHub frontend is connected to the verified Apps Script v1.6.1 deployment ending in `waBgHI/exec`.

## Colour refresh v3

This version adds a calm teal–blue–aqua theme with warm orange highlights, colour-coded statistics cards, a gradient office header, a softly tinted employee directory and stronger mobile readability. The Apps Script connection is already set to the current HR backend.

## Full dashboard contrast refresh

The normal dashboard now uses a stronger teal–navy hero, a warm orange primary action, clearer colour-coded statistics, a high-contrast employee-directory heading, bold filters and table values, darker column headings, alternating rows and stronger pagination controls. The layout remains responsive and lightweight.

## Strength-status update v1.1

This version adds `Strength Status` and `Relieving Date`. An employee can be marked **Present**, **Relieved**, **Transferred** or **Retired**. The relieving date becomes compulsory for every status except Present. The filter, search, CSV import/export, Drive backup and Google Sheet backend all include both fields.

## Post-sensitivity update v1.2

This version adds `Post Sensitivity`, with **Sensitive** and **Non-Sensitive** values. The field is available in the employee form, directory, search, filter, profile, CSV import/export, Drive backup and Google Sheet backend. The Reports Centre includes one-click printable lists for present employees on Sensitive and Non-Sensitive posts. Older records remain safely available as **Not set** until classified.

## Visibility and filtered-print correction v1.3

`Strength Status` and `Post Sensitivity` now appear beside the employee's main identity columns instead of at the extreme right of the directory. The dashboard also shows separate Present · Sensitive and Present · Non-Sensitive totals. **Print filtered list** prints the current search, Group, Category, Strength Status, Post Sensitivity and Appointment Status filters. Post Sensitivity is bold and highlighted in every applicable on-screen and A4 printed report.

## Safe replace-all import v1.4

Administrators can now use **Replace all data** to load a CSV as the complete employee master. The dashboard validates every row and duplicate employee code before changing the Sheet. It automatically saves the current list as a timestamped Google Drive backup, then deletes the old employee rows and loads only the selected file. Legacy header names are mapped to the current schema during import.

## Corrected address and joining headers v1.5

The employee data showed that `Present/Permanent` contains residential addresses, not appointment status. The field is now correctly named **Present/Permanent Address** everywhere: Sheet, CSV, form, directory, employee profile, search, export and reports. **DoJ in Current Office** is now the standard joining-date header. Older CSV files using `Present/Permanent` or `DoJ in ADG` are still accepted and mapped to the corrected fields.

### Google Sheets typed-column setup fix v1.5.1

Setup no longer forces a text number format across employee rows. This avoids the Google Sheets error **“You can't set the number format of cells in a typed column”** while preserving employee codes, mobile numbers and dates as text values through the backend's existing safe-write routine.

Version 1.5.2 adds the uniquely named `setupHRDashboardV152()` function and makes all optional Sheet styling and dropdown validation non-blocking. Version 1.5.4 adds a separate administrator **Edit headers** button. Version 1.5.5 adds the attachment-aligned table order and ISO-normalized replacement data. Version 1.5.6 adds `setupHRDashboardV156()`, physically aligns the Sheet with the attachment order, safely migrates older named columns, preserves a raw pre-replacement backup, and explains an outdated backend instead of showing “Unknown dashboard action.”

Version 1.5.7 adds `setupHRDashboardV157()` and sends Apps Script iframe responses to the top dashboard window. This corrects the login timeout caused when Google places the web-app output inside an additional sandbox wrapper.

Version 1.5.8 makes the normal dashboard substantially more compact. The workforce heading and primary actions now share the top command bar, while all six summary cards fit into one shorter row on wide screens and adapt responsively on smaller screens. The backend also clears obsolete dropdown rules from columns that changed position, preventing a valid relieving date from being rejected as an invalid Strength Status.

## Flexible columns and clearer profiles v1.6.0

Administrators now have a separate **Manage columns** control. They can add up to 12 custom employee columns and delete only those custom columns; the 18 essential HR columns remain protected. New columns are stored in the Google Sheet and work in the dashboard table, search, direct row editing, employee form, employee profile, CSV import/export and Drive backups. Deleting a custom column automatically creates a raw CSV backup in Google Drive before its values are removed.

The employee profile now shows four information blocks per row on desktop, two on tablets and one on phones, substantially reducing vertical scrolling. Dashboard, table, filter, form and profile text is slightly larger and bolder with a calm teal–blue colour treatment for clearer viewing.

### Safe column-alignment repair v1.6.1

Version 1.6.1 adds `setupHRDashboardV161()` and the separate `repairHRDashboardColumnAlignmentV161()` repair command. It recognizes the specific legacy rotation where Strength Status appears under Email and DoB/DoR appear in the final columns. Before moving any values, it creates a raw CSV backup in the dashboard's Google Drive folder. Correctly aligned Sheets and administrator-created custom columns are not changed.

### Selected profile-card editing v1.6.2

Administrators can now add or edit information directly from a selected employee-profile card. Empty cards show **+ Add details** and completed cards show **Edit**. The small focused form saves the selected field while preserving every other value in that employee's record. Serial number and age remain calculated and read-only. Strength Status and Relieving Date are safely handled together so the exit-date validation remains valid.

The six workforce totals are now minimized into a slim statistics strip attached to the top command header. This removes the large separate card area while keeping every total visible in a compact, eye-soothing layout.

Version 1.6.3 keeps all six summary cards in one uninterrupted row. Each card has its own high-contrast gradient colour. On a narrow screen, the same row slides horizontally rather than breaking into a second row.

Version 1.6.8 keeps the one-page employee popups and makes the multi-column filter a focused editing view. After selecting one or several subject columns and clicking **Apply & edit**, the directory displays only those selected columns plus Actions. Direct row editing changes the visible selected fields while preserving all hidden employee data. Clearing the field filter restores the complete table.

## Attachment-aligned replacement v1.5.5

The Employee directory now follows the supplied 18-column CSV order: identity, DoB/DoR, category, joining dates, address and contact details, AGE, Strength Status, Relieving Date, Post Sensitivity and Administration Remarks. The visible legacy labels **DoJ in ADG** and **Present/Permanent** are retained while the protected internal data mapping remains stable. The supplied replacement file is normalized to ISO dates so all 37 employee rows pass the backend's strict date validation. **Replace all data** still creates a Google Drive backup before clearing the previous rows.

## Column-alignment and backend-action fix v1.5.6

The Google Sheet now uses the same physical field order as the dashboard and attachment. This prevents Email from appearing under Mobile, Age from appearing under Email, and similar shifted values. The safe replace-all action backs up the current raw Sheet grid before repairing the schema and writing the validated records. If GitHub is updated before Apps Script, the dashboard now reports that the backend update is incomplete and names the required version instead of displaying the vague “Unknown dashboard action” error.

## Direct table editing v1.5.2

Administrators now have two clear controls in the Employee directory: **Edit headers** and **Edit rows**. **Edit headers** turns all visible column names into editable boxes and shows **Save headers** and **Reset headers**. Header labels are saved centrally for all users while the protected internal Sheet keys remain unchanged, preventing a new header/data mismatch. **Edit rows** provides inline employee-data editing. Date, email, status and post-sensitivity controls are validated before row saving. **Sl No.** and **AGE** remain read-only because they are calculated automatically. The existing **Full form** and vertical employee profile remain available.

## Employee profile view

Click or press Enter on any employee row to open a compact, read-only profile centred in the middle of the screen. The popup uses only the height needed by the employee data rather than filling the page. Exactly four equal information cards appear across each desktop row; smaller devices automatically use two columns and then one column. The complete **Edit employee** form is also a content-sized centred card with four fields across each desktop row. Comfortable bold text, soft teal-blue surfaces and restrained spacing keep both views easy on the eyes.

## Reports Centre

Click **Reports & Print** to prepare office-ready employee reports without changing the source Sheet. Available reports include the current dashboard filters, age range on any selected reference date, retirement between dates, Government/ADG joining between dates, relieving or exit between dates, strength status, present employees by post sensitivity, relieved/transferred/retired staff, group, category, designation and the complete employee list. Every report can be reviewed on screen, printed in A4 landscape format or exported as CSV. Age reports are calculated from Date of Birth on the selected date rather than using the current AGE column.

## Included

- `github-pages/` — public frontend files (`index.html`, `styles.css`, `app.js`)
- `apps-script/` — protected Google Apps Script backend (`Code.gs`, `appsscript.json`)
- `Employee_Replacement_Ready_v1.5.5.csv` — validated 37-row complete replacement file
- `Employee_Replacement_Ready_v1.5.5.xlsx` — formatted review copy of the replacement data
- `Employee_Import_Template.xlsx` — blank bulk employee import template
- `SETUP_GUIDE.md` — non-coder deployment instructions

## Main features

- Administrator and view-only username/password access
- Search across every employee field
- Comfortable Employee directory typography uses larger bold text, centred alignment, soft alternating row colours and clean two-line wrapping; employee names are deep blue and Pending Work is dark red
- Light highlighters distinguish displayed values from the row background: regular values use pale blue, employee names use a stronger blue tint, Pending Work uses pale pink, editable fields use soft cream and the selected field changes to pale yellow with a teal focus border
- Subtle metallic silver-blue headings, gold summary figures, metallic navy employee names and metallic ruby Pending Work text add depth without applying reflective effects to ordinary employee data; dashboard and form fonts are moderately enlarged for comfortable reading
- Version 1.6.20 strengthens the metallic contrast with vivid gold headings and totals, platinum-blue modal titles, bright cobalt employee names and high-contrast ruby Pending Work text, supported by fine outlines and shadows on both dark and light surfaces
- Version 1.6.28 removes the metallic effect from every column named Pending Work and displays its values in solid extra-bold dark red, with a deep-red header, white header text and soft red cell highlighting for easy reading
- Version 1.6.29 adds a clear **Choose filters** window beside **Choose columns**. Search, Group, Category, Strength Status, Post Sensitivity and one or multiple filled subject columns can be combined and saved as the default dashboard view on that device. Whenever any filter is active, administrators automatically receive an **Edit filtered row** action inside the filtered table; only the visible row fields are edited and all other employee data remains unchanged.
- Version 1.6.30 freezes the complete Employee directory header during vertical scrolling and keeps **Sl No.** and **Employee Name** visible during horizontal scrolling. The frozen cells remain opaque, readable and correctly highlighted in normal, alternating, hover and direct-edit rows, including customized and filtered dashboard views.
- Version 1.6.31 expands **Choose filters** to every employee column, including administrator-created columns. Add one or multiple rules using Contains, Equals, Does not equal, Starts with, Is filled or Is blank; all rules work together and are remembered on that device. The result grid focuses on the chosen rule columns, keeps **Sl No.** and **Employee Name** frozen, and preserves **Edit filtered row** for administrators.
- Version 1.6.32 makes the any-column chooser more reliable and clearer. A newly added rule starts with **Is filled**, existing column values appear as typing suggestions, and any incomplete rule displays a bold red explanation inside the popup instead of an easily missed notification behind it.
- Version 1.6.33 fixes dashboard column positioning. **Sl No.** and **Employee Name** remain protected as the two frozen columns, while **First** places Pending Work—or any selected field—immediately after Employee Name. Saved dashboard order is now also respected when focused filters temporarily show only their relevant columns.
- Version 1.6.34 adds **Show column — all employees** to the any-column chooser and makes it the default for a new rule. Pending Work can therefore be brought into the focused dashboard even when every Pending Work cell is blank; employees are not removed merely because the selected display column has no entry. **Is filled** and **Is blank** remain available when actual value-based filtering is required.
- Version 1.6.35 gives **Choose filters** a separate **Columns to display — blank values allowed** checklist. Tick Pending Work there to keep it visible and directly editable even when every Pending Work cell is empty; independently apply Group, Status, search or any value rules without coupling display choice to filter results. Existing v1.6.34 show-all selections are migrated automatically.
- Version 1.6.36 adds **Display a particular cell — blank or filled** inside **Choose filters**. Choose one employee and one field to focus the dashboard on that exact cell regardless of whether it contains data. The selected cell remains directly editable for administrators, is remembered as part of the saved dashboard view and can still be combined with the other filters.
- Version 1.6.37 removes the separate red treatment from the Pending Work column. Its header, cells, blank values, filled values, employee-details entry and edit input now use the same calm dashboard styling as other ordinary fields. The gold–violet focus highlight remains only for a deliberately selected particular cell.
- Version 1.6.38 treats Pending Work and REMARK ADMN as long-text dashboard fields. Both are left-aligned, fully wrapped without two-line clipping, given a responsive practical width and allowed to increase the employee row height automatically so the complete text remains visible. Direct-edit controls use auto-growing multiline boxes for these two fields while other columns remain compact.
- Version 1.6.39 displays only the actual Pending Work text in clear bold red, including its direct-edit text and employee-details value. The header and cell background retain the same calm colours as other ordinary fields; full wrapping, left alignment, automatic sizing and particular-cell highlighting remain unchanged.
- Version 1.6.40 narrows Pending Work and REMARK ADMN to a compact responsive width. Both columns continue to show their complete text over as many lines as needed, remain left-aligned and increase only the affected row height.
- Version 1.6.41 simplifies **Filter dashboard** for desktop and mobile. The unwanted particular-cell section is removed; quick filters, visible-column choices, completed-field filters and optional advanced conditions are presented in a clearer responsive layout with larger controls and a prominent apply button.
- Version 1.6.42 reduces **Filter dashboard** to a two-step workflow: choose common or optional any-column employee filters, then select **Show results**. Visible columns are now controlled only by the separate **Choose columns** button, and the duplicate filled-subject filter bar is hidden.
- Version 1.6.43 adds **Arrange filtered results** to the filter window. Choose any employee column and Ascending or Descending order; the arrangement is saved with the device’s dashboard view. Every sortable header now has a visible ↕ arrow which becomes ↑ or ↓ for the active order. After filtering, separate row ↑/↓ controls let an administrator manually adjust employee order; the displayed serial numbers update automatically. Dashboard, table, employee-details popup, edit popup and filter controls all use larger, bolder responsive text.
- Version 1.6.44 adds **Save order** for administrators. Each particular filter and sort combination can retain its own manually arranged employee-code sequence in the browser. Reopening the dashboard with that same saved filter automatically restores its row order. **Reset order** removes only the saved order for the current filter and returns it to automatic column sorting.
- Version 1.6.45 changes **Print filtered list** to **Print saved filter** whenever a saved order is restored. The printed report preserves the exact filtered dashboard sequence instead of sorting it alphabetically again, restarts Sl No. from 1, and includes custom column-filter criteria in the report heading.
- Version 1.6.46 gives the Filter dashboard window a fixed-height layout with a clearly visible vertical scrollbar. Its heading and bottom action buttons remain available while only the filter controls scroll. Touch scrolling is enabled on mobile, the scrollbar remains visible on desktop, and every newly opened filter window starts at the top.
- Version 1.6.47 removes the unreliable nested scroll area and makes the entire Filter dashboard dialog the single scroll container. The header and footer remain sticky. Permanent ▲ Up and ▼ Down buttons provide a second scrolling method on desktop and mobile, even when the operating system hides native scrollbars.
- Version 1.6.48 makes **Print filtered list** and **Print saved filter** follow the Personal dashboard view. The print preview, printed page and report CSV use exactly the selected dashboard columns, visible header names and chosen column order; excluded columns remain excluded. Filtered employee order and automatic Sl No. numbering are preserved.
- Version 1.6.49 adds multiple named filter views. The **Saved filter views** section stays collapsed until clicked, keeping the filter window compact. Each named view saves its filters, sort direction and Personal dashboard columns on the current device. Choose **Open** to restore it, **Print** to open its matching print report, or **Delete** to remove it. Saving again with the same name updates that view.
- Version 1.6.50 adds a safe completed-work archive inside **Edit employee**. Pending Works is entered one item per line. Expand **Move finished pending work**, tick completed items and move them into a dated **Completed Work History**. The history column is created automatically on first use, remains excluded from the normal dashboard, and appears only when its collapsed history section is opened or the column is deliberately selected. Choose **Save employee** to keep the move. No backend update is required.
- Version 1.6.51 makes both tools easy to find. A permanent **Saved views · number** button beside **Filter dashboard** opens the saved-view list directly. A permanent **Move finished work · number** shortcut near the top of **Edit employee** opens the pending-work archive directly. If no Pending Work column exists, the shortcut clearly explains how to add it. Existing saved views, filters, employee data and completed-work history are preserved. No backend update is required.
- Version 1.6.52 adds **Move finished work** directly inside **Edit filtered row**. Select completed Pending Works items in the compact popup, choose **Move selected into completed**, and then choose **Save** on that same filtered row. The move works even when Pending Works or Completed Work History is not among the visible dashboard columns, so hidden employee fields are preserved. No backend update is required.
- Version 1.6.53 makes filtered employee scrolling unmistakable. The directory now has a permanently available scrollbar plus clearly visible **▲ Up** and **▼ Down** controls on desktop and mobile. Applying or reopening a filter starts at the first result, while every matching employee remains in the same table without pagination. No backend update is required.
- Version 1.6.54 fixes **Edit headers** when a Personal dashboard view shows only selected columns. Administrators can rename the visible headings and save normally; headings for hidden columns are preserved automatically, and duplicate names are clearly identified. No backend update is required.
- Version 1.6.58 starts from the complete v1.6.54 dashboard and changes only the Employee directory action-card labels. **Print filtered list**, **Choose columns**, **Filters** and **Saved views** now use two fixed non-wrapping lines, so counts such as `· 5` cannot move onto a third line. Employee data rows and every other dashboard style and behaviour remain as in v1.6.54. No backend update is required.
- Version 1.6.59 keeps the two-line limit only on the Employee directory action cards. Employee Name, Designation, Address and every other table value now show their complete text using as many centred wrapped lines as necessary. Serial number, mobile number and dates remain on one line. No backend update is required.
- Version 1.6.60 adds complete keyboard access to filtered Employee directory data. With a dashboard filter active, use Up/Down to move through employee rows, Left/Right to reach selected columns, Page Up/Page Down for larger jumps and Home/End for the first or last result. Form fields and editing controls retain their normal keyboard behaviour. No backend update is required.
- Dashboard serial numbers are generated automatically from the current filtered and sorted results, beginning at 1 and increasing continuously without changing Sheet records
- The complete filtered employee list now stays on one dashboard page inside a vertically scrollable directory; Previous/Next pagination is no longer required
- Serial numbers, mobile numbers and all service-date values remain on one line, including two-digit serial numbers
- Choose any dashboard columns, arrange their order and change the personal view at any time; the choice is remembered on that device
- Click any employee row for a clean four-column profile view; administrators use one **Edit employee** button for the complete form
- Select one or multiple employee subject columns, temporarily show only those filtered columns and records where all are filled, then edit any matching row without clearing hidden data
- Generate printable age, retirement, joining, strength, sensitivity, group, category and designation reports
- Print the current combination of search, group, category, strength and sensitivity filters
- Group, category, strength-status and post-sensitivity filters
- Add, edit and delete controls for administrators
- Administrator-only add/delete controls for custom employee columns; essential HR columns are protected
- Administrator-only direct row editing inside the dashboard table
- CSV bulk import and filtered CSV export
- Safe full-data replacement with automatic pre-delete Drive backup
- Google Drive backups and a Sheet activity log
- Automatic AGE and Central Government retirement-date calculation
- Present-strength tracking with relieving/transfer/retirement date
- Sensitive and Non-Sensitive post classification for present-strength reports
- Mobile, tablet and desktop layouts
- No external frontend libraries, for faster loading and easy maintenance

Employee data and password hashes are never stored in the public GitHub files. They remain behind the Google Apps Script backend.
