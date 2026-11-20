export type MovieCard = {
  id: string
  number: number
  tmdbId: number
  title: string
  titleIt: string
  releaseDate: string
  overview: string
  director: string
  writers: string
  genres: string[]
  runtime: number
  countries: string[]
  posterUrl: string
  /** Inquadratura poster (0–100), usata come object-position */
  posterFocusX: number
  posterFocusY: number
  createdAt: string
}

export type MovieSearchResult = {
  id: number
  title: string
  originalTitle: string
  releaseDate: string
  posterPath: string | null
}

function clampFocus(n: unknown, fallback = 50): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(100, Math.max(0, v))
}

export const emptyCard = (): Omit<MovieCard, 'id' | 'createdAt'> => ({
  number: 0,
  tmdbId: 0,
  title: '',
  titleIt: '',
  releaseDate: '',
  overview: '',
  director: '',
  writers: '',
  genres: [],
  runtime: 0,
  countries: [],
  posterUrl: '',
  posterFocusX: 50,
  posterFocusY: 50,
})

/** Compatibilità con carte salvate prima del cambio campi. */
export function normalizeCard(raw: Partial<MovieCard> & { cast?: string[] }): MovieCard {
  const base = emptyCard()
  return {
    ...base,
    ...raw,
    number: raw.number ?? 0,
    writers: raw.writers ?? '',
    genres: raw.genres ?? [],
    runtime: raw.runtime ?? 0,
    countries: raw.countries ?? [],
    posterFocusX: clampFocus(raw.posterFocusX),
    posterFocusY: clampFocus(raw.posterFocusY),
    id: raw.id ?? crypto.randomUUID(),
    createdAt: raw.createdAt ?? new Date().toISOString(),
  }
}
