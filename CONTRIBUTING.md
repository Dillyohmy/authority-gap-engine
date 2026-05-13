# Contributing

## Branching

- `main` — production-ready
- `develop` — integration branch
- `feat/<scope>` — new features
- `fix/<scope>` — bug fixes

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scan): add opportunity confidence interval
fix(api): handle redirect loops in crawler
chore(deps): bump playwright to 1.49
```

## Pull requests

1. Branch off `develop`
2. Run `npm test` and `npm run lint` at the root
3. Open a PR with a clear description and link any related issues
4. At least one approval before merge

## Local setup

See the root [`README.md`](./README.md) for the full local workflow.
