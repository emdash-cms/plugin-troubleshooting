# @emdash-cms/plugin-troubleshooting

EmDash plugin for resolving runtime shenanigans (object cache + Workers Cache
today; more tools over time).

Adds a **Troubleshooting** admin page with the description "Resolve EmDash shenanigans".

### Object cache clear

Requires EmDash **≥ 0.32.0** with the `cache:purge` capability and
`POST /_emdash/api/admin/cache/object`. The plugin stays **sandboxed** and
calls `ctx.cache.purgeObjectCache()`.

### Workers Cache clear

Same capability. Calls `ctx.cache.purgeWorkersCache()`, which uses native
Workers Caching (`cache.purge({ purgeEverything: true })` from
`cloudflare:workers`). Enable with wrangler `"cache": { "enabled": true }` and
Astro `cacheCloudflare()` — **no zone ID or API token**. Button is disabled when
native purge is unavailable (e.g. Node / cache not enabled).

> **Note on Settings hub:** EmDash does not currently let plugins inject tabs into the core Settings screen (`/_emdash/admin/settings`). Plugin admin pages appear in the sidebar under the plugin name (and in the command palette). This plugin registers a page labeled **Troubleshooting** there.

## Install

### From npm (after publish)

```bash
pnpm add @emdash-cms/plugin-troubleshooting
```

### From GitHub

```bash
pnpm add github:emdash-cms/plugin-troubleshooting
# or a tagged release:
pnpm add github:emdash-cms/plugin-troubleshooting#v0.1.0
```

### From a local checkout

```bash
# In the plugin package
pnpm install && pnpm build

# In your EmDash site
pnpm add file:../plugin-troubleshooting
```

### Register in `astro.config.mjs`

```js
import troubleshooting from "@emdash-cms/plugin-troubleshooting";
import { sandbox } from "@emdash-cms/cloudflare";
import emdash from "emdash/astro";

export default defineConfig({
  integrations: [
    emdash({
      // Prefer sandboxed when a sandbox runner is available (Cloudflare):
      sandboxed: [troubleshooting],
      sandboxRunner: sandbox(),

      // Or run in-process on platforms without a sandbox runner:
      // plugins: [troubleshooting],
    }),
  ],
});
```

Cloudflare sites need a Worker Loader binding in `wrangler.jsonc`:

```jsonc
{
  "worker_loaders": [{ "binding": "LOADER" }]
}
```

Then start the site (`pnpm dev` / `npx emdash dev`) and open:

`/_emdash/admin/plugins/troubleshooting/`  
(Sidebar label: **Troubleshooting**. The Plugin Manager “Plugin pages” button opens this root path.)

## Develop

```sh
pnpm install
pnpm test
pnpm build
# watch mode while iterating against a local site:
pnpm dev
```

## Marketplace / registry publish

1. `emdash-plugin bundle` → upload the tarball (GitHub Release asset, R2, etc.).
2. `emdash-plugin publish --url <public-tarball-url>`.

Publisher DID is already set to the first-party Atmosphere account (`plugins.emdashcms.com`).

## Version bumps

Bump `version` in `package.json` for each release (the build reads it from there).

- **major** — trust-contract changes (`capabilities`, `allowedHosts`, `storage`) or breaking UI/API
- **minor** — new routes, hooks, or admin pages
- **patch** — fixes
