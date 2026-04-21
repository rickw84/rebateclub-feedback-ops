# GitHub Setup

This project is ready to be put into GitHub, but the current machine does not have `git` installed yet.

## What is already prepared

- local build artifacts are ignored
- environment secrets are ignored
- local runtime data is ignored
- imported tracker JSON is ignored

Ignored items include:

- `.next`
- `node_modules`
- `.env`
- `outputs/live-data.json`
- `outputs/payment-tracker-import.json`

## Once Git is installed

Run these commands from the project folder:

```powershell
Set-Location 'C:\Users\ricw5\Documents\Codex\2026-04-20-i-want-to-create-a-project'
git init
git branch -M main
git add .
git commit -m "Initial RebateClub feedback ops app"
```

## Create the GitHub repo

Create an empty GitHub repository in your account, then connect it:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

## On your other device

Clone the repo:

```powershell
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
```

Then install dependencies and run the app:

```powershell
npm install
npm run dev
```

## Recommended workflow

- Use GitHub as the source of truth
- Use Google Drive only for assets, screenshots, SOPs, and media
- Do not sync `node_modules`, `.next`, or runtime JSON between devices

## Optional next step

Once Git is installed, I can help you with:

- the exact first commit
- a cleaner repo structure pass
- adding a private `.env.local.example`
- creating a branch workflow for you and your team
