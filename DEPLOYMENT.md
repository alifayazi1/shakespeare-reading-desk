# Deploying to Vercel

This project is a **static Astro site**. Vercel serves the built `dist/` folder directly; no adapter, database, or environment variables are required. The steps below take you from this folder to a public URL, then explain how to update plays and roll back.

## 0. Prerequisites

- A GitHub account and Git installed locally (`git --version`).
- Node.js 22+ installed locally for verification builds.
- Several GB of free disk space for dependencies, browser binaries, and generated pages. The play JSON alone is about 53 MB.
- A Vercel account; check current plan terms and Folger’s noncommercial license before publishing.

## 1. Verify the project before it leaves your machine

From the project root (`c:\Users\Ali\Downloads\New folder_2`), run in order and stop at the first failure:

```sh
npm run check
npm run build
npm run validate
npm test
npm run test:e2e
```

The browser suites require Playwright's Edge channel on Windows; they are not needed for deployment itself. If every command passes, `dist/` is current and deployable.

## 2. Set the repository link (placeholder)

The header, footer, and About page link to a **labeled placeholder** repository URL. Before or after publishing, edit one line in `src/lib/site.ts`:

```ts
repository: 'https://github.com/your-username/shakespeare-reading-desk',
```

Replace it with your real repository URL, then rebuild (`npm run build`) so the change appears in `dist/`. If you deploy from GitHub, commit the change and let the push trigger the rebuild.

## 3. Initialize Git and push to GitHub

The folder is not yet a Git repository. Run:

```sh
git init
git add .
git status --short
git diff --cached --stat
# Inspect staged files for private notes, local tooling, and secrets before committing.
git commit -m "Shakespeare Reading Desk"
```

`.gitignore` already excludes `node_modules/`, `dist/`, `.astro/`, `test-results/`, logs, and local screenshots. Then create an empty repository on GitHub (no README/license selection, to avoid conflicts) and push:

```sh
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

**Do not exclude the corpus.** The JSON files are the site's content and must be committed. GitHub's file limit (100 MB per file) is not approached by these files (largest is under 4 MB).

## 4. Import the project into Vercel

1. Go to [vercel.com](https://vercel.com), sign in with GitHub, and choose **Add New… → Project**.
2. Select the repository you pushed.
3. Vercel detects Astro automatically. Recommended settings (all defaults):
   - Framework preset: **Astro**
   - Root directory: the directory containing `package.json` (repository root for this layout)
   - Node.js version: explicitly choose **22.x or 24.x**; do not rely on the open-ended package engine to select a future major
   - Build command: `npm run check && npm run build && npm run validate && npm test`
   - Output directory: `dist`
   - Install command: `npm ci`
   - Production branch: `main`

   Keep dev dependencies installed: the build/check commands need them. The verification build command intentionally blocks deployment on invalid corpus or stale/missing generated pages; it does not run browser tests.
4. No environment variables, headers, or redirects are needed. The included `vercel.json` pins the framework, build command, and output directory explicitly.
5. Click **Deploy**. First builds take a few minutes because the site generates about 830 pages.

**Command-line alternative:** `npm install -g vercel`, then run `vercel` from the project root. Answer **N** when asked to override settings. Run `vercel --prod` to promote a later build to production.

## 5. Verify the deployment

After the build finishes, open the deployment URL and check:

- The library lists every play (36 in the current corpus).
- Open a scene in *The Tempest* and jump to `EPI.20` (its last supplied reference); the reader should scroll to it. In *Henry V*, test `5.EPI.14` as well.
- Reload a deep scene URL directly, not only through the library. Check `/plays/Tmp/lines.json`, `/plays/Tmp/search.json`, and `/plays/Tmp/citation.json` return JSON, not the homepage.
- Check keyboard navigation, narrow screens, and one copied quotation on the final HTTPS domain.
- Search a play for a phrase in quotation marks; results link to the exact line.
- Open a citation panel, generate a range, and confirm the passage URL starts with the deployed domain — citations copied from `localhost` or `127.0.0.1` must be regenerated on the live site before sharing.
- Spot-check `/about/` and `/sources/`.

## 6. Adding a play after deployment

1. Add the play's JSON file to `corpus/plays/` locally.
2. Commit and push it to GitHub. Vercel builds automatically.
3. If the build fails, fix the file locally: the error names the file and location. Run the verification commands from step 1 before pushing if you want to catch problems early.

Static sites publish exactly what was built. A file added after a deployment appears only after the next one. Development (`npm run dev`) discovers files dynamically; refresh or restart it if its open route list has not updated. It can be used to check a file before pushing.

## 7. Rollback

On the project's **Deployments** page, open any earlier deployment and use **… → Promote to Production** to restore it instantly. Re-deploying a Git commit (from Vercel's UI) produces the same effect. Because each deployment is a complete immutable copy of `dist/`, no server-side cleanup is needed.

## 8. Troubleshooting

| Symptom | Cause and remedy |
| --- | --- |
| Build fails with `unsupported content kind` | The corpus contains an entry kind the reader does not know. Extend `src/lib/reader.ts` (and mirror it in the browser validators) rather than deleting content. This happened with Richard III's `label` entries; the fix is in place and documented in `ARCHITECTURE.md`. |
| Build fails with `duplicate play_id` | Two JSON files share an ID. Fix the new file. |
| A new play does not appear on the deployed site | The deployment predates the file. Trigger a new build/deploy. |
| 404 on a play that exists locally | Same cause: static hosting serves the last build only. Redeploy. |
| Search or line jumps fail only in the browser | The per-play JSON endpoint failed to load; retry. If persistent, check that `dist/plays/<id>/lines.json` exists in the deployment. |
| Wrong dataset date on About/footer | Edit `metadata/dataset.json` and rebuild; never edit the built HTML. |

## 9. Before you announce it

- Replace the placeholder repository URL (step 2).
- Add a LICENSE file (see the rights note in `README.md`).
- Decide whether to keep `README.public.md` synchronized with `README.md`.
- Confirm the GitHub repository contains the corpus and that the deployment serves all plays.
