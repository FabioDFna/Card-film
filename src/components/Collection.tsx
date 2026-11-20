import type { MovieCard } from '../types'

type Props = {
  items: MovieCard[]
  selectedId: string | null
  onSelect: (card: MovieCard) => void
  onDelete: (id: string) => void
}

export function Collection({ items, selectedId, onSelect, onDelete }: Props) {
  if (items.length === 0) {
    return <p className="hint">Nessuna carta salvata. Cerca un film, ritocca i campi e salva.</p>
  }

  return (
    <ul className="collection">
      {items.map((c) => (
        <li key={c.id} className={c.id === selectedId ? 'is-active' : ''}>
          <button type="button" className="collection-item" onClick={() => onSelect(c)}>
            {c.posterUrl ? <img src={c.posterUrl} alt="" /> : <span className="poster-fallback" />}
            <span>
              <strong>{c.titleIt || c.title}</strong>
              <small>{c.releaseDate?.slice(0, 4) || '—'}</small>
            </span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-danger"
            aria-label={`Elimina ${c.title}`}
            onClick={() => onDelete(c.id)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}
