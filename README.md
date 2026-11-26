# Money Manage - web app

Personal finance dashboard: balances of the bank accounts over time, the movements, the worth of the
investments, real estate, and a Monte Carlo projection of the portfolio.
This is the web app (Angular); the REST API is in
[money-manage-backend](https://github.com/RR2000/money-manage-backend).

Demo: https://money.raoulrondinella.dev - register with any username; tick "dati di esempio" to start with a
made-up year of movements, or start empty and import the export files of your bank (Revolut, Degiro,
Unicredit, Intesa Sanpaolo). Every account sees only its own data.

"Password dimenticata?" on the login page (and the optional email at registration, and the Account page) appear only
when the backend can send email (`passwordReset` in `GET /api/auth/providers`). The links in the emails open
`/reset-password#token=...` and `/verify-email#token=...`: the token stays in the fragment, so it never reaches a
server log, and the page removes it from the address bar.

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
