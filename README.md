# forkuraku

A local-only, Veterans-focused fork of [Hakuraku](https://github.com/ayaliz/hakuraku).

forkuraku keeps the Veterans browser and parent-combo search, and removes the rest of the Hakuraku site. It does not use the Hakuraku backend or account system.

## What is different from Hakuraku

### Veterans-only UI

- Only `/` and `/veterans` render the app. Every other route redirects to `/veterans`.
- Removed the routes and navigation for Race Analysis, Multi-Race Analysis, UmaLogs, Master Data, Notes, Setup Guide, Shop Refresh, Inheritance Factors, Auth, Account, and Privacy Policy.
- Navigation only shows **Veterans**.

### No backend or account system

- Removed login, account, saved-roster loading, shared veteran links, friend-code borrow lookup, and HorseACT account-status checks.
- The app makes no `/api/...` requests on load.
- Veteran data comes from a local JSON file uploaded in **My veterans**. The file is parsed in the browser.
- The upstream race simulator and its `/api/races/resimulate` endpoints are not used by this fork. The pages that called them are no longer routed.

### Local settings

- The uma.moe API key lives in a dedicated **Settings** tab.
- It is saved in browser `localStorage` under `forkuraku.umaMoeApiKey`, not in the build or `.env` files.
- The key is only sent to uma.moe when you run an uma.moe search.
- The last selected target Uma is remembered under `forkuraku.veterans.lastTargetUma`.

### Combo search

- **Best combo** ranks parent pairs for a target Uma, with optional uma.moe parents, parent requirements, conditions, and custom scoring.
- **Best GP combo** ranks pairs by the chance to pass desired skill sparks to a new GP. Spawn chance uses `base × 1.1^N` (base 20% for white skills, 25% for ◎ skills, 40% for gold skills), combined with inherit chance.
- Target innate/awakening skills use 100% inherit chance in GP mode.
- Base aptitudes for every selectable Uma come from GameTora. Red-spark totals raise the starting grade using 1★ = +1, 4★ = +2, 7★ = +3, 10★ = +4, capped at A. The UI breaks down the chance of reaching each proc threshold (≥1, ≥2, ≥3, etc.) needed for S.
- Star conditions show the resulting starting aptitude grades.
- Non-playable characters are filtered out of the target list.
- Kept parent filters, uma.moe pagination, parent spark summaries, per-spark inherit details, and the custom scoring presets.

### GameTora data

- The processed GameTora datasets are committed:
  - `src/data/gametoraCharacterSkills.json`
  - `src/data/gametoraCharacterAptitudes.json`
- The scraper and raw cache are local-only under `data/scraping/` and are gitignored.
- If that folder is present, run `yarn scrape:gametora` to rebuild the datasets. Add `--refresh` to fetch pages again.

### Branding and cleanup

- Renamed to **forkuraku**, with a carrot-on-fork favicon.
- Footer reads: `slopforked from Hakuraku by ayaliz`.
- Social preview metadata is fork-specific.
- Removed the unused notes content, the old social preview image, and several assets that were only used by deleted pages.

## Running

```powershell
yarn install
yarn dev
```

Other useful commands:

```powershell
yarn build

# local-only, requires data/scraping/
yarn scrape:gametora
```

No backend is required for the app itself. The bundled game data in `public/data/` is required.

## Data and privacy

- Uploaded veteran JSON is parsed locally in the browser and is not uploaded to a Hakuraku server.
- The uma.moe API key is stored only in this browser and is sent only to uma.moe for searches.
- There are no Hakuraku account, session, or saved-roster calls in this fork.

## Origin

forkuraku is forked from [ayaliz/hakuraku](https://github.com/ayaliz/hakuraku), which began as a detached fork of [SSHZ-ORG/hakuraku](https://github.com/SSHZ-ORG/hakuraku).

## License

MIT. See [LICENSE](./LICENSE).
