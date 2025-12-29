# Borders

A geography guessing game where you name all the countries that border a given country.

## How to Play

1. You'll be shown a random country (with at least 2 borders)
2. Type country names in the search box - fuzzy search helps with typos
3. Find all neighboring countries before running out of attempts
4. You have 6 wrong guesses allowed
5. Win by naming all bordering countries!

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Deployment

The app is configured for GitHub Pages deployment at `borders.lessismore.studio`.

Push to `main` branch to trigger automatic deployment via GitHub Actions.

## Tech Stack

- React 19 + TypeScript
- Vite
- Fuse.js (fuzzy search)
- i18next (internationalization)
- CSS (custom styling, no framework)
