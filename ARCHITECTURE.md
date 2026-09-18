# Architecture

## Design and deployment model

Shakespeare Reading Desk is an Astro 5 / TypeScript static website. Astro components generate HTML at build time; small browser scripts provide search, line navigation, and quotation tools. There is no React runtime, database, authentication service, runtime API, or server-side search. Node and filesystem access are build-time concerns only.

```text
Folger XML → supplied JSON (conversion is upstream of the site build)
  corpus/plays/*.json
    → discoverPlays() → identity and reader-contract validation
    → ordered sections → Astro getStaticPaths()
       → scene HTML + lines/search HTML
       → lines.json + search.json + citation.json
         → browser tools fetch one play’s index on demand
```

The build does not fetch Folger. Evidence URLs document manual verification; they are not runtime dependencies.

## Data responsibilities

- `corpus/plays`: source content. IDs and titles come from JSON, not filenames.
- `corpus/corpus_manifest.json`: ordering and corpus validation, not a publication allowlist.
- `corpus/characters.json`: supplied character lookup, validated separately; not required for route discovery.
- `metadata/editions.json`: optional Folger source slugs, verified introduction-editor bylines, evidence URL, check date. A web credit does not prove the local edition snapshot.
- `metadata/dataset.json`: maintainer-reported corpus receipt/conversion date. Never used as an edition publication year or automatically changed on rebuild.
- `src/lib/site.ts`: one editable repository-link setting.
- `src/lib/authors.ts`: citation author policy; explicit Shakespeare/Fletcher credit for TNK. Disputed collaborations are explained on Sources rather than asserted as facts.

Unknown source mappings return null without blocking reading. New content requires a rebuild/redeploy, not a route edit. Unknown content kinds and malformed identities fail with file/location context.

## Reader contract and anchors

`src/lib/reader.ts` validates acts, preambles, scenes, and entries while preserving order. Leaf kinds are `line`, `stage_direction`, and `label`. Speech/block containers hold leaf entries; deeper arbitrary nesting is not supported. Unknown kinds fail rather than disappear.

Sections use structural slugs (`part-N-section-N`, `part-N-preamble`) independent of printed act headings. Anchors prefer milestone IDs, stage IDs, then label IDs, with positional fallbacks. These identifiers belong to a corpus snapshot; replacing it can break old links.

Numbered lines enter the line index. Stage directions and source labels remain in search and quotation indexes but are not assigned invented line numbers. `TextEntry.astro` renders labels distinctly. All browser index validators must accept the same leaf kinds as the build contract.

`scenePath()` and index builders require an explicit play ID. `isScenePath()` validates internal destinations before browser navigation.

## Public routes

| Route | Purpose |
| --- | --- |
| `/` | Compact library, automatic play discovery |
| `/about/` | Intended use and dataset provenance |
| `/sources/` | Citation guidance, evidence, rights |
| `/plays/{id}/{section}/` | Reader and citation panel |
| `/plays/{id}/lines/` | No-JavaScript line index |
| `/plays/{id}/search/` | Per-play browser search |
| `/plays/{id}/lines.json` | Reference → section/anchor records |
| `/plays/{id}/search.json` | Search documents including labels/directions |
| `/plays/{id}/citation.json` | Ordered quotation entries, not a bibliography record |

The `.json.ts` route handlers run during static generation: there is no live API. Keep `trailingSlash: 'ignore'` so development permits bare JSON URLs. No single-page-app catch-all rewrite is appropriate.

## Browser behavior

- Scene navigation uses real links/select navigation; reading and line-index links work without JavaScript.
- Search uses normalized text and token/phrase matching from `src/lib/search.ts`; results are rendered as text with explicit highlights.
- Index fetches are lazy per page/play, validated, and retryable. A network failure does not silently produce empty results.
- `src/scripts/citation-tool.ts` controls range selection, formatting, copy fallback, downloads, and the accessible selection shortcut.
- RIS/BibTeX are local Blob downloads; quotation text is not exported as bibliographic metadata.

## Citation policy

`quotation.ts` selects inclusive ranges and preserves intervening non-line text. It derives prose/verse/dialogue status, applies the style registry, escapes output, and generates approved italic/block markup. `citation-styles.ts` contains text-only templates and style guidance; it is not a complete CSL processor.

APA uses a conservative sentence-case map to preserve proper names. Custom formatting explicitly overrides standard layout recommendations. Sources identify the downstream rendition and avoid transferring unverified edition dates/editors. Access date, corpus date, and publication date are distinct concepts.

## Verification and operations

Run typecheck → build → validation/unit tests → preview e2e → dev e2e. Some unit tests inspect generated HTML, so stale output is intentionally a failure. Synthetic-play discovery tests detect new files without registration. All-play loops check generated text, indexes, navigation, search, and citation behavior. Label and coauthor regressions cover full-corpus edge cases.

Production is the generated `dist` directory, freshly built from committed source. Vercel needs no adapter for this static deployment. Tests compare JSON with HTML, not Folger XML; scholarly fidelity and actual hosted behavior remain separate checks. Read DEPLOYMENT.md before publishing.
