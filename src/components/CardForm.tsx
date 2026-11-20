import type { MovieCard } from '../types'

type Draft = Omit<MovieCard, 'id' | 'createdAt'>

type Props = {
  value: Draft
  onChange: (next: Draft) => void
}

export function CardForm({ value, onChange }: Props) {
  const set = <K extends keyof Draft>(key: K, v: Draft[K]) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="form-grid">
      <label className="field">
        <span className="field-label">Anno uscita</span>
        <input
          className="input"
          type="number"
          min={1888}
          max={2100}
          placeholder="2010"
          value={value.releaseDate.slice(0, 4) || ''}
          onChange={(e) => {
            const y = e.target.value.replace(/\D/g, '').slice(0, 4)
            set('releaseDate', y ? `${y}-01-01` : '')
          }}
        />
      </label>
      <label className="field">
        <span className="field-label">Titolo originale</span>
        <input
          className="input"
          value={value.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Titolo italiano</span>
        <input
          className="input"
          value={value.titleIt}
          onChange={(e) => set('titleIt', e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Durata (minuti)</span>
        <input
          className="input"
          type="number"
          min={0}
          value={value.runtime || ''}
          onChange={(e) => set('runtime', Number(e.target.value) || 0)}
        />
      </label>
      <label className="field field-span">
        <span className="field-label">Generi (separati da virgola)</span>
        <input
          className="input"
          value={value.genres.join(', ')}
          onChange={(e) =>
            set(
              'genres',
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      </label>
      <label className="field field-span">
        <span className="field-label">Paesi (codici ISO, solo bandiere sulla carta)</span>
        <input
          className="input"
          value={value.countries.join(', ')}
          placeholder="CA, US"
          onChange={(e) =>
            set(
              'countries',
              e.target.value
                .split(',')
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean),
            )
          }
        />
      </label>
      <label className="field field-span">
        <span className="field-label">Trama (breve)</span>
        <textarea
          className="input textarea"
          rows={4}
          value={value.overview}
          onChange={(e) => set('overview', e.target.value)}
        />
      </label>
      <label className="field field-span">
        <span className="field-label">Regia</span>
        <input
          className="input"
          value={value.director}
          onChange={(e) => set('director', e.target.value)}
        />
      </label>
      <label className="field field-span">
        <span className="field-label">Sceneggiatura</span>
        <input
          className="input"
          value={value.writers}
          onChange={(e) => set('writers', e.target.value)}
        />
      </label>
    </div>
  )
}
