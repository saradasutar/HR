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

1. At the top of the Apps Script editor, select `setupHRDashboard` from the function list.
2. Click **Run**.
3. Google will ask for permission. Select the owner account and allow access to Sheets and Drive.
4. When complete, the script creates:
   - Drive folder: **ADG(B) HR Dashboard Data**
   - Spreadsheet: **ADG(B) HR Employee Master**
   - Sheet tab: **Employees**
   - Sheet tab: **Activity Log**
5. Now select `setHRDashboardSecurityCodes` and click **Run** once. This applies the usernames and passwords you entered.

The **Employees** sheet contains these columns in the requested order:

`Sl No.`, `Employee Name`, `Employee Code`, `Designation`, `Grp`, `REMARK ADMN`, `DoB`, `DoR`, `Cat`, `DoJ Govt`, `DoJ in ADG`, `Present/Permanent`, `Mob`, `Email`, `AGE`.

### 5. Deploy the backend as a Web app

1. Click **Deploy → New deployment**.
2. Click the gear beside **Select type** and choose **Web app**.
3. Description: **HR Dashboard API v1**.
4. **Execute as:** Me.
5. **Who has access:** Anyone.
6. Click **Deploy**.
7. Copy the Web app URL ending in `/exec`.

Keep the Web app URL. You will paste it into the GitHub frontend.

Official reference: [Google Apps Script Web Apps](https://developers.google.com/apps-script/guides/web).

## Part B — Connect and publish the GitHub frontend

### 6. Connect the backend URL

1. Open the supplied `github-pages/app.js` file.
2. At the top, find:

```javascript
API_URL: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",
```

3. Replace only the text inside quotation marks with the copied `/exec` URL.
4. Save the file.

### 7. Upload to GitHub

1. Sign in to GitHub.
2. Create a new public repository, for example **HR-Dashboard**.
3. Open the `github-pages` folder in this package.
4. Upload these three files to the root of the repository:
   - `index.html`
   - `styles.css`
   - `app.js`
5. Commit the uploaded files.

### 8. Enable GitHub Pages

1. Open the repository **Settings**.
2. Select **Pages** from the left side.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main** and folder **/(root)**.
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
4. Keep all 15 header names unchanged.
5. Use `yyyy-mm-dd` for all dates, for example `1976-04-01`.
6. `Employee Name` and `Employee Code` are compulsory. Employee Code must be unique.
7. `Sl No.`, `DoR` and `AGE` may be left blank.
8. Save only the **Employee Import** sheet as **CSV UTF-8 (Comma delimited)**.
9. In the dashboard, click **Import CSV** and select that CSV file.

If an employee code already exists, the import updates that employee. A new employee code creates a new record.

## Daily use and maintenance

- Use the search box to search any displayed field.
- Use Group, Category and Status filters for quick lists.
- Click a column heading to sort it.
- Use **Export CSV** to download the currently filtered list.
- Use **Create backup** to save a timestamped CSV in the Drive data folder.
- If you edit the Google Sheet directly, click **Refresh** in the dashboard to bypass the short performance cache.
- Every add, edit, delete, import, backup and password change is recorded in **Activity Log**.

## Passwords and access

- **Administrator** can view, add, edit, delete, import, export and back up data.
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

## Important privacy note

The public GitHub repository contains only interface code and the Apps Script URL—no employee records or passwords. Employee data remains in the owner’s Google Sheet and is returned only after backend authentication. Because HR data is confidential, obtain the competent authority’s approval for the chosen hosting and access arrangement, limit who receives credentials, and do not place real employee data in GitHub files.

