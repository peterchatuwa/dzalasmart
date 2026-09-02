# DzalaSmart

A Malawi smallholder farming system prototype: one shared farmer record from seed to sale, usable from a basic phone via USSD (`*413#`) as well as a browser.

This repo is the clickable website and interactive system prototype — not a live production backend.

## What’s in here

- **`index.html`** — public explainer site. Covers the farmer journey, role views, live district weather (Open-Meteo), market indicators, results charts, and an Ask DzalaSmart advisor in English, Chichewa, and Tumbuka.
- **`prototype.html`** — interactive system prototype. Switch between Farmer, Cooperative, Farmers Union, Ministry, Extension, and Funder views; register farmers; advance a season; data is saved in the browser.

Open `index.html` in a browser, or serve the folder locally:

```bash
npx --yes serve .
```

Then go to http://localhost:3000

## Notes

- Weather uses the public [Open-Meteo](https://open-meteo.com/) API (no key).
- Prototype state is stored in `localStorage` on the device that opened it.
- Chichewa and Tumbuka copy is simplified for demo and should be reviewed by a native speaker before any real deployment.
