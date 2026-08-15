# ADG(B) HR Dashboard — Step-by-Step Setup Guide

This setup uses three parts:

1. **GitHub Pages** displays the dashboard.
2. **Google Apps Script** checks usernames/passwords and controls all actions.
3. **Google Sheets and Drive** store employee records, the activity log and CSV backups.

No software installation is required on your computer.

## Part A — Create the Google Apps Script backend

### 1. Create the Apps Script project

1. Sign in to the Google account that will own the HR data.
2. Open [script.google.com](https://script.google.com/).
3. Click **New project**.
4. Rename the project to **ADG(B) HR Dashboard Backend**.
5. Open the supplied `apps-script/Code.gs`, copy all code and replace the existing code in the Apps Script editor.

### 2. Add `appsscript.json`

1. In Apps Script, click **Project Settings** (gear icon on the left).
2. Turn on **Show "appsscript.json" manifest file in editor**.
3. Return to **Editor**.
4. Open `appsscript.json` and replace it with the supplied `apps-script/appsscript.json` content.
5. Click **Save project**.

### 3. Set your usernames and passwords

In `Code.gs`, find `setHRDashboardSecurityCodes()` and change these four values:

```javascript
var ADMIN_USERNAME = "admin";
var ADMIN_PASSWORD = "ChangeAdmin@2026";
var VIEWER_USERNAME = "viewer";
var VIEWER_PASSWORD = "ViewOnly@2026";
```

Use passwords of at least 10 characters. Do not reuse an email or banking password.

The supplied defaults are only for first-time testing:

| Access | Username | Initial password |
| --- | --- | --- |
| Administrator | `admin` | `ChangeAdmin@2026` |
| View only | `viewer` | `ViewOnly@2026` |

Change both initial passwords before entering real employee data.

### 4. Run first-time setup

1. At the top of the Apps Script editor, select `setupHRDashboardV161` from the function list. If this exact name is missing, the newest `Code.gs` has not been fully replaced or saved.
2. Click **Run**.
3. Google will ask for permission. Select the owner account and allow access to Sheets and Drive.
4. When complete, the script creates:
   - Drive folder: **ADG(B) HR Dashboard Data**
   - Spreadsheet: **ADG(B) HR Employee Master**
   - Sheet tab: **Employees**
   - Sheet tab: **Activity Log**
5. Now select `setHRDashboardSecurityCodes` and click **Run** once. This applies the usernames and passwords you entered.

If an earlier v1.5 file showed **“You can't set the number format of cells in a typed column”**, replace the complete `Code.gs` with the latest v1.5.8, click **Save project**, refresh the Apps Script editor, and run `setupHRDashboardV158`. The unique function name confirms the corrected file is loaded. Use **Ctrl+F** to search the Apps Script project for `setNumberFormat`; the corrected package has no matches. Setup safely reuses the existing Sheet and Drive folder.

Version 1.5.6 also fixes the condition where Email appeared under Mobile, Age appeared under Email, and other values were shifted. It migrates older named Sheet columns into the attachment order. After deployment, run **Replace all data** once with the supplied corrected CSV so all 37 rows are rewritten in the verified order.

Version 1.5.8 additionally repairs the message that a relieving date in cell P4 violates the Strength Status validation. It removes dropdown rules left on old column positions and recreates them only under **Strength Status** and **Post Sensitivity**.

Version 1.6.0 adds the administrator-only **Manage columns** control. The 18 essential HR fields are protected, while an administrator can add up to 12 custom employee columns. Deleting a custom column automatically creates a raw Drive backup before removing its values.

Version 1.6.1 repairs the legacy shuffled-value pattern where Strength Status appears under Email and DoB/DoR appear in the final columns. Running `setupHRDashboardV161` detects this exact pattern, creates a raw Drive backup and moves the values under their correct headings. If the Sheet is already aligned, it makes no change.

The dashboard table and replacement file display these columns in the exact attached order. The protected Sheet keys remain stable so existing integrations are not broken:

`Sl No.`, `Employee Name`, `Employee Code`, `Designation`, `Grp`, `DoB`, `DoR`, `Cat`, `DoJ Govt`, `DoJ in ADG`, `Present/Permanent`, `Mob`, `Email`, `AGE`, `Strength Status`, `Relieving Date`, `Post Sensitivity`, `REMARK ADMN`.

### 5. Deploy the backend as a Web app

1. Click **Deploy → New deployment**.
2. Click the gear beside **Select type** and choose **Web app**.
3. Description: **HR Dashboard API v1**.
4. **Execute as:** Me.
5. **Who has access:** Anyone.
6. Click **Deploy**.
7. Copy the Web app URL ending in `/exec`.

Keep the Web app URL. This package is already connected to the current HR Dashboard deployment; update `app.js` only if a different Apps Script deployment is created later.

Official reference: [Google Apps Script Web Apps](https://developers.google.com/apps-script/guides/web).

## Part B — Connect and publish the GitHub frontend

### 6. Confirm the backend URL

The supplied `github-pages/app.js` is already connected to:

```javascript
API_URL: "https://script.google.com/macros/s/AKfycbwfrIAKAamLlgwcvdmXmG8GD2wJ6jzpBhoBQyuZJj66X2ieyCgWqUS399IaFoIy-12I/exec",
```

If you create a different Apps Script deployment, replace only the URL inside quotation marks and save the file.

### 7. Upload to GitHub

1. Sign in to GitHub.
2. Create a new public repository, for example **HR-Dashboard**.
3. Open the `github-pages` folder in this package.
4. Upload these three files to the root of the repository:
   - `index.html`
   - `styles.css`
   - `app.js`
5. Commit the uploaded files.

After the page updates, administrators will see **Manage columns**, **Edit headers** and **Edit rows** in the Employee directory heading. Use **Manage columns** to add a new custom field or delete a previously added custom field. Essential HR fields cannot be deleted. Click **Edit headers** to rename the visible headings, then choose **Save headers**. These labels are shared with all dashboard users, while the protected Sheet keys remain unchanged. For employee data, click **Edit rows**, choose a row, update values and click **Save**. Serial number and age are calculated automatically and cannot be typed over.

The six employee summary figures are displayed as a compact strip merged into the top command header, leaving more screen space for the employee directory.

In version 1.6.3 all six cards remain in one colourful row. On phones and very narrow windows, swipe the row sideways to see every figure; it does not wrap into a second row.

Version 1.6.11 adds **Choose columns** in the Employee directory. Tick any fields you want to see, use the up/down arrows to arrange their order, and select **Apply selected view**. You can reopen it and change the selection at any time, or use **Show all columns** to restore the complete table. The view is remembered on that device only and never deletes Sheet data. The separate filled-subject filter still temporarily shows its own selected columns; clearing that filter returns to your customized dashboard view. Both row-click and **Edit employee** popups remain compact, content-sized, centred and four columns wide on desktop.

Version 1.6.12 reduces only the Employee directory data-row height so that more employees are visible together. Names remain bold, badges stay clear and the Edit/Delete controls remain comfortably clickable. The table header, filters and employee popups are unchanged. Version 1.6.13 makes the directory grid still more compact by reducing row height slightly and assigning a sensible minimum width to each field. These widths stay correctly attached to their fields even when dashboard columns are selected or rearranged. Version 1.6.14 narrows the directory columns further and wraps long values neatly over a maximum of two lines. Employee names appear in deep blue, and any column named Pending Work appears in dark red. Version 1.6.15 increases and strengthens directory text, centres table headings and values, and uses gentle teal-blue alternating rows for more comfortable reading. Version 1.6.16 automatically displays Sl No. from 1 for every filtered and sorted result list and continues the sequence correctly on subsequent pages without overwriting the Sheet serial number.

### 8. Enable GitHub Pages

1. Open the repository **Settings**.
2. Select **Pages** from the left side.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the repository branch that contains the published files—often **master** for this repository—and folder **/(root)**. If Pages already shows a different branch or `/docs`, upload future updates to that exact source.
5. Click **Save**.
6. Wait approximately 1–3 minutes, then open the displayed GitHub Pages address.

For the GitHub username `saradasutar`, the expected origin is already allowed: `https://saradasutar.github.io`.

If the GitHub username or custom domain changes, edit the value inside `setAllowedGitHubOrigin()` in `Code.gs`, run that function once, and deploy a **new version** of the Apps Script Web app.

## Part C — Enter or import employee data

### Option 1: Add employees from the dashboard

1. Sign in with the administrator username/password.
2. Click **Add employee**.
3. Enter the details and click **Save employee**.

`AGE` is calculated from `DoB`. If `DoR` is blank, the backend calculates retirement at age 60: retirement is on the last day of the birth month; for a date of birth on the first day of a month, it uses the last day of the previous month.

### Option 2: Upload all employees together

1. Open `Employee_Import_Template.xlsx`.
2. Go to the **Employee Import** sheet.
3. Enter one employee per row from row 5.
4. Keep all 18 header names unchanged.
5. Use `yyyy-mm-dd` for all dates, for example `1976-04-01`.
6. `Employee Name` and `Employee Code` are compulsory. Employee Code must be unique.
7. `Sl No.`, `DoR` and `AGE` may be left blank. Select `Present`, `Relieved`, `Transferred` or `Retired` in `Strength Status`. Enter `Relieving Date` for every status except Present.
8. Select `Sensitive` or `Non-Sensitive` in `Post Sensitivity`.
9. Save only the **Employee Import** sheet as **CSV UTF-8 (Comma delimited)**.
10. In the dashboard, click **Import CSV** and select that CSV file.

If an employee code already exists, the import updates that employee. A new employee code creates a new record.

### Option 3: Replace the complete employee list

Use this only when the selected CSV must become the entire dashboard employee master.

1. Sign in as **Administrator**.
2. Click **Replace all data** and select `Employee_Replacement_Ready_v1.5.5.csv`. This corrected file uses ISO dates and the exact attached column order.
3. Check the displayed employee count.
4. Confirm the replacement and type `REPLACE` when asked.
5. The dashboard first creates `HR_Employee_Auto_Backup_Before_Replace_YYYYMMDD_HHMMSS.csv` in the HR Dashboard Drive folder.
6. Only after that backup succeeds, the old employee rows are cleared and the selected records are loaded.

The replacement rejects the whole file without changing existing data if an employee name/code is missing, a code is duplicated, a date is invalid, Strength Status or Post Sensitivity is blank/invalid, or a relieved/transferred/retired employee has no Relieving Date. Older CSV headers `DoJ in ADG` and `Present/Permanent` are accepted and mapped to `DoJ in Current Office` and `Present/Permanent Address` respectively.

## Daily use and maintenance

- Use the search box to search any displayed field.
- Click any employee row to open a separate read-only profile containing all available details. It shows four information blocks per row on desktop, two on tablets and one on phones. Administrators click the single **Edit employee** button to open the complete vertical editing form.
- To filter by one or multiple subjects/fields, open **Filter by filled subject columns**, tick any number of columns and click **Apply & edit**. A record is included only when every selected column is filled. Click **Edit filtered row** on the required result, then use **Save** or **Cancel** in that same row.
- While this focused filter is active, the table shows only the selected subject columns and Actions. Hidden columns are not deleted or cleared; their values are preserved when a filtered row is saved. Click **Clear field filter** to restore every normal directory column.
- Administrators can use **Manage columns** to add or delete custom employee fields. A custom field appears in the table, search, row editor, full employee form, profile, CSV import/export and Drive backups.
- Click **Reports & Print** to open the Reports Centre. Choose a report type, enter the required reference date, age range, date period or employee category, and click **Generate report**.
- For an age report such as employees aged 50–60 on a future date, select **Age range on selected date**, enter that date, keep minimum age `50` and maximum age `60`, then print or export the result.
- For a present-strength sensitivity report, use the **Present · Sensitive** or **Present · Non-Sensitive** quick report, or select **Present employees by post sensitivity** and choose the required value.
- Use **Print report** for a clean A4 landscape office copy. Use **Export report CSV** when the report needs further editing in Excel or Google Sheets.
- Use Group, Category, Strength Status and Post Sensitivity filters for quick lists.
- Use the Strength Status filter to show only present, relieved, transferred or retired employees.
- Use the Post Sensitivity filter to show only Sensitive, Non-Sensitive or unclassified records.
- Search by any word from the `Present/Permanent Address` using the main search box. Combine search text with Group, Category, Strength Status and Post Sensitivity filters, then click **Print filtered list** for an A4 office report showing the exact matching employees.
- In every generated report, `Post Sensitivity` is included and visually highlighted. Use **Current dashboard filters** in the Reports Centre to reproduce the active directory filters.
- Click a column heading to sort it.
- All filtered employee rows appear together in the scrollable Employee directory—there is no second page. Serial numbers, mobile numbers and dates remain on one line for easier scanning.
- Displayed values use gentle colour highlights for quicker scanning. Editable fields are soft cream and the currently selected field changes to pale yellow with a teal outline; these colours do not change the stored Sheet data.
- Important headings and figures use a restrained metallic finish, while normal employee information stays solid and readable. Fonts are slightly larger throughout the dashboard and Edit Employee form.
- Version 1.6.20 uses a stronger metallic palette with outlines and shadows so the gold, platinum, cobalt and ruby effects remain clearly visible on standard desktop and mobile screens.
- Version 1.6.28 displays every column named Pending Work in solid extra-bold dark red without a metallic gradient. Its table heading uses a deep-red background with white text, and its values use a gentle red highlight in the dashboard and employee-details popup.
- Version 1.6.29 provides **Choose filters** beside **Choose columns**. You can combine and save search text, Group, Category, Strength Status, Post Sensitivity and selected filled subject columns as the device’s default dashboard view. Any active filter automatically enables **Edit filtered row** within the dashboard table for administrators, without requiring the employee popup.
- Version 1.6.30 keeps every Employee directory heading fixed while you scroll down. When visible in the selected view, **Sl No.** and **Employee Name** also remain frozen at the left while you scroll horizontally. This works in the normal dashboard, customized column views, filtered views and direct row editing.
- Version 1.6.31 lets **Choose filters** filter any standard or administrator-created employee column. Select **Add filter rule**, choose the column and condition, enter a value when required, and add more rules if needed. All rules are combined, saved as the default on that device and shown as focused editable columns in the dashboard. Conditions available are Contains, Equals, Does not equal, Starts with, Is filled and Is blank.
- Version 1.6.32 corrects the case where an incomplete added rule could make **Apply filters & save** appear unresponsive. The explanation now appears in bold red inside the filter popup. New rules default to **Is filled**, and when a condition needs text you can type it or choose one of that column's existing values.
- Version 1.6.33 adds a clear **First** control inside **Choose columns**. Because **Sl No.** and **Employee Name** are frozen, selecting **First** beside Pending Work places it in the first movable position—immediately after Employee Name. This saved order is retained in normal and focused filtered views.
- Version 1.6.34 separates showing a column from filtering by its contents. In **Choose filters**, add a rule, choose Pending Work and leave the default condition **Show column — all employees**. Pending Work will appear even when all its cells are empty. Use **Is filled** only when you specifically want employees who already have Pending Work, or **Is blank** to find employees whose Pending Work is still empty.
- Version 1.6.35 makes that separation explicit. Open **Choose filters**, tick Pending Work under **Columns to display — blank values allowed**, and optionally add Group, Status, search or one/multiple value filters below. The chosen display column remains visible even when every cell is blank and is available in **Edit filtered row**. Display choices never exclude employees; only the independent filters do.
- Version 1.6.36 can focus one exact employee cell. Open **Choose filters**, select the employee under **Display a particular cell — blank or filled**, choose the required field and apply. The dashboard shows that employee with Sl No., Employee Name and the selected field even when the cell is empty. Administrators can choose **Edit filtered row** and enter or change the value directly. The selection is saved on that device until cleared or changed.
- Version 1.6.37 removes the different red highlight from Pending Work. Pending Work now looks like any other ordinary dashboard column in the table, popup and editing view. Only an expressly chosen **particular cell** receives the separate gold–violet focus highlight.
- Version 1.6.38 shows the complete Pending Work and REMARK ADMN text directly in the Employee directory. These two fields are left-aligned and fully wrapped, their width responds within a readable range, and only rows containing longer text grow vertically. When editing directly, both fields use multiline boxes that grow with their contents. Other dashboard rows and columns retain the compact layout.
- Version 1.6.39 makes only the entered Pending Work text bold red for quick recognition. The Pending Work heading and cell background are not red and remain consistent with other columns. Full text wrapping, left alignment, automatic row height and direct editing continue to work.
- Version 1.6.40 makes Pending Work and REMARK ADMN narrower and more compact while preserving complete multiline text, left alignment, automatic row height and multiline direct editing.
- Version 1.6.41 removes **Display a particular cell — blank or filled** and reorganises **Filter dashboard** into a simpler, responsive desktop/mobile workflow with larger controls and easier filter application.
- Version 1.6.42 further simplifies filtering to two steps—choose employee conditions and press **Show results**. Column selection remains under **Choose columns**, and the duplicate filled-field controls no longer appear.
- Version 1.6.43 lets you arrange filtered dashboard rows by any column in Ascending or Descending order. Each sortable heading shows ↕ and the active heading shows ↑ or ↓. After filtering, use the separate row ↑ and ↓ buttons beside an employee to change the displayed row order manually; serial numbers refresh automatically. It also enlarges and boldens dashboard, table and popup text on desktop and mobile without changing the backend.
- Version 1.6.44 adds a **Save order** button after a filter is active. Arrange filtered employees with ↑/↓, choose Save order, and the same filter will reopen in that saved order on the same browser/device. Different filter-and-sort combinations can keep separate orders. Use **Reset order** to remove the saved order for only the current filter.
- Version 1.6.45 displays **Print saved filter** when the current filter’s saved employee order has been restored. The report keeps that exact visible sequence, automatically numbers employees from 1, and prints the selected filter conditions. No backend update is required.
- Version 1.6.46 adds a visible vertical scrollbar inside **Filter dashboard**. Scroll only the middle filter controls; the heading and Clear/Cancel/Show arranged results buttons remain fixed. Desktop mouse-wheel, scrollbar dragging and mobile touch scrolling are supported. No backend update is required.
- Version 1.6.47 makes the Filter dashboard dialog itself scroll instead of relying on a nested panel. Use the native scrollbar, mouse wheel, mobile swipe, keyboard Page Up/Page Down, or the fixed ▲ Up and ▼ Down buttons. The heading and bottom action buttons remain sticky. No backend update is required.
- Version 1.6.48 links filtered printing to **Personal dashboard view → Choose dashboard columns**. The print preview, printed document and report CSV now use the same selected columns, visible heading names and order as the employee directory. No backend update is required.
- Version 1.6.49 adds a collapsed **Saved filter views** section inside **Filter dashboard**. Open it, enter a different name for each filter/column/sort combination, and select **Save current choices**. Later click **Open** or **Print** beside any saved view. Views are stored on that browser/device; no backend update is required.
- Version 1.6.50 adds **Move finished pending work** to the employee edit form. Keep each Pending Works item on a separate line, select finished items, choose **Move selected to completed**, and then choose **Save employee**. On first use, the dashboard automatically creates a hidden custom field named **Completed Work History** and records each moved item with its completion date. The normal dashboard continues to show only unfinished work. No backend update is required.
- Version 1.6.51 adds permanent shortcuts so these features cannot be missed. In **Employee directory**, choose **Saved views · number** to open named filter views directly. In **Edit employee**, choose **Move finished work · number** near the top to open the completed-work tool. Saved views remain stored only in that browser/device, so they will not appear in Incognito mode or on a different device unless recreated there. No backend update is required.
- Version 1.6.52 also places **Move finished work** inside every active **Edit filtered row**. Tick completed items in its compact popup, move them, and then choose **Save** in the row. The row editor updates Pending Works and Completed Work History safely even when those columns are not currently displayed. No backend update is required.
- Version 1.6.53 keeps every filtered employee in one scrollable directory and adds permanent **▲ Up** and **▼ Down** controls beside it. The visible scrollbar can also be dragged, and mobile users can swipe. Each newly applied filter starts at the top of its complete result list. No backend update is required.
- Version 1.6.54 repairs **Edit headers** for customized dashboards. Select **Edit headers**, type new names in the visible table headings and select **Save headers**. Hidden column headings are now retained automatically instead of causing the backend to reject the save. No backend update is required.
- Version 1.6.58 retains the complete v1.6.54 dashboard and changes only the Employee directory action-card labels. **Print filtered list**, **Choose columns**, **Filters active** and **Saved views** now use two fixed non-wrapping lines, keeping counts such as `· 5` on the second line. Employee rows and all other dashboard elements remain unchanged. No backend update is required.
- Version 1.6.59 keeps the two-line rule exclusively on those Employee directory action cards. Every employee table field now displays its full value with unlimited centred wrapping, including filtered views; serial number, mobile number and date values remain on one line. No backend update is required.
- Version 1.6.60 makes every filtered employee and selected column reachable from the keyboard. Use Up/Down for employee rows, Left/Right for horizontal columns, Page Up/Page Down for larger vertical jumps and Home/End for the first or last filtered employee. Keyboard operation does not interfere with search boxes, selectors or row-editing fields. No backend update is required.
- Use **Export CSV** to download the currently filtered list.
- Use **Create backup** to save a timestamped CSV in the Drive data folder.
- If you edit the Google Sheet directly, click **Refresh** in the dashboard to bypass the short performance cache.
- Every add, edit, delete, import, replace-all, backup and password change is recorded in **Activity Log**.

## Passwords and access

- **Administrator** can view, add, edit, delete, manage custom columns, import, export and back up data.
- **Viewer** can search, filter, view and export data but cannot change records.
- Sessions expire after six hours and may end sooner if Google clears temporary cache.
- Five failed login attempts temporarily block that username for ten minutes.
- Users can click the lock button at the bottom-right to change their own password.

## Updating later

### Frontend change

Replace the relevant GitHub file and commit it. GitHub Pages updates automatically.

### Backend change

1. Update `Code.gs` in Apps Script.
2. Click **Deploy → Manage deployments**.
3. Edit the existing deployment.
4. Under version, choose **New version**.
5. Click **Deploy**.

The `/exec` URL normally remains unchanged when the existing deployment is updated.

For the strength-status and post-sensitivity updates, replacing and redeploying `Code.gs` automatically applies the required headers without deleting current employee rows. Version 1.5 corrects the address and current-office joining headers, retains legacy CSV aliases, includes the administrator-only safe replace-all endpoint, reapplies the Sensitive/Non-Sensitive validation and refreshes the data cache. Version 1.6.0 adds protected custom-column management. Existing records show **Not set** until an administrator edits each record and selects its Strength Status and Post Sensitivity.

## Important privacy note

The public GitHub repository contains only interface code and the Apps Script URL—no employee records or passwords. Employee data remains in the owner’s Google Sheet and is returned only after backend authentication. Because HR data is confidential, obtain the competent authority’s approval for the chosen hosting and access arrangement, limit who receives credentials, and do not place real employee data in GitHub files.
