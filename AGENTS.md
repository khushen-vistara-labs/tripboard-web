# TripBoard project instructions

## Hosting preference

- The user uses **Vercel only**, with Supabase as the backend. Do not ask them to choose between Vercel and ChatGPT Sites again.
- Do not use the ChatGPT Sites skill, tools, source synchronization, or publishing workflow for this repository.
- The existing `.openai/hosting.json` and Sites/Cloudflare development configuration are legacy scaffolding, not an active deployment target.
- Use the existing GitHub-to-Vercel integration: `main` deploys to production; feature branches receive preview deployments.
- For authorized releases, push directly to `main`; create a pull request only if the user asks for one or branch protection requires it.
- `pnpm build` produces the Vercel build. `pnpm build:vercel` remains available as an explicit equivalent.
- `pnpm start` previews the built Vercel output locally through Nitro.
