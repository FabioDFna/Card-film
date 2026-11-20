import type { MovieCard, MovieSearchResult } from '../types'

const BASE = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p'

function apiKey(): string {
  const key = import.meta.env.VITE_TMDB_API_KEY as string | undefined
  if (!key || key === 'la_tua_chiave_qui') {
    throw new Error(
      'Manca VITE_TMDB_API_KEY. Copia .env.example in .env e inserisci la chiave da themoviedb.org/settings/api',
    )
  }
  return key
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('api_key', apiKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`TMDB ${res.status}: ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

type TmdbSearchMovie = {
  id: number
  title: string
  original_title: string
  release_date?: string
  poster_path: string | null
}

type TmdbCredits = {
  cast: { name: string; order: number }[]
  crew: { name: string; job: string }[]
}

type TmdbGenre = { id: number; name: string }

type TmdbMovieDetail = {
  id: number
  title: string
  original_title: string
  release_date: string
  overview: string
  runtime: number | null
  poster_path: string | null
  genres: TmdbGenre[]
  origin_country?: string[]
  production_countries?: { iso_3166_1: string; name: string }[]
  credits: TmdbCredits
}

type TmdbImage = {
  file_path: string
  iso_639_1: string | null
  vote_average: number
  vote_count: number
}

export function posterUrl(
  path: string | null,
  size: 'w185' | 'w500' | 'w780' | 'original' = 'w780',
): string {
  if (!path) return ''
  return `${IMG}/${size}${path}`
}

/** Thumbnail più leggera per la griglia di scelta. */
export function toPosterThumb(url: string): string {
  return url
    .replace('/original/', '/w185/')
    .replace('/w780/', '/w185/')
    .replace('/w500/', '/w185/')
}

/** Evita URL "original" troppo pesanti / instabili. */
export function normalizePosterUrl(url: string): string {
  return url.replace('/original/', '/w780/')
}

const NAME_PARTICLES = new Set([
  'de',
  'del',
  'della',
  'dei',
  'degli',
  'di',
  'da',
  'dal',
  'van',
  'von',
  'der',
  'den',
  'la',
  'le',
  'du',
  'des',
  'dos',
  'das',
  'st',
  'ste',
])

/** "Francis Ford Coppola" → "F. Coppola"; "Robert De Niro" → "R. De Niro" */
export function formatCreditName(full: string): string {
  const parts = full
    .replace(/,/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]

  const initial = parts[0].charAt(0).toUpperCase()
  const last = parts[parts.length - 1]
  const maybeParticle = parts[parts.length - 2]
  const surname =
    parts.length >= 3 && NAME_PARTICLES.has(maybeParticle.toLowerCase())
      ? `${maybeParticle} ${last}`
      : last

  return `${initial}. ${surname}`
}

/** Lista separata da virgole → nomi abbreviati. */
export function formatCreditList(value: string): string {
  return value
    .split(',')
    .map((s) => formatCreditName(s.trim()))
    .filter(Boolean)
    .join(', ')
}

/** Accorcia la trama a 1–2 frasi, max ~260 caratteri. */
export function shortenOverview(text: string, maxLen = 260): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  if (cleaned.length <= maxLen) return cleaned

  const sentences = cleaned.match(/[^.!?…]+[.!?…]+(?:\s|$)|[^.!?…]+$/g) ?? [cleaned]
  let out = ''
  for (const s of sentences.slice(0, 2)) {
    const next = (out + ' ' + s).trim()
    if (next.length > maxLen && out) break
    out = next
    if (out.length >= maxLen * 0.7) break
  }
  if (!out) out = cleaned.slice(0, maxLen)
  if (out.length > maxLen) {
    const slice = out.slice(0, maxLen)
    const space = slice.lastIndexOf(' ')
    out = (space > 40 ? slice.slice(0, space) : slice).trim() + '…'
  }
  return out.trim()
}

export function formatRuntime(minutes: number): string {
  if (!minutes || minutes <= 0) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

export function releaseYear(iso: string): string {
  if (!iso) return ''
  return iso.slice(0, 4)
}

export async function searchMovies(query: string): Promise<MovieSearchResult[]> {
  const data = await tmdb<{ results: TmdbSearchMovie[] }>('/search/movie', {
    query,
    language: 'it-IT',
    include_adult: 'false',
  })
  return data.results.slice(0, 12).map((m) => ({
    id: m.id,
    title: m.title,
    originalTitle: m.original_title,
    releaseDate: m.release_date ?? '',
    posterPath: m.poster_path,
  }))
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const n of names) {
    if (!seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}

export async function fetchMoviePosters(tmdbId: number, primaryPath?: string | null): Promise<string[]> {
  const data = await tmdb<{ posters: TmdbImage[] }>(`/movie/${tmdbId}/images`, {
    include_image_language: 'it,en,null',
  })

  const ranked = [...data.posters].sort((a, b) => {
    const langScore = (iso: string | null) =>
      iso === 'it' ? 0 : iso === 'en' ? 1 : iso == null ? 2 : 3
    const ld = langScore(a.iso_639_1) - langScore(b.iso_639_1)
    if (ld !== 0) return ld
    return b.vote_average - a.vote_average || b.vote_count - a.vote_count
  })

  const paths = uniqueNames([
    ...(primaryPath ? [primaryPath] : []),
    ...ranked.map((p) => p.file_path),
  ]).slice(0, 16)

  return paths.map((p) => posterUrl(p, 'w780'))
}

export async function fetchMovieForCard(
  tmdbId: number,
): Promise<{ card: Omit<MovieCard, 'id' | 'createdAt'>; posterOptions: string[] }> {
  const movie = await tmdb<TmdbMovieDetail>(`/movie/${tmdbId}`, {
    language: 'it-IT',
    append_to_response: 'credits',
  })

  const directors = uniqueNames(
    movie.credits.crew.filter((c) => c.job === 'Director').map((c) => c.name),
  )
  const writers = uniqueNames(
    movie.credits.crew
      .filter((c) => c.job === 'Screenplay' || c.job === 'Writer')
      .map((c) => c.name),
  ).slice(0, 4)

  const countries =
    movie.production_countries?.map((c) => c.iso_3166_1) ??
    movie.origin_country ??
    []

  const posterOptions = await fetchMoviePosters(tmdbId, movie.poster_path)

  const card = {
    number: 0,
    tmdbId: movie.id,
    title: movie.original_title || movie.title,
    titleIt: movie.title,
    releaseDate: movie.release_date ?? '',
    overview: shortenOverview(movie.overview ?? ''),
    director: formatCreditList(directors.join(', ')),
    writers: formatCreditList(writers.join(', ')),
    genres: movie.genres.map((g) => g.name),
    runtime: movie.runtime ?? 0,
    countries,
    posterUrl: posterOptions[0] ?? posterUrl(movie.poster_path, 'w780'),
    posterFocusX: 50,
    posterFocusY: 50,
  }

  return { card, posterOptions }
}

export function flagUrl(code: string): string {
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`
}
