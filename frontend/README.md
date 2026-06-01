# frontend

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

## Deploy to Hosting

This project deploys only the built frontend files in `dist` to the VPS hosting path.
It does not restart backend services and does not touch game API, socket, database, or betting logic.

### GitHub Actions

The workflow `.github/workflows/deploy-hosting.yml` builds on every push to `main` and syncs `dist/` to:

```txt
/var/www/casino-game/frontend/dist
```

Add these repository secrets in GitHub before using it:

```txt
SSH_HOST
SSH_USER
SSH_PRIVATE_KEY
SSH_PORT
DEPLOY_PATH
```

Recommended values:

```txt
SSH_PORT=22
DEPLOY_PATH=/var/www/casino-game
```

Use an SSH private key stored in `SSH_PRIVATE_KEY`; do not commit passwords or key files.

### Manual deploy from Windows

Copy `.env.deploy.example` to `.env.deploy.local`, adjust values, then load them in PowerShell:

```powershell
Get-Content .env.deploy.local | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
  }
}
npm run deploy:hosting
```

The manual deploy script creates a remote backup under `/var/www/casino-game/_backups/` before replacing `frontend/dist`.
