import { useEffect, useRef, useState } from 'react'
import { searchMovies, posterUrl } from '../lib/tmdb'
import type { MovieSearchResult } from '../types'

type Props = {
  onSelect: (tmdbId: number) => void
  disabled?: boolean
}

export function SearchBar({ onSelect, disabled }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MovieSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setError(null)
      return
    }
    const t = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await searchMovies(q)
        setResults(list)
        setOpen(true)
      } catch (err) {
        setResults([])
        setError(err instanceof Error ? err.message : 'Errore ricerca')
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => window.clearTimeout(t)
  }, [query])

  return (
    <div className="search" ref={wrapRef}>
      <label className="field-label" htmlFor="movie-search">
        Cerca un film (TMDB)
      </label>
      <input
        id="movie-search"
        className="input"
        type="search"
        placeholder="Es. Interstellar, Il Padrino…"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {loading && <p className="hint">Cerco…</p>}
      {error && <p className="error">{error}</p>}
      {open && results.length > 0 && (
        <ul className="search-results" role="listbox">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="search-result"
                onClick={() => {
                  onSelect(m.id)
                  setQuery(m.title)
                  setOpen(false)
                }}
              >
                {m.posterPath ? (
                  <img src={posterUrl(m.posterPath, 'w500')} alt="" />
                ) : (
                  <span className="poster-fallback" />
                )}
                <span>
                  <strong>{m.title}</strong>
                  <small>
                    {m.originalTitle !== m.title ? `${m.originalTitle} · ` : ''}
                    {m.releaseDate?.slice(0, 4) || '—'}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
