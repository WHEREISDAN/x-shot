import styles from './DimOverlays.module.css';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface DimOverlaysProps {
  top: Rect;
  left: Rect;
  right: Rect;
  bottom: Rect;
}

/** Darkens everything outside the selection, or the whole display without one. */
export default function DimOverlays({
  top,
  left,
  right,
  bottom,
}: DimOverlaysProps) {
  return (
    <>
      <div className={styles.dim} style={top} />
      <div className={styles.dim} style={left} />
      <div className={styles.dim} style={right} />
      <div className={styles.dim} style={bottom} />
    </>
  );
}
