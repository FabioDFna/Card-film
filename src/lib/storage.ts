import type { MovieCard } from '../types'
import { normalizeCard } from '../types'
import { shrinkCardPosters } from './image'

const LS_KEY = 'carte-film-collection'
const DB_NAME = 'carte-film'
const DB_VERSION = 1
const STORE = 'kv'
const COLLECTION_ID = 'collection'
const EXPORT_VERSION = 1

export type CollectionBackup = {
  version: number
  exportedAt: string
  cards: MovieCard[]
}

export class StorageQuotaError extends Error {
  constructor(message = 'Spazio di salvataggio insufficiente per la collezione.') {
    super(message)
    this.name = 'StorageQuotaError'
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB non disponibile'))
  })
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(key)
        req.onsuccess = () => resolve(req.result as T | undefined)
        req.onerror = () => reject(req.error)
        tx.oncomplete = () => db.close()
      }),
  )
}

function idbSet(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(value, key)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => {
          const err = tx.error
          db.close()
          if (err?.name === 'QuotaExceededError') {
            reject(new StorageQuotaError())
          } else {
            reject(err ?? new Error('Salvataggio fallito'))
          }
        }
      }),
  )
}

function parseLocalStorageCollection(): MovieCard[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => normalizeCard(item as Partial<MovieCard>))
  } catch {
    return []
  }
}

export async function loadCollection(): Promise<MovieCard[]> {
  try {
    const fromIdb = await idbGet<MovieCard[]>(COLLECTION_ID)
    if (Array.isArray(fromIdb) && fromIdb.length > 0) {
      return fromIdb.map((item) => normalizeCard(item))
    }
  } catch {
    // fallback localStorage
  }

  const fromLs = parseLocalStorageCollection()
  if (fromLs.length > 0) {
    try {
      const shrunk = await shrinkCardPosters(fromLs)
      await idbSet(COLLECTION_ID, shrunk)
      localStorage.removeItem(LS_KEY)
      return shrunk
    } catch {
      return fromLs
    }
  }

  return []
}

export async function saveCollection(cards: MovieCard[]): Promise<void> {
  const shrunk = await shrinkCardPosters(cards)
  try {
    await idbSet(COLLECTION_ID, shrunk)
    try {
      localStorage.removeItem(LS_KEY)
    } catch {
      // ignore
    }
  } catch (err) {
    if (err instanceof StorageQuotaError) throw err
    // Ultimo tentativo: localStorage senza data URL enormi
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(shrunk))
    } catch {
      throw new StorageQuotaError(
        'Immagine troppo grande per il salvataggio. Usa un poster più leggero o togli poster personalizzati.',
      )
    }
  }
}

export function buildBackup(cards: MovieCard[]): CollectionBackup {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    cards,
  }
}

export function downloadCollectionBackup(
  cards: MovieCard[],
  filename = 'carte-film-collezione.json',
): void {
  const backup = buildBackup(cards)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseCollectionBackup(raw: string): MovieCard[] {
  const parsed = JSON.parse(raw) as unknown

  if (Array.isArray(parsed)) {
    return parsed.map((item) => normalizeCard(item as Partial<MovieCard>))
  }

  if (parsed && typeof parsed === 'object' && 'cards' in parsed) {
    const cards = (parsed as CollectionBackup).cards
    if (!Array.isArray(cards)) throw new Error('File collezione non valido.')
    return cards.map((item) => normalizeCard(item as Partial<MovieCard>))
  }

  throw new Error('File collezione non riconosciuto.')
}

export async function readCollectionFile(file: File): Promise<MovieCard[]> {
  const text = await file.text()
  return parseCollectionBackup(text)
}

/** Unisce per id; in caso di stesso id vince la carta importata. */
export function mergeCollections(current: MovieCard[], incoming: MovieCard[]): MovieCard[] {
  const map = new Map<string, MovieCard>()
  for (const c of current) map.set(c.id, c)
  for (const c of incoming) map.set(c.id, c)
  return [...map.values()].sort((a, b) => (a.number || 0) - (b.number || 0))
}
