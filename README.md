# Compound (offline PWA)

Same app as the Claude artifact, different storage engine. Data lives in
`localStorage` on the device itself, so it works with no connection and
installs as a real home-screen app on iPhone and iPad. All files sit flat
in this folder on purpose, no subfolders, so uploading from a phone works
without needing folder-structure support.

## Deploy — phone only, no computer, no git

1. In Safari (or any browser), go to github.com/new, sign in.
2. Repository name: `compound-pwa`. Public. Leave every checkbox unticked.
   Create repository.
3. On the new empty repo page: **Add file → Upload files**.
4. Tap **choose your files**, select every file in this folder (all 8:
   index.html, manifest.json, service-worker.js, the four .png icons,
   README.md). Upload them all in one go, they're all flat, no folder to
   preserve.
5. Scroll down, commit.
6. Settings → Pages → Source: `main` branch, `/ (root)` → Save.
7. Wait about a minute. Your app is live at:
   `https://justasudonoob.github.io/compound-pwa/`

## Deploy — from a computer with git, if you'd rather

```
cd compound-pwa
git init
git add .
git commit -m "Compound PWA"
git branch -M main
git remote add origin https://github.com/JustASudoNooB/compound-pwa.git
git push -u origin main
```
Then the same Settings → Pages step above.

## Install on iPhone and iPad

Do this separately on each device, they don't share storage.

1. Open the URL above in **Safari** specifically, not Chrome.
2. Share icon → **Add to Home Screen** → Add.
3. From now on open it from the home screen icon, not the Safari tab.
   That's what gives it the non-expiring storage bucket iOS reserves for
   installed web apps, a regular Safari tab gets cleared after 7 days of
   inactivity.

## Bringing over data from the Claude-artifact version

Export data in the artifact, import data in this one, footer button on
both. Goals, countdowns, log entries, and history all merge in.
