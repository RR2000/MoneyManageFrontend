# Money Manage - web app

Personal finance: the net worth and its parts, the bank accounts and their movements, the investments, the fixed
costs, property, other assets and debts, and a plan of where the investments could be in some years.
This is the web app (Angular); the REST API is in
[money-manage-backend](https://github.com/RR2000/money-manage-backend).

Demo: https://money.raoulrondinella.dev/demo - one click, no password and no sign-up: a sandbox of your own with
made-up data, gone after 24 hours. Or register with any username; tick "Start with sample data" to start with a
made-up year of movements, or start empty and import the export files of your bank (Revolut, Degiro,
Unicredit, Intesa Sanpaolo); an empty account can also load the sample data later, from the overview, Accounts or
Import. Every account sees only its own data.

"Forgot your password?" on the login page (and the optional email at registration, and the email in Settings) appear only
when the backend can send email (`passwordReset` in `GET /api/auth/providers`). The links in the emails open
`/reset-password#token=...` and `/verify-email#token=...`: the token stays in the fragment, so it never reaches a
server log, and the page removes it from the address bar.

"Continue with raoulrondinella.dev" (the single sign-on of the site) appears when `GET /api/auth/providers` says
`oidc: true`, above the password form; with `password: false` (backend `AUTH_MODE=oidc`) it is the only way in. The
backend comes back to `/login#token=...&id_token=...` (both kept in `localStorage`, the id token only for the logout)
or `/login#oidc-error=<code>`, shown next to the button. "Log out" forgets the login here and, after a login with
raoulrondinella.dev, opens its logout (`oidcLogoutUrl` plus `id_token_hint`), which ends the session there too (also
for the other apps that use it) and comes back to the site; without that address (server or provider unreachable) only
here, and the next click on the button may log in again without asking. A 401 (expired token) only forgets the login
here.

Settings offers "Link to raoulrondinella.dev" when `GET /api/account` says `oidc: true` and the account is not linked:
the app asks `POST /api/account/oidc-link` for a link request and goes to the address it gets; the backend comes back to
`/settings#oidc-link=linked&id_token=...` or `/settings#oidc-link-error=<code>`, shown on the page and removed from the
address bar. Linked, it says "Linked to raoulrondinella.dev" and offers "Unlink" with a confirmation (not when
`oidcCanUnlink` is false: raoulrondinella.dev is then the only way in).

"Try the demo" (`/demo`, also the link of the CV and of raoulrondinella.dev, and a button at the bottom of the login
page when `GET /api/auth/providers` says `demo: true`): `POST /api/demo` makes a sandbox with the sample data and its
token becomes the login; a browser already logged in goes straight in (no new sandbox). Over the limits the page says
why (three demos an hour from one connection, too many open, demo off). In a sandbox (`demo: true` in
`GET /api/account`, from the one call per login) a bar stays on top of every page: "Demo: made-up data, gone after
24 hours" and "Create a real account" (out of the sandbox, to the sign-up); it is sticky without covering the page
(its height goes to `--demo-bar-h`, which the side bar and `scroll-padding-top` leave free). Settings says what is off
in a demo instead of the email and raoulrondinella.dev forms; what the backend refuses to a sandbox (`DEMO_NO_BANKING`,
`DEMO_NO_EMAIL`, `DEMO_NO_SSO`, `DEMO_NO_PRICES`, `DEMO_UPLOAD_TOO_LARGE`) is explained where it happens (Banks,
Import, the instruments, Settings), never as a generic error.

The "Banks" page (`/banks`, open banking through the backend) links bank accounts so their movements arrive by
themselves: the consent is given on the bank's site, which comes back to `/banks?result=ok|error`. The menu entry and
the page exist only when `GET /api/account` says `banking: true` (without the flag: when `GET /api/banking/links` does
not answer 404; off, or not for this user, it is 404). Movements
sent by the bank carry a "bank" label in the lists.

Languages: English by default, and Italian. The switch is in the menu (and on the login pages) and in Settings;
the choice is remembered in the browser. A browser in Italian is offered Italian once, on the first visit. Numbers and
dates follow the language. Texts in `src/app/i18n`: `messages.en.ts` and `messages.it.ts` with the same keys (the
compiler checks it), `{{ 'key' | t }}` and `{{ amount | num }}` in templates, one build for both languages. Messages
written by the server (e.g. why a file was refused) are shown as they come.

## Pages

One address per section:

- `/` overview: net worth today and over time with its parts (shares of what is owned, debts as a share of it), "to do"
  (bank consents about to end, syncs that failed, prices that stopped, movements without a category), the plan against
  reality, the fixed costs of the month, the newest movements; empty, it offers Import and the sample data;
- `/accounts` and `/accounts/<id>`: the accounts; one account with its balance over time, this month, the movements by
  day with search, filters, category and "load more", the bank that imports there, delete;
- `/investments`: positions, returns, allocation against a target, the instruments and their prices;
- `/costs`, `/costs/rules`, `/costs/uncategorized`: fixed costs, categories and rules, movements to assign;
- `/plan` and `/plan/<id>`: the plan, its scenarios and versions, planned against real;
- `/assets`: property, other assets and debts;
- `/banks`: open banking (see above);
- `/import`: the files of a bank and of the broker, today's balance of each account;
- `/settings`: account and email, language, theme, log out;
- `/more` on a phone: the sections that are not in the bar at the bottom;
- `/login`, `/forgot-password`, `/reset-password`, `/verify-email`: before the login;
- `/demo`: "Try the demo", a sandbox with made-up data and in (see above).

Old addresses lead to the new pages: `/classic` (the old dashboard with tabs, removed) to `/`, `/setup` to `/import`,
`/account` to `/settings`. On a wide screen the sections are in a side bar (it stays on screen while the page scrolls),
on a phone in a bar at the bottom.

## Theme

Light and dark follow the system, or the choice in Settings (kept in the browser). Every colour is a token in
`src/styles.scss` (`--bg`, `--surface`, `--fg`, `--accent`, `--good`, `--warn`, `--bad`, the chart series...), defined
for both themes; `scripts/check-contrast.mjs` (part of `npm test`) checks the pairs at WCAG AA. The building blocks are
global classes (`.card`, `.btn`, `.chip`, `.tiles`, `.ranges`) and the components in `src/app/ui`: page header, load
state (skeleton at once, error with Retry, empty with the action that fills it), figure, amount (never broken across
lines, sign always written), source tag, chart (Chart.js, the only one, with its data as a table too), icons (inline
SVG in the bundle: no emoji, no icon font, no CDN).

## Accessibility

- one `h1` per page and headings in order; every control has a real label or an accessible name;
- the menu entry of the page has `aria-current="page"`; a skip link leads to the content; the focus is always visible;
- waits, results and errors are announced (`role="status"` / `role="alert"`), never said by colour alone (icon and
  words);
- on a phone the menu and the buttons are at least 44 x 44 px; no horizontal scroll, also at 200% zoom;
- `prefers-reduced-motion` is respected (skeletons stand still, spinners slow down, no transitions).

Checked with axe-core on every page, at 390 and 1280 px (and 640, i.e. 1280 at 200% zoom), light and dark, English and
Italian, with sample data and with an empty account.

## Stack

Angular 22 (standalone components, signals, no zone.js) and Chart.js, unit tests with Vitest. In production nginx serves the app
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
