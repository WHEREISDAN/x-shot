import styles from './Magnifier.module.css';

const SIZE = 120;
const ZOOM = 3;
const OFFSET = 24;
const EDGE = 140;

interface MagnifierProps {
  /** The frozen display snapshot the overlay shows. */
  src: string;
  pointer: { x: number; y: number };
}

/** The snapshot under the pointer at 3x, beside the pointer. */
export default function Magnifier({ src, pointer }: MagnifierProps) {
  const centre = SIZE / 2;
  return (
    <div
      className={styles.magnifier}
      style={{
        left: Math.min(pointer.x + OFFSET, window.innerWidth - EDGE),
        top: Math.min(pointer.y + OFFSET, window.innerHeight - EDGE),
        backgroundImage: `url(${src})`,
        backgroundSize: `${window.innerWidth * ZOOM}px ${window.innerHeight * ZOOM}px`,
        backgroundPosition: `${centre - pointer.x * ZOOM}px ${centre - pointer.y * ZOOM}px`,
      }}
      aria-hidden="true"
      data-magnifier="1"
    >
      <div className={styles.pixelGrid} />
      <div className={styles.crosshair} />
    </div>
  );
}
