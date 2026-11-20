import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { CardFace } from './components/CardFace'
import { CardForm } from './components/CardForm'
import { Collection } from './components/Collection'
import { PosterPicker } from './components/PosterPicker'
import { SearchBar } from './components/SearchBar'
import { downloadPdf, downloadPng, slugify } from './lib/exportCard'
import {
  captureCardPng,
  downloadCollectionSheetPdf,
  type SheetFace,
} from './lib/printSheet'
import {
  downloadCollectionBackup,
  loadCollection,
  mergeCollections,
  readCollectionFile,
  saveCollection,
  StorageQuotaError,
} from './lib/storage'
import { fetchMovieForCard, fetchMoviePosters, normalizePosterUrl } from './lib/tmdb'
import { emptyCard, normalizeCard, type MovieCard } from './types'

type Draft = Omit<MovieCard, 'id' | 'createdAt'>

export default function App() {
  const [draft, setDraft] = useState<Draft>(emptyCard())
  const [collection, setCollection] = useState<MovieCard[]>([])
  const [storageReady, setStorageReady] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [posterOptions, setPosterOptions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [flip, setFlip] = useState<'front' | 'back'>('front')
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const panRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    focusX: number
    focusY: number
  } | null>(null)
  const [panning, setPanning] = useState(false)

  function clampFocus(n: number): number {
    return Math.min(100, Math.max(0, n))
  }

  function resetPosterFocus() {
    setDraft((d) => ({ ...d, posterFocusX: 50, posterFocusY: 50 }))
  }

  function onPosterPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (flip !== 'front' || !draft.posterUrl) return
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    panRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      focusX: draft.posterFocusX ?? 50,
      focusY: draft.posterFocusY ?? 50,
    }
    setPanning(true)
  }

  function onPosterPointerMove(e: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const dx = e.clientX - pan.startX
    const dy = e.clientY - pan.startY
    setDraft((d) => ({
      ...d,
      posterFocusX: clampFocus(pan.focusX - (dx / rect.width) * 100),
      posterFocusY: clampFocus(pan.focusY - (dy / rect.height) * 100),
    }))
  }

  function endPosterPan(e: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan || pan.pointerId !== e.pointerId) return
    panRef.current = null
    setPanning(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // già rilasciato
    }
  }

  useEffect(() => {
    let cancelled = false
    void loadCollection()
      .then((cards) => {
        if (cancelled) return
        setCollection(cards)
        setStorageReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setStorageReady(true)
        setStatus('Impossibile caricare la collezione salvata.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    let cancelled = false
    void saveCollection(collection)
      .then(() => {
        if (cancelled) return
      })
      .catch((err) => {
        if (cancelled) return
        const msg =
          err instanceof StorageQuotaError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Salvataggio collezione fallito'
        setStatus(msg)
      })
    return () => {
      cancelled = true
    }
  }, [collection, storageReady])

  async function importMovie(tmdbId: number) {
    setBusy(true)
    setStatus(null)
    try {
      const { card, posterOptions: options } = await fetchMovieForCard(tmdbId)
      setDraft(card)
      setPosterOptions(options)
      setSelectedId(null)
      setFlip('front')
      setStatus(
        options.length > 1
          ? `Importato. Scegli tra ${options.length} poster.`
          : 'Dati importati da TMDB — puoi ritoccare il form.',
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import fallito')
    } finally {
      setBusy(false)
    }
  }

  function nextCardNumber(cards: MovieCard[]): number {
    const max = cards.reduce((acc, c) => Math.max(acc, c.number || 0), 0)
    return max + 1
  }

  function saveCard() {
    if (!draft.title.trim()) {
      setStatus('Serve almeno un titolo.')
      return
    }
    const now = new Date().toISOString()
    if (selectedId) {
      setCollection((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, ...draft } : c)),
      )
      setStatus('Carta aggiornata.')
    } else {
      const number = draft.number > 0 ? draft.number : nextCardNumber(collection)
      const card: MovieCard = {
        ...draft,
        number,
        id: crypto.randomUUID(),
        createdAt: now,
      }
      setDraft((d) => ({ ...d, number }))
      setCollection((prev) => [card, ...prev])
      setSelectedId(card.id)
      setStatus('Carta salvata in collezione.')
    }
  }

  function newCard() {
    setDraft(emptyCard())
    setPosterOptions([])
    setSelectedId(null)
    setStatus(null)
  }

  async function loadCard(card: MovieCard) {
    const normalized = normalizeCard(card)
    const { id, createdAt: _createdAt, ...rest } = normalized
    void _createdAt
    setDraft({ ...rest, posterUrl: normalizePosterUrl(rest.posterUrl) })
    setSelectedId(id)
    setStatus(null)
    setPosterOptions(rest.posterUrl ? [rest.posterUrl] : [])
    if (rest.tmdbId) {
      try {
        const options = await fetchMoviePosters(rest.tmdbId)
        const merged = [
          ...(rest.posterUrl ? [rest.posterUrl] : []),
          ...options.filter((u) => u !== rest.posterUrl),
        ]
        if (merged.length) setPosterOptions(merged)
      } catch {
        // keep current poster only
      }
    }
  }

  function deleteCard(id: string) {
    setCollection((prev) => prev.filter((c) => c.id !== id))
    if (selectedId === id) newCard()
  }

  async function withVisibleFaces<T>(fn: () => Promise<T>): Promise<T> {
    const slots = document.querySelectorAll<HTMLElement>('.preview-slot')
    const prev = [...slots].map((el) => el.style.opacity)
    slots.forEach((el) => {
      el.style.opacity = '1'
    })
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    try {
      return await fn()
    } finally {
      slots.forEach((el, i) => {
        el.style.opacity = prev[i] ?? ''
      })
    }
  }

  async function exportSide(side: 'front' | 'back') {
    const node = side === 'front' ? frontRef.current : backRef.current
    if (!node) return
    setBusy(true)
    try {
      const base = slugify(draft.titleIt || draft.title)
      await withVisibleFaces(() => downloadPng(node, `${base}-${side}.png`))
      setStatus(`Esportato ${side === 'front' ? 'fronte' : 'retro'} PNG.`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export PNG fallito')
    } finally {
      setBusy(false)
    }
  }

  async function exportBothPdf() {
    if (!frontRef.current || !backRef.current) return
    setBusy(true)
    try {
      const base = slugify(draft.titleIt || draft.title)
      await withVisibleFaces(() =>
        downloadPdf(frontRef.current!, backRef.current!, `${base}.pdf`),
      )
      setStatus('Esportato PDF fronte+retro (63×88 mm).')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export PDF fallito')
    } finally {
      setBusy(false)
    }
  }

  function exportCollectionJson() {
    if (collection.length === 0) {
      setStatus('Nessuna carta da esportare.')
      return
    }
    downloadCollectionBackup(collection)
    setStatus(
      `Collezione esportata (${collection.length} carte). Copia il JSON sul altro PC e usa Importa.`,
    )
  }

  async function importCollectionJson(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      const incoming = await readCollectionFile(file)
      if (incoming.length === 0) {
        setStatus('Il file non contiene carte.')
        return
      }

      const merge = window.confirm(
        `Importo ${incoming.length} carte.\n\nOK = unisci con la collezione attuale\nAnnulla = sostituisci tutta la collezione`,
      )

      if (merge) {
        const merged = mergeCollections(collection, incoming)
        setCollection(merged)
        setStatus(`Collezione unita: ora ${merged.length} carte.`)
      } else {
        setCollection(incoming)
        setStatus(`Collezione sostituita: ${incoming.length} carte.`)
      }

      setSelectedId(null)
      setDraft(emptyCard())
      setPosterOptions([])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import fallito')
    } finally {
      setBusy(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  async function exportCollectionSheet() {
    if (collection.length === 0) {
      setStatus('Salva almeno una carta in collezione.')
      return
    }
    setBusy(true)
    setStatus(`Preparo foglio A4 (9 carte/pagina)… 0/${collection.length}`)
    try {
      const ordered = [...collection].sort((a, b) => (a.number || 0) - (b.number || 0))
      // lascia renderizzare l’host nascosto
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      await new Promise((r) => setTimeout(r, 50))

      const faces: SheetFace[] = []
      for (let i = 0; i < ordered.length; i++) {
        const card = ordered[i]
        const frontNode = document.querySelector<HTMLElement>(
          `.print-capture-host [data-card-id="${card.id}"][data-side="front"] .card-face`,
        )
        const backNode = document.querySelector<HTMLElement>(
          `.print-capture-host [data-card-id="${card.id}"][data-side="back"] .card-face`,
        )
        if (!frontNode || !backNode) {
          throw new Error(`Anteprima mancante per ${card.title}`)
        }
        const [front, back] = await Promise.all([
          captureCardPng(frontNode),
          captureCardPng(backNode),
        ])
        faces.push({ front, back })
        setStatus(`Preparo foglio A4… ${i + 1}/${ordered.length}`)
      }

      await downloadCollectionSheetPdf(faces)
      setStatus(
        `PDF A4 pronto: ${ordered.length} carte, ${Math.ceil(ordered.length / 9)} fogli × 2 facciate. Stampa fronte-retro (ribaltamento lato lungo).`,
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export foglio fallito')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">Collezione personale</p>
          <h1>Carte Film</h1>
        </div>
        <p className="lede">
          Cerca su TMDB, scegli il poster, ritocca i campi e esporta in formato carta 63×88 mm.
        </p>
      </header>

      <div className="layout">
        <aside className="panel">
          <SearchBar onSelect={importMovie} disabled={busy} />
          <div className="panel-actions">
            <button type="button" className="btn" onClick={newCard} disabled={busy}>
              Nuova carta
            </button>
            <button type="button" className="btn btn-primary" onClick={saveCard} disabled={busy}>
              {selectedId ? 'Aggiorna' : 'Salva in collezione'}
            </button>
          </div>
          {status && <p className="status">{status}</p>}
          <PosterPicker
            options={posterOptions}
            selected={draft.posterUrl}
            onSelect={(url) => {
              const next = normalizePosterUrl(url)
              setDraft((d) => ({
                ...d,
                posterUrl: next,
                posterFocusX: 50,
                posterFocusY: 50,
              }))
              setPosterOptions((prev) => (prev.includes(next) ? prev : [next, ...prev]))
            }}
          />
          <CardForm value={draft} onChange={setDraft} />
        </aside>

        <main className="preview-panel">
          <div className="preview-toolbar">
            <div className="flip-toggle" role="group" aria-label="Lato carta">
              <button
                type="button"
                className={flip === 'front' ? 'is-on' : ''}
                onClick={() => setFlip('front')}
              >
                Fronte
              </button>
              <button
                type="button"
                className={flip === 'back' ? 'is-on' : ''}
                onClick={() => setFlip('back')}
              >
                Retro
              </button>
            </div>
            <div className="export-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => exportSide('front')}>
                PNG fronte
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => exportSide('back')}>
                PNG retro
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={exportBothPdf}>
                PDF stampa
              </button>
            </div>
          </div>

          <div className="preview-stage">
            <div className={`preview-stack ${flip}`}>
              <div
                className={`preview-slot front-slot${panning ? ' is-panning' : ''}`}
                aria-hidden={flip !== 'front'}
                onPointerDown={onPosterPointerDown}
                onPointerMove={onPosterPointerMove}
                onPointerUp={endPosterPan}
                onPointerCancel={endPosterPan}
              >
                <CardFace ref={frontRef} card={draft} side="front" />
              </div>
              <div className="preview-slot back-slot" aria-hidden={flip !== 'back'}>
                <CardFace ref={backRef} card={draft} side="back" />
              </div>
            </div>
          </div>
          {draft.posterUrl && flip === 'front' && (
            <div className="poster-focus-bar">
              <p className="hint">Trascina il poster per scegliere l’inquadratura.</p>
              <button type="button" className="btn" onClick={resetPosterFocus} disabled={busy}>
                Centra
              </button>
              <div className="poster-focus-sliders">
                <label>
                  Orizzontale
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draft.posterFocusX ?? 50}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, posterFocusX: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Verticale
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draft.posterFocusY ?? 50}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, posterFocusY: Number(e.target.value) }))
                    }
                  />
                </label>
              </div>
            </div>
          )}
          <p className="hint">
            Anteprima a misura reale CSS: 63×88 mm (standard carte collezionabili).
          </p>
        </main>

        <aside className="panel collection-panel">
          <h2 className="panel-title">Collezione ({collection.length})</h2>
          <div className="panel-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || collection.length === 0}
              onClick={exportCollectionSheet}
            >
              Foglio A4 (9/pagina)
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || collection.length === 0}
              onClick={exportCollectionJson}
            >
              Esporta JSON
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => importInputRef.current?.click()}
            >
              Importa JSON
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => void importCollectionJson(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="hint">
            Per passare da un PC all’altro: Esporta JSON, copia il file (USB/cloud), Importa JSON
            sull’altro PC. Il progetto va copiato a parte; la collezione non è nella cartella del
            codice.
          </p>
          <Collection
            items={collection}
            selectedId={selectedId}
            onSelect={loadCard}
            onDelete={deleteCard}
          />
        </aside>
      </div>

      <div className="print-capture-host" aria-hidden>
        {collection.map((card) => {
          const { id, createdAt: _c, ...face } = card
          void _c
          return (
            <div key={id} className="print-capture-card">
              <div data-card-id={id} data-side="front">
                <CardFace card={face} side="front" />
              </div>
              <div data-card-id={id} data-side="back">
                <CardFace card={face} side="back" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
