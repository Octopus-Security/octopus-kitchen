# octopus-kitchen — notes for working in this repo

**This repo is PUBLIC.** Everything here, this file included, is published.
Assume anything committed is on the open internet forever (a later commit does
not un-publish it; git history is public too).

## The rules that keep it safe to be public

- **No real-name identities.** The public byline/author is the pseudonym
  **Serpopard**. Never write a real name into a recipe, comment, commit message,
  author field, or anywhere else. (The recipe book was ported from a private
  repo with the two real-name references stripped — keep it that way.)
- **No secrets, ever.** All credentials come from env vars set on the Portainer
  stack; `.env` is gitignored and only `.env.example` (placeholders) is tracked.
  Don't commit tokens, keys, or a populated `.env`.
- **No internal specifics baked in.** Internal hostnames/URLs are env vars with
  defaults, not hardcoded constants — keeps the source clean of estate topology.

## What this is

A cooking app serving two domains from one codebase (the estate's control-plane
+ public-storefront pattern): `kitchen.octopustechnology.net` (authenticated
management) and `food.octopustechnology.net` (public recipe storefront, optional
login). See [README.md](README.md).

## Architecture rules

- **Login is optional.** Public recipes render with no session; a session
  unlocks private recipes and management. Per-recipe `visibility` is the gate.
- **A viewer who may not see a recipe gets 404, not 403** — a 403 confirms the
  id exists. (Estate multi-user standard.)
- **Ownership is keyed on username**, matching the rest of the fleet and the
  `X-Service-User` a service call carries, so a recipe saved via the assistant
  is the same row the web app shows.
- **Price checking is delegated to octopus-shopper** — it holds the store API
  keys. Kitchen calls shopper's internal endpoint; it does not hold price keys.

## Data integrity

- **Never reset or drop the database.** Migrations are additive: new columns
  nullable/defaulted, `sync({ alter: true })` only, never `sync({ force: true })`.
  Enforcement lives in this service, not in a prompt.

## Deploy caution

`main` auto-deploys via Portainer. A push ships to production immediately. Check
`/api/build` moved after a deploy. HTML/asset caching follows the estate's
Cloudflare rules (content-hashed asset URLs via `build.js`'s `asset()`).
