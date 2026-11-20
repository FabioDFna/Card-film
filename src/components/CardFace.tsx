import { forwardRef } from 'react'
import { flagUrl, formatCreditList, formatRuntime, releaseYear } from '../lib/tmdb'
import type { MovieCard } from '../types'
import { FitText } from './FitText'

type Draft = Omit<MovieCard, 'id' | 'createdAt'>

type Props = {
  card: Draft
  side: 'front' | 'back'
}

export const CardFace = forwardRef<HTMLDivElement, Props>(function CardFace(
  { card, side },
  ref,
) {
  if (side === 'front') {
    return (
      <div className="card-face card-front" ref={ref}>
        {card.posterUrl ? (
          <img
            className="card-poster"
            src={card.posterUrl}
            alt=""
            referrerPolicy="no-referrer"
            decoding="async"
            style={{
              objectPosition: `${card.posterFocusX ?? 50}% ${card.posterFocusY ?? 50}%`,
            }}
          />
        ) : (
          <div className="card-poster-empty">Nessun poster</div>
        )}
      </div>
    )
  }

  const year = releaseYear(card.releaseDate)
  const titleIt = card.titleIt || ''
  const runtime = formatRuntime(card.runtime)

  return (
    <div className="card-face card-back" ref={ref}>
      <header className="back-header">
        <div className="back-title-row">
          <FitText className="back-title" text={card.title || 'Titolo'} maxMm={7.2} minMm={3.4} />
        </div>
        {(year || titleIt) && (
          <p className="back-subtitle-row">
            {titleIt && <span className="back-title-it">{titleIt}</span>}
            {year && <span className="back-year">{year}</span>}
          </p>
        )}
        {card.countries.length > 0 && (
          <ul className="back-countries">
            {card.countries.map((code) => (
              <li key={code}>
                <img
                  src={flagUrl(code)}
                  alt={code}
                  width={22}
                  height={16}
                  referrerPolicy="no-referrer"
                />
              </li>
            ))}
          </ul>
        )}
      </header>

      <section className="back-section">
        <h3>Trama</h3>
        <p className="back-overview">{card.overview || '—'}</p>
      </section>

      <section className="back-section back-credits">
        {card.director && (
          <p className="back-credit-line">
            <span className="cred-label">Regia</span>
            <span>{formatCreditList(card.director)}</span>
          </p>
        )}
        {card.writers && (
          <p className="back-credit-line">
            <span className="cred-label">Sceneggiatura</span>
            <span>{formatCreditList(card.writers)}</span>
          </p>
        )}
      </section>

      {(card.genres.length > 0 || runtime) && (
        <footer className="back-footer">
          {card.genres.length > 0 && (
            <p className="back-genres">{card.genres.join(' · ')}</p>
          )}
          {runtime && <p className="back-runtime">{runtime}</p>}
        </footer>
      )}
    </div>
  )
})
