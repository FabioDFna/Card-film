import { useLayoutEffect, useRef } from 'react'

type Props = {
  text: string
  className?: string
  /** Dimensione massima in mm (come nel CSS della carta). */
  maxMm?: number
  /** Dimensione minima in mm. */
  minMm?: number
}

/** Riduce il font finché il testo sta su una sola riga. */
export function FitText({ text, className, maxMm = 7.2, minMm = 3.2 }: Props) {
  const ref = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      let size = maxMm
      el.style.fontSize = `${size}mm`
      el.style.whiteSpace = 'nowrap'
      // binary-ish step down
      let guard = 40
      while (el.scrollWidth > el.clientWidth + 0.5 && size > minMm && guard-- > 0) {
        size -= 0.15
        el.style.fontSize = `${size}mm`
      }
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [text, maxMm, minMm])

  return (
    <h2 ref={ref} className={className}>
      {text}
    </h2>
  )
}
