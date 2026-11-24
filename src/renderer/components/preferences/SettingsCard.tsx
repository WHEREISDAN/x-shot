import { useId, type ReactNode } from 'react';
import styles from './SettingsCard.module.css';

interface SettingsCardProps {
  /** The group label above the card. */
  label: string;
  /** SettingsRow elements, or other content for the card's body. */
  children: ReactNode;
  /** Faint small text under the card, such as a tip. */
  note?: ReactNode;
}

/** A labelled group of settings rows. */
export default function SettingsCard({
  label,
  children,
  note,
}: SettingsCardProps) {
  const labelId = useId();
  return (
    <section className={styles.group} aria-labelledby={labelId}>
      <h2 id={labelId} className={styles.label}>
        {label}
      </h2>
      <div className={styles.card}>{children}</div>
      {note && <div className={styles.note}>{note}</div>}
    </section>
  );
}
