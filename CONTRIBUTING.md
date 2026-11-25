# Contributing to Musivault

Thanks for helping out. Bug reports and feature ideas are welcome as issues (there are forms for both); for anything
bigger than a small fix, opening an issue first saves you from building something that doesn't fit.

## Set up

See [Development](README.md#development) in the README. In short: `npm run install:all`, a MongoDB on `:27017`, a
`backend/.env` (see `.env.example`), then `npm run dev`.

## Branches and pull requests

- Fork the repository and branch from `develop`: `feature/<topic>` or `fix/<topic>`.
- **Open the pull request against `develop`, not `main`.** `main` only receives the release merges, and `develop` is
  what the nightly image is built from.
- A pull request can carry several related pieces. Keep each one in its own commit, so every commit can be reviewed
  (and reverted) on its own. Unrelated changes go in separate pull requests.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) with a scope, lowercase and imperative:

```
fix(discogs): build artist albums from the artist endpoint
feat(price): show a release value before adding it
```

## Before you push

```bash
npm run check
```

This runs what CI runs: lint, tests and build, for the frontend and the backend. Individually: `npm run lint`,
`npm run test` and `npm run build` at the root, or `npm run lint`, `npm run test:run` and `npm run build` inside
`frontend/` or `backend/`.

- **Add a test with every fix or feature.** Both sides use Vitest, with `*.test.ts` files next to the code. A test for
  a bug should fail without the fix.
- **Changelog:** add a line per change under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md), in the style of the
  existing entries.
- **Translations:** any new UI string goes into every language in `frontend/src/locales/*/translation.json`, not only
  English.
- **Data changes:** a change to stored data needs a migration registered in `backend/src/scripts/migration-runner.ts`.
- **Version:** don't bump `VERSION` or the `package.json` versions. Releases are cut by the maintainer.

## Pull request description

The pull request template asks what changed and why, and how you checked it. For a change you could try in the app,
say what you ran and saw. Screenshots help for anything visual.
