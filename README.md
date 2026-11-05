# Litpax Marketing Hub

Owner · Employee · Agency — marketing task tracker (GitHub Pages + Google Apps Script + Sheets).

## Files
- `config.js` — GAS_URL (redeploy ke baad yahin badlo)
- `app.js` — shared helpers (API, dates, modal, comments)
- `index.html` + `login.js` — PIN login
- `owner.html` + `owner.js`, `employee.html` + `employee.js`, `agency.html` + `agency.js`
- `style.css` — saare styles + role themes

## Task flow
- **Internal:** Created → (checkbox tick) Approved. Undo / Reopen possible.
- **Agency:** Created → Forward → In Progress → agency upload → Submit → Review → Approve / Reject (reason zaroori) → Rejected → rework → Submit → Review …
- Koi bhi active task Cancel ho sakta hai (reason ke saath). Kuch delete nahi hota.

## Backend
Code.gs repo mein nahi hai. Pehli baar `setup()` run karo (naye columns, Comments sheet, Drive folder).
Agency user ka `Name` (Users sheet) wahi hona chahiye jo task ke `Agency_Person` mein hai.
