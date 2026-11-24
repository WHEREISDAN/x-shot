import cx from '../class-names';
import styles from './ColorDot.module.css';

export interface ColorDotProps {
  color: string;
  selected: boolean;
  onClick: () => void;
}

/** A 16px colour choice; the selected one is ringed. */
export function ColorDot({ color, selected, onClick }: ColorDotProps) {
  return (
    <button
      type="button"
      aria-label={`Color ${color}`}
      aria-pressed={selected}
      onClick={onClick}
      className={cx(styles.colorDot, selected && styles.selected)}
      style={{ background: color }}
    />
  );
}
