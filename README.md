# forkuraku

A static local-only, Veterans-focused fork of [Hakuraku](https://github.com/ayaliz/hakuraku).

forkuraku keeps the Veterans browser and parent-combo search, and removes the rest of the Hakuraku site.

### Usage guide for CMs

1. Upload veterans.json, add API key from uma.moe (https://uma.moe/settings, create a new key, copy it in the site. it is saved locally only in your browser) 
2. Select the best combo tab
3. Select your target uma (the uma you will be training)
4. Click custom scoring, inside it select pink preset based on track type, scroll down and select style preset type based on which style your trainee will use (front/pace/late/end). Optionally modify the custom scoring. Click apply and sort.
5. Add any parent requirements if you need specific uniques guaranteed.
6. Toggle on include uma.moe parents if you want to use a borrow. Inside it optionally select characters which you want to search for and what requirements they should fulfill.
7. Add custom conditions if you want. For example if your uma needs to get dirt E to dirt A it is useful to add a 10* dirt condition.
8. On top select which aptitudes you want to get to S.
9. Scroll thru your options. You can click friend codes of uma.moe parents to copy them to clipboard.


### Combo search

- **Best combo** ranks parent pairs for a target Uma, with optional uma.moe parents, parent requirements, conditions, and custom scoring.
- **Best GP combo** ranks pairs by the chance to pass desired skill sparks to a new GP. Spawn chance uses `base × 1.1^N` (base 20% for white skills, 25% for ◎ skills, 40% for gold skills), combined with inherit chance.
- Target innate/awakening skills use 100% inherit chance in GP mode.
- Base aptitudes for every selectable Uma come from GameTora. Red-spark totals raise the starting grade using 1★ = +1, 4★ = +2, 7★ = +3, 10★ = +4, capped at A. The UI breaks down the chance of reaching each proc threshold (≥1, ≥2, ≥3, etc.) needed for S.
- Star conditions show the resulting starting aptitude grades.
- Non-playable characters are filtered out of the target list.
- Kept parent filters, uma.moe pagination, parent spark summaries, per-spark inherit details, and the custom scoring presets.

## Running

```powershell
yarn install
yarn dev
```

Other useful commands:

```powershell
yarn build
```

No backend is required for the app itself. The bundled game data in `public/data/` is required.

## GitHub Pages

The included `.github/workflows/deploy.yml` builds and deploys the app. It:

- Sets `VITE_BASE_PATH` from the Pages base path, so project sites work under `/<repo>/`.
- Sets the React Router basename from `BASE_URL`.
- Generates `404.html` from the built app shell so deep links load the SPA.
- Includes `.nojekyll`.

To deploy, enable GitHub Pages in the repository settings and set the source to **GitHub Actions**. The workflow runs on pushes to `main` and can also be started manually.

## Data and privacy

- Uploaded veteran JSON is parsed locally in the browser and is not uploaded to a Hakuraku server.
- The uma.moe API key is stored only in this browser and is sent only to uma.moe for searches.
- There are no Hakuraku account, session, or saved-roster calls in this fork.

## Origin

forkuraku is forked from [ayaliz/hakuraku](https://github.com/ayaliz/hakuraku), which began as a detached fork of [SSHZ-ORG/hakuraku](https://github.com/SSHZ-ORG/hakuraku).

## License

MIT. See [LICENSE](./LICENSE).
