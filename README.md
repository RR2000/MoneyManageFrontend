# Money Manage - web app

Personal finance dashboard: balances of the bank accounts over time, the movements, the worth of the
investments, real estate, and a Monte Carlo projection of the portfolio.
This is the web app (Angular); the REST API is in
[money-manage-backend](https://github.com/RR2000/money-manage-backend).

Demo: https://money.raoulrondinella.dev - register with any username; tick "Start with sample data" to start with a
made-up year of movements, or start empty and import the export files of your bank (Revolut, Degiro,
Unicredit, Intesa Sanpaolo). Every account sees only its own data.

"Forgot your password?" on the login page (and the optional email at registration, and the Account page) appear only
when the backend can send email (`passwordReset` in `GET /api/auth/providers`). The links in the emails open
`/reset-password#token=...` and `/verify-email#token=...`: the token stays in the fragment, so it never reaches a
server log, and the page removes it from the address bar.

The "Banks" page (`/banks`, open banking through the backend) links bank accounts so their movements arrive by
themselves: the consent is given on the bank's site, which comes back to `/banks?result=ok|error`. The menu entry and
the page exist only when `GET /api/account` says `banking: true` (without the flag: when `GET /api/banking/links` does
not answer 404; off, or not for this user, it is 404). Movements
sent by the bank carry a "bank" label in the table.

Languages: English by default, and Italian. The switch is in the menu (and on the login pages) and on the Account page;
the choice is remembered in the browser. A browser in Italian is offered Italian once, on the first visit. Numbers and
dates follow the language. Texts in `src/app/i18n`: `messages.en.ts` and `messages.it.ts` with the same keys (the
compiler checks it), `{{ 'key' | t }}` and `{{ amount | num }}` in templates, one build for both languages. Messages
written by the server (e.g. why a file was refused) are shown as they come.

## Pages

One address per section: `/` overview, `/accounts` and `/accounts/<id>` (one account: balance over time, this month,
movements by day with search, filter and "load more", the bank that imports there, delete), `/investments`, `/plan`,
`/assets`, `/banks`, `/import`, `/settings` (`/more` on a phone). On a wide screen the sections are in a side bar, on a
phone in a bar at the bottom. Light and dark theme follow the system, or the choice in Settings (kept in the browser);
the colours are tokens in `src/styles.scss`, checked at WCAG AA by `scripts/check-contrast.mjs` (part of `npm test`).

## Stack

Angular 22 with Angular Material and Chart.js, unit tests with Vitest. In production nginx serves the app
and forwards `/api` to the backend (same origin, no CORS).

## Run

```bash
npm ci
npm test            # unit tests
npm start           # http://localhost:4200, /api goes to a backend on http://localhost:8080 (proxy.conf.json)
```

A backend for development: in money-manage-backend, `mvn spring-boot:test-run` (embedded PostgreSQL).
Or everything with Docker: `docker compose up --build`, then http://127.0.0.1:8083.

## Image

The CI publishes `ghcr.io/rr2000/money-manage-app:main` (and `:sha-<commit>`) at every push on `main`:
nginx with the built app, forwarding `/api/` to the service `api` on port 8080.

## License

GPL-3.0, see [LICENSE](LICENSE).
