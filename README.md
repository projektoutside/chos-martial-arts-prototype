# Cho's Martial Arts App Prototype

Premium mobile-first React prototype for Cho's Martial Arts, based on the public site content and implemented with mocked local functionality.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. For a fixed local URL:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

## Build and Test

```bash
npm run test
npm run build
```

## GitHub Pages

This prototype is ready to deploy as a GitHub Pages project site.

```bash
npm run build:pages
```

The Pages workflow in `.github/workflows/deploy-pages.yml` runs tests, builds the Vite app, creates a `404.html` single-page-app fallback, and deploys the `dist` folder through GitHub Pages. The Vite base path is automatically set from `GITHUB_REPOSITORY`, so the app works from a project URL such as `https://your-user.github.io/your-repo/`.

## Prototype Notes

- No backend, payment processor, SMS provider, email, CAPTCHA, or calendar account integration is used.
- The login intro animation and login page are preserved, then authenticated users enter the Cho's operations workspace.
- Staff tools cover students, classes, scheduling, messages, check-ins, events, merchandise, and dashboard calendar views.
- Prototype operational data persists in `localStorage`, including students, class schedules, text logs, direct messages, merchandise, check-ins, account session, mock accounts, and contact submissions.
- `.ics` actions generate local calendar files.
- Existing loader work was preserved as `legacy-loader.html`; the Vite app owns the root `index.html`.
- Runtime login and operations assets live in `public/` and `src/assets/` so the app works on GitHub Pages.
