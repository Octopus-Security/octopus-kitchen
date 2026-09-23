# octopus-kitchen

A cooking app with a public recipe storefront. One codebase serves two domains:

- **`kitchen.octopustechnology.net`** — the authenticated app: manage your
  recipes, kitchen timers, and safe cooking-temperature references.
- **`food.octopustechnology.net`** — the public storefront: browse recipes that
  have been marked public, no login required.

This is the "control plane + public storefront from one app" pattern used
elsewhere in the estate (the game-server app works the same way): login is
**optional**, and every recipe carries a visibility (`public` / `private`) so
the owner decides what the world sees.

## Architecture

| Concern | Where it lives |
|---|---|
| Recipes, timers, safe temps | this app |
| Recipe visibility + optional auth | this app (owner column, keyed on username) |
| Price checking | delegated to `octopus-shopper`, which holds the store API keys — kitchen calls its internal price endpoint rather than duplicating credentials |
| Auth (SSO) | `octopus-auth` is the only issuer; verified remotely via `@octopus-security/auth-client` |
| Recipe writes from the assistant | a service token (`KITCHEN_SERVICE_TOKEN`) lets the estate's bot save recipes on a user's behalf |

**Stack:** Node + Express, EJS server-rendered views, Sequelize + SQLite,
deployed as a container and fronted by a reverse proxy.

## Data model

A `Recipe` has a title, servings, ingredients (JSON), instructions, tags, a
fridge shelf-life, an `owner`, and a `visibility`. Public-storefront extras
(hero image, prep/cook minutes, summary) feed [Recipe rich
results](https://developers.google.com/search/docs/appearance/structured-data/recipe)
and the photo-led public pages. Every column is nullable/defaulted so schema
changes apply additively — the database is never reset.

## Running locally

```sh
cp .env.example .env      # fill in values
npm install
npm start                 # http://localhost:3014
```

The database is created and seeded with a starter recipe book on first boot.

## Deploy

`main` auto-deploys via the estate's Portainer git-polling. `/api/build`
returns a content-derived stamp so a deploy that landed can be told from one
that didn't:

```sh
curl -s https://food.octopustechnology.net/api/build
```

## Notes

The recipe book was first built inside `octopus-shopper` and moved here so
shopper can stay focused on price comparison. Shopper remains the price engine
kitchen calls.
