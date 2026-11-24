import { useId, type CSSProperties } from 'react';
import cx from '../class-names';
import styles from './Slider.module.css';

export interface SliderProps {
  /** Visible label before the track; omit it and set `labelledBy` instead. */
  label?: string;
  /** Names the slider by another element, such as a settings row label. */
  labelledBy?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  id?: string;
}

/** The filled part of the track runs from zero, or from min if it is above zero. */
function fillRange(value: number, min: number, max: number) {
  const span = Math.max(1, max - min);
  const at = (v: number) => ((v - min) / span) * 100;
  const origin = at(Math.min(max, Math.max(min, 0)));
  const current = at(value);
  return {
    '--fill-start': `${Math.min(origin, current)}%`,
    '--fill-end': `${Math.max(origin, current)}%`,
  } as CSSProperties;
}

/** A labelled range with a 3px track, its filled part and the value. */
export function Slider({
  label,
  labelledBy,
  value,
  min,
  max,
  onChange,
  onBlur,
  disabled = false,
  id,
}: SliderProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const range = (
    <input
      id={inputId}
      type="range"
      className={styles.range}
      min={min}
      max={max}
      value={value}
      disabled={disabled}
      aria-labelledby={labelledBy}
      onChange={(event) => onChange(Number(event.target.value))}
      onBlur={onBlur}
      style={fillRange(value, min, max)}
    />
  );
  const readout = (
    <output htmlFor={inputId} className={styles.value} aria-hidden>
      {value}
    </output>
  );
  if (label === undefined) {
    return (
      <span className={cx(styles.slider, styles.unlabelled)}>
        {range}
        {readout}
      </span>
    );
  }
  return (
    <label htmlFor={inputId} className={styles.slider}>
      <span>{label}</span>
      {range}
      {readout}
    </label>
  );
}
