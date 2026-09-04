# Nzeru za Alimi

Server-backed farming system for Malawi. One farmer record, written by the mobile app and by USSD, stored on this machine for now.

The HTML files are the original clickable prototype. The real product starts in `server/`.

## Run locally

Needs Node.js 22 or newer (this repo uses the built-in SQLite driver).

```bash
npm install
npm start
```

API: http://localhost:4000/health

Demo farmers (PIN `1234`):

| Name | Phone | Season |
|---|---|---|
| Grace Banda | +265888000001 | at Harvest |
| Joseph Kaunda | +265888000002 | at Land Preparation |
| Estere Mvula | +265888000003 | not started |

Copy `server/.env.example` to `server/.env` before any real deploy. Local development will start without it.

Staff desk: http://localhost:4000/staff  
Demo staff PIN `1234`: Mercy Chirwa `+265888000101` (extension), Joseph Phiri `+265888000102` (cooperative).

## Android farmer app

The farmer UI is wrapped with Capacitor (`android/`). This machine does not have the Android SDK or a JDK yet, so the APK has to be built in Android Studio.

1. Keep `npm start` running (the phone talks to this server).
2. Install [Android Studio](https://developer.android.com/studio) (includes JDK + SDK).
3. From this folder:

```bash
npm run android:sync
npm run android:open
```

4. Run on an emulator. The app defaults to `http://10.0.2.2:4000` (the emulator’s address for your PC). On a physical phone, set the server field to your PC’s LAN IP, e.g. `http://192.168.1.10:4000`, and keep the PC and phone on the same Wi‑Fi.

The Android app logs the same season events as the browser farmer app. USSD stays on a feature phone (or the browser simulator).


## What this server is

- **Farmer identity** — name, Malawi phone, PIN, district/EPA, farmer ID
- **Season events** — eight stages from input redemption to net income, in order
- **Mobile/API** — register, login, log a stage, read status
- **USSD** — Africa's Talking-style `POST /ussd` so a real `*413#` can point here later
- **Extension visit queue** — pest reports, stalled seasons, and harvests not yet taken in, scoped to the officer's EPA
- **Ministry NDVI map** — five-day satellite-style crop health by district, adjusted for live pest reports and weather alerts
- **Plan My Farm** — saved season budget, bankability score, planting windows, and cash-flow plan using live market prices
- **GPS plot mapping** — EPA centroid estimate, phone GPS pin, OpenStreetMap embed, plot NDVI, polygon from plan hectares
- **Live market prices** — pulled from [Ulimi marketplace](https://ulimi.online/) with fallback if the feed is down

Both channels write the same SQLite database (`server/data/dzalasmart.db`). The filename is unchanged so existing local data keeps working.

### Useful commands

```bash
npm test          # API + USSD tests
npm run dev       # auto-restart on file changes
npm run ussd      # type a demo phone and walk the *413# menu
```

The USSD simulator needs the server running in another terminal.

### API

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/farmers/register` | no |
| `POST` | `/api/farmers/login` | no |
| `GET` | `/api/farmers/me` | Bearer token |
| `GET` | `/api/farmers/me/status` | Bearer token |
| `GET` | `/api/farmers/me/plot` | Bearer token |
| `PUT` | `/api/farmers/me/plot` | Bearer token (`lat`, `lon`, optional `accuracyM`, `source: "gps"`) |
| `POST` | `/api/farmers/me/events` | Bearer token |
| `GET` | `/api/stages` | no |
| `GET` | `/api/districts` | no |
| `POST` | `/ussd` | telco posts `phoneNumber` + `text` |

Register body:

```json
{
  "name": "Estere Mvula",
  "phone": "0888000003",
  "pin": "1234",
  "district": "Balaka",
  "epa": "Bazale"
}
```

Log the next season stage (or pass `"stageKey": "planting"` if it is the next one):

```json
POST /api/farmers/me/events
Authorization: Bearer <token>
{}
```

## Deploy later

This is a local working project. When the API, mobile app, and USSD flow are solid, the same server process goes on a real host with a stronger `JWT_SECRET` and a persistent disk (or Postgres). Do not deploy the default secret.

## Prototype site

`index.html` and `prototype.html` are the earlier explainer and in-browser mock. They do not talk to this server yet.
