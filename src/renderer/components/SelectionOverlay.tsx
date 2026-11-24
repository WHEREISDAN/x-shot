import type { SelectionArea } from '../hooks/use-selection';
import type { Size } from '../../shared/crop-geometry';
import cx from '../design-system/class-names';
import styles from './SelectionOverlay.module.css';

interface SelectionOverlayProps {
  selection: SelectionArea | null;
  /** The size of the image the capture will produce; shown as a badge. */
  pixelSize?: Size | null;
}

/** Room the badge needs above the selection before it moves inside. */
const BADGE_ROOM = 32;

export default function SelectionOverlay({
  selection,
  pixelSize,
}: SelectionOverlayProps) {
  if (!selection) return null;
  const { x, y, width, height } = selection;
  const handles: Array<[string, number, number]> = [
    ['top-left', x, y],
    ['top-middle', x + width / 2, y],
    ['top-right', x + width, y],
    ['left-middle', x, y + height / 2],
    ['right-middle', x + width, y + height / 2],
    ['bottom-left', x, y + height],
    ['bottom-middle', x + width / 2, y + height],
    ['bottom-right', x + width, y + height],
  ];

  return (
    <>
      <div
        className={styles.box}
        style={{ left: x, top: y, width, height }}
        data-selection-root="1"
      />
      {handles.map(([name, left, top]) => (
        <div key={name} className={styles.handle} style={{ left, top }} />
      ))}
      {pixelSize && (
        <span
          className={cx(styles.badge, y < BADGE_ROOM && styles.badgeInside)}
          style={{ left: x, top: y }}
          data-size-badge="1"
        >
          {pixelSize.width} × {pixelSize.height}
        </span>
      )}
    </>
  );
}
