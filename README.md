# DzalaSmart

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

## What this server is

- **Farmer identity** — name, Malawi phone, PIN, district/EPA, farmer ID
- **Season events** — eight stages from input redemption to net income, in order
- **Mobile/API** — register, login, log a stage, read status
- **USSD** — Africa's Talking-style `POST /ussd` so a real `*413#` can point here later

Both channels write the same SQLite database (`server/data/dzalasmart.db`).

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
