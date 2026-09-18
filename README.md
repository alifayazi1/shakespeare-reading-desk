# Shakespeare Reading Desk

An independent companion to [Folger Digital Texts](https://www.folger.edu/explore/shakespeares-works/) for finding, quoting, and citing Shakespeare.

**For sustained reading and editorial context, use Folger’s original website.** This desk is designed for flexible passage searching, direct line links, and convenient quotation and citation—not as a replacement for the Folger edition.

## What it does

- A compact library with direct links to each play’s reader, search, line index, and Folger original.
- Per-play word, prefix, and quoted-phrase search; links to exact passages.
- Act.scene.line navigation, including supplied named references; readable pages and line indexes without JavaScript.
- Single-line and inclusive-range quotations in MLA, Chicago, APA 7, or custom layouts.
- “Cite this range” from selected text (Alt+Shift+C), formatted/plain copying, and RIS/BibTeX metadata downloads.
- Static hosting: no database, account, API key, or external search service.

## Text, credits, and limitations

**2026-07-23** is the date the data was received and built from Folger. This is dataset provenance, not a publication date. The editable source of truth is `metadata/dataset.json`; rebuild after changing it.

All valid supplied JSON play files are discovered at build time. At this documentation pass there are **36 plays**. *All’s Well That Ends Well* (`AWW`) and *Much Ado About Nothing* (`Ado`) are in the 38-play manifest but their JSON bodies are absent. Counts and availability on the website are derived from the files, not this document.

Folger introduction bylines credit **Barbara Mowat and Paul Werstine** as edition editors on all 38 mapped source pages (checked 2026-09-17). They are not the playwrights. *The Two Noble Kinsmen* is explicitly credited by Folger to **William Shakespeare and John Fletcher**; citations and exports include both. See the website’s Sources page for evidence and cautious treatment of disputed collaborations.

The local JSON snapshot has not been compared against the original XML or published edition. Automated tests verify JSON-to-site rendering, text preservation, indexes, and browser behavior—not textual scholarship. Citation entries identify this downstream rendition, omit unverified edition-editor credits and publication dates, and use `n.d.` for APA. Check typography, style requirements, and imported citation-manager records. Search is per play, not global.

## Run locally

Use Node.js 22 or 24 LTS and npm. From the repository root:

```sh
npm ci
npm run dev
```

For the built site:

```sh
npm run check
npm run build
npm run validate
npm test
npm run preview
```

Run each command only after the preceding one succeeds. Open the URL printed by Astro. **Rebuild before previewing newly added corpus files.** A hosted site needs a new deployment as well.

Browser tests use Playwright with Microsoft Edge installed:

```sh
npm run test:e2e
npm run test:e2e:dev
```

These start their own servers on ports 4331 and 4332. Build first. Browser binaries are not needed on Vercel.

## Customize and contribute

- Set the real GitHub repository URL in `src/lib/site.ts` (currently an explicitly labeled placeholder).
- Update the data date in `metadata/dataset.json`, not individual pages.
- Add valid JSON files under `corpus/plays`, then rebuild and test. No route registration is needed.
- Edition evidence belongs in `metadata/editions.json`; authorship exceptions in `src/lib/authors.ts`; APA reference-title casing in `src/lib/citation-styles.ts`.
- Preserve source text and labels. Do not silently discard unknown content to make a build succeed.

## Documentation

- [Architecture](ARCHITECTURE.md): data flow, routes, contracts, citation policies, tests.

## Rights and acknowledgments

With gratitude to the Folger Shakespeare Library, its editors, and the creators of Folger Digital Texts. Folger-derived text © Folger Shakespeare Library, [CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/). Noncommercial use only; retain attribution, license links, and notices of conversion/rendering changes. The public-domain status of Shakespeare’s underlying works does not remove the edition’s license conditions.

Original project code is intended to be MIT licensed, as in the existing project policy. Third-party code retains its own licenses. This project is not affiliated with or endorsed by Folger.
