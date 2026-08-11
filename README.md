# ADG(B) HR Dashboard

A responsive employee master dashboard designed for O/o ADG(B), CPWD Bengaluru.

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

## Employee profile view

Click or press Enter on any employee row to open a separate, read-only vertical profile. Details are grouped into Identity and posting, Service details, Personal details and Administration. The profile uses a deep teal-blue header, white heading text, an orange accent, high-contrast bold labels and softly alternating rows for easier reading. Administrators can proceed directly from the profile to the employee editing form.

## Reports Centre

Click **Reports & Print** to prepare office-ready employee reports without changing the source Sheet. Available reports include the current dashboard filters, age range on any selected reference date, retirement between dates, Government/ADG joining between dates, relieving or exit between dates, strength status, present employees by post sensitivity, relieved/transferred/retired staff, group, category, designation and the complete employee list. Every report can be reviewed on screen, printed in A4 landscape format or exported as CSV. Age reports are calculated from Date of Birth on the selected date rather than using the current AGE column.

## Included

- `github-pages/` — public frontend files (`index.html`, `styles.css`, `app.js`)
- `apps-script/` — protected Google Apps Script backend (`Code.gs`, `appsscript.json`)
- `hr-dashboard-package/Employee_Import_Template.xlsx` — bulk employee import template
- `SETUP_GUIDE.md` — non-coder deployment instructions

## Main features

- Administrator and view-only username/password access
- Search across every employee field
- Click any employee row for a full vertical profile view
- Generate printable age, retirement, joining, strength, sensitivity, group, category and designation reports
- Print the current combination of search, group, category, strength, sensitivity and appointment filters
- Group, category, strength-status and post-sensitivity filters
- Add, edit and delete controls for administrators
- CSV bulk import and filtered CSV export
- Google Drive backups and a Sheet activity log
- Automatic AGE and Central Government retirement-date calculation
- Present-strength tracking with relieving/transfer/retirement date
- Sensitive and Non-Sensitive post classification for present-strength reports
- Mobile, tablet and desktop layouts
- No external frontend libraries, for faster loading and easy maintenance

Employee data and password hashes are never stored in the public GitHub files. They remain behind the Google Apps Script backend.
