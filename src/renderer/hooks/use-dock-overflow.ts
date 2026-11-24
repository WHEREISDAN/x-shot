import { useEffect, useState, type RefObject } from 'react';

/**
 * True while the tool dock is wider than the lane it is centred in, so it
 * reaches under the Presentation panel and the panel must end above it.
 */
export default function useDockOverflow(
  laneRef: RefObject<HTMLElement | null>,
  dockRef: RefObject<HTMLElement | null>,
): boolean {
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const lane = laneRef.current;
    const dock = dockRef.current;
    if (!lane || !dock || typeof ResizeObserver === 'undefined') {
      return () => {};
    }
    const update = () => setOverflows(dock.offsetWidth > lane.clientWidth);
    const observer = new ResizeObserver(update);
    observer.observe(lane);
    observer.observe(dock);
    update();
    return () => observer.disconnect();
  }, [laneRef, dockRef]);

  return overflows;
}
