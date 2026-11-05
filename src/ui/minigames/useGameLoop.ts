import { useEffect, useRef } from 'react'

/**
 * Единственный игровой цикл канвасной мини-игры: requestAnimationFrame
 * с зажимом dt (как у главной сцены), останов на размонтировании и на
 * active = false — пауза оверлея, сворачивание вкладки.
 */
export function useGameLoop(callback: (dtMs: number) => void, active: boolean): void {
  const cbRef = useRef(callback)
  cbRef.current = callback
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      cbRef.current(dt)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [active])
}
