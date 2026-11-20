# Carte Film

Personal manager for collectible movie cards.

- **Front**: poster only
- **Back**: title, Italian title, release date, countries (with flags), plot, director and main cast
- Data and posters from **TMDB**
- Collection stored in `localStorage`
- **PNG** export (front/back) and printable **PDF** at 63×88 mm (poker size)

## Setup

1. Create a free API key on [TMDB](https://www.themoviedb.org/settings/api)
2. Copy `.env.example` to `.env` and insert your key:

```env
VITE_TMDB_API_KEY=your_key
```

3. Install and start:

```bash
npm install
npm run dev
```

## Usage

1. Search for a movie
2. The fields fill in automatically (you can edit them)
3. Save to the collection
4. Export PNG or PDF when you want to print
