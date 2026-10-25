# Källkod

Källkoden till spelen i hubben. Mappen börjar med `_`, så GitHub Pages visar den inte som sida.

Den publicerade sidan är de färdigbyggda filerna i repots rot (`index.html`, `games/`).
Mobilversionen (`games/logistik/mobile/`) och spelväljaren har ingen källkod här.

## Struktur

- `games/<spel>/` – ett Vite/React-projekt per spel.
- `games/<spel>/<version>/` – när samma spel finns i flera versioner.
- `hub/` och `games.json` – den första startsidan (ersatt av spelväljaren i roten).
- `scripts/build-all.mjs` – bygger alla spel till `_site/`.
- `.github/workflows/pages.yml` – inaktiv här; fungerar bara i repots rot.

## Bygga ett spel

```bash
cd _kallkod/games/duell
npm ci
npx vite build --base=./
```

Kopiera sedan `dist/index.html` (och ev. bilder) till motsvarande mapp under `games/` i roten.

Använd relativa sökvägar till bilder (`./images/x.jpg`, inte `/images/x.jpg`).
