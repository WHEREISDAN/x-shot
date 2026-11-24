import cx from '../class-names';
import styles from './Logo.module.css';

export interface LogoProps {
  size?: number;
  className?: string;
}

/** The X-Shot mark: a white cross and the red spark dot. */
export function Logo({ size = 16, className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cx(styles.logo, className)}
      aria-hidden
    >
      <path
        className={styles.mark}
        d="M4.5 5.5 18.5 19.5M4.5 19.5 14.6 9.4"
        fill="none"
        strokeWidth={3.3}
        strokeLinecap="butt"
      />
      <circle className={styles.spark} cx={19.4} cy={4.8} r={2.7} />
    </svg>
  );
}
