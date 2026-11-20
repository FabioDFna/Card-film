import { useRef, useState } from 'react'
import { compressImageFile } from '../lib/image'
import { toPosterThumb } from '../lib/tmdb'

type Props = {
  options: string[]
  selected: string
  onSelect: (url: string) => void
}

function isDataUrl(url: string): boolean {
  return url.startsWith('data:')
}

export function PosterPicker({ options, selected, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Seleziona un file immagine.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const dataUrl = await compressImageFile(file)
      onSelect(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento immagine fallito')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="poster-picker">
      <p className="field-label">Scegli il poster</p>
      <div className="poster-picker-grid">
        {options.map((url) => (
          <button
            key={isDataUrl(url) ? `local-${url.length}-${url.slice(-40)}` : url}
            type="button"
            className={`poster-option${url === selected ? ' is-selected' : ''}`}
            onClick={() => onSelect(url)}
            aria-pressed={url === selected}
            disabled={uploading}
          >
            <img
              src={isDataUrl(url) ? url : toPosterThumb(url)}
              alt=""
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          </button>
        ))}
        <button
          type="button"
          className={`poster-option poster-upload${
            isDataUrl(selected) ? ' is-selected' : ''
          }`}
          onClick={() => inputRef.current?.click()}
          title="Carica immagine dal PC"
          disabled={uploading}
        >
          <span className="poster-upload-icon">{uploading ? '…' : '+'}</span>
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
