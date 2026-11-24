import { useId } from 'react';
import cx from '../class-names';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string | number> {
  /** Names the radio group. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** A row of radio buttons drawn as one control. */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(styles.segmented, className)}
    >
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        return (
          <label key={option.value} htmlFor={id} className={styles.option}>
            <input
              id={id}
              type="radio"
              name={name}
              className={styles.input}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
