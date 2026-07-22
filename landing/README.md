# LeaderPrism Landing Site

Public landing page for LeaderPrism. A standalone Next.js app (own Next/React/Tailwind
versions, not shared with `web/`), statically exported and deployed to Azure Static Web Apps.
It is not part of the authenticated product — see the root [CLAUDE.md](../CLAUDE.md) for how it
fits into the monorepo.

## Local development

From the repo root (as part of the workspace):

```bash
npm run dev -w landing
```

Or standalone from this directory:

```bash
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

> `dev` runs `next dev --webpack`. Turbopack's dev-mode PostCSS worker pool currently crashes on
> some Windows setups (`0xc0000142` when compiling `globals.css`) — production builds with
> Turbopack are unaffected, only `next dev` needed the fallback.

## Build

```bash
npm run build -w landing
```

Produces a static export in `landing/out/` (`output: "export"` in `next.config.ts`), which is
what `.github/workflows/deploy-landing.yml` uploads to the Azure Static Web App.

## Structure

```
src/app/          App Router entry (layout, page, globals.css)
src/components/   One folder per section, each with its own .tsx + .css
public/           Images, videos, static assets
```

