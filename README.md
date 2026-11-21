# ServerForge

Product page for ServerForge, a Windows-first Tauri desktop app for creating and managing local Minecraft server instances. Version 0.1.0. Early software.

There is no public installer. “Get the app” explains that and does not download anything.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

`npm run dev` starts the local site.

`npm run build` writes the static site to `out/`.

`npm run preview` serves the `out/` build locally.

## Cloudflare Pages

`wrangler.toml` sets the Pages output directory to `out/` and the project name to `serverforge`. It does not attach a custom domain. `serverforge.scorppu.ltd` is not live. This repository does not deploy from these instructions.
