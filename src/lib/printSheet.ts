import { jsPDF } from 'jspdf'
import { toPng } from 'html-to-image'

const CARD_W_MM = 63
const CARD_H_MM = 88
const PAGE_W = 210
const PAGE_H = 297
const COLS = 3
const ROWS = 3
export const CARDS_PER_SHEET = COLS * ROWS
const GAP_MM = 1.5

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function inlineExternalImages(root: HTMLElement): Promise<() => void> {
  const imgs = [...root.querySelectorAll('img')]
  const backups = imgs.map((img) => ({ img, src: img.getAttribute('src') ?? '' }))

  await Promise.all(
    imgs.map(async (img) => {
      const src = img.currentSrc || img.src
      if (!src || src.startsWith('data:')) return
      try {
        const res = await fetch(src, { mode: 'cors', referrerPolicy: 'no-referrer' })
        if (!res.ok) return
        img.src = await blobToDataUrl(await res.blob())
      } catch {
        // keep original
      }
    }),
  )

  return () => {
    for (const { img, src } of backups) {
      if (src) img.setAttribute('src', src)
      else img.removeAttribute('src')
    }
  }
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = [...root.querySelectorAll('img')]
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          img.onload = () => resolve()
          img.onerror = () => resolve()
        }),
    ),
  )
}

export async function captureCardPng(node: HTMLElement): Promise<string> {
  await waitForImages(node)
  const restore = await inlineExternalImages(node)
  try {
    return await toPng(node, {
      cacheBust: true,
      pixelRatio: 2.5,
      backgroundColor: '#0c0c0c',
    })
  } finally {
    restore()
  }
}

function sheetOrigin(): { x0: number; y0: number } {
  const gridW = COLS * CARD_W_MM + (COLS - 1) * GAP_MM
  const gridH = ROWS * CARD_H_MM + (ROWS - 1) * GAP_MM
  return {
    x0: (PAGE_W - gridW) / 2,
    y0: (PAGE_H - gridH) / 2,
  }
}

function cellPosition(index: number, mirrorCols: boolean): { x: number; y: number } {
  const row = Math.floor(index / COLS)
  let col = index % COLS
  if (mirrorCols) col = COLS - 1 - col
  const { x0, y0 } = sheetOrigin()
  return {
    x: x0 + col * (CARD_W_MM + GAP_MM),
    y: y0 + row * (CARD_H_MM + GAP_MM),
  }
}

function drawGuides(pdf: jsPDF) {
  const { x0, y0 } = sheetOrigin()
  const gridW = COLS * CARD_W_MM + (COLS - 1) * GAP_MM
  const gridH = ROWS * CARD_H_MM + (ROWS - 1) * GAP_MM
  pdf.setDrawColor(180)
  pdf.setLineWidth(0.1)
  pdf.rect(x0, y0, gridW, gridH)
}

export type SheetFace = { front: string; back: string }

/**
 * PDF A4 con 3×3 carte (63×88 mm).
 * Pagine alternate fronte / retro, colonne del retro specchiate
 * per stampa fronte-retro con ribaltamento sul lato lungo.
 */
export async function downloadCollectionSheetPdf(
  faces: SheetFace[],
  filename = 'carte-film-foglio-a4.pdf',
): Promise<void> {
  if (faces.length === 0) throw new Error('Nessuna carta da stampare.')

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let firstPage = true

  for (let i = 0; i < faces.length; i += CARDS_PER_SHEET) {
    const chunk = faces.slice(i, i + CARDS_PER_SHEET)

    if (!firstPage) pdf.addPage('a4', 'portrait')
    firstPage = false
    drawGuides(pdf)
    chunk.forEach((face, idx) => {
      const { x, y } = cellPosition(idx, false)
      pdf.addImage(face.front, 'PNG', x, y, CARD_W_MM, CARD_H_MM)
    })

    pdf.addPage('a4', 'portrait')
    drawGuides(pdf)
    chunk.forEach((face, idx) => {
      const { x, y } = cellPosition(idx, true)
      pdf.addImage(face.back, 'PNG', x, y, CARD_W_MM, CARD_H_MM)
    })
  }

  pdf.save(filename)
}

export { CARD_W_MM, CARD_H_MM }
