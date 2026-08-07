# ADG(B) HR Dashboard

A responsive employee master dashboard designed for O/o ADG(B), CPWD Bengaluru.

## Colour refresh v3

This version adds a calm teal–blue–aqua theme with warm orange highlights, colour-coded statistics cards, a gradient office header, a softly tinted employee directory and stronger mobile readability. The Apps Script connection is already set to the current HR backend.

## Included

- `github-pages/` — public frontend files (`index.html`, `styles.css`, `app.js`)
- `apps-script/` — protected Google Apps Script backend (`Code.gs`, `appsscript.json`)
- `hr-dashboard-package/Employee_Import_Template.xlsx` — bulk employee import template
- `SETUP_GUIDE.md` — non-coder deployment instructions

## Main features

- Administrator and view-only username/password access
- Search across every employee field
- Group, category and status filters
- Add, edit and delete controls for administrators
- CSV bulk import and filtered CSV export
- Google Drive backups and a Sheet activity log
- Automatic AGE and Central Government retirement-date calculation
- Mobile, tablet and desktop layouts
- No external frontend libraries, for faster loading and easy maintenance

Employee data and password hashes are never stored in the public GitHub files. They remain behind the Google Apps Script backend.
