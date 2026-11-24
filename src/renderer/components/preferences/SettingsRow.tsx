import type { ReactNode } from 'react';
import styles from './SettingsRow.module.css';

interface SettingsRowProps {
  /** Id of the label; the control names itself with it. */
  labelId: string;
  label: string;
  /** Small text under the label; its id is `${labelId}-description`. */
  description?: ReactNode;
  /** The control, on the right. */
  children?: ReactNode;
}

export const descriptionId = (labelId: string) => `${labelId}-description`;

/** One setting: label and description on the left, its control on the right. */
export default function SettingsRow({
  labelId,
  label,
  description,
  children,
}: SettingsRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {description && (
          <span id={descriptionId(labelId)} className={styles.description}>
            {description}
          </span>
        )}
      </div>
      {children && <div className={styles.control}>{children}</div>}
    </div>
  );
}

/** A path in mono on one line, cut with an ellipsis; the full path is its title. */
export function PathText({ path }: { path: string }) {
  return (
    <span className={styles.path} title={path}>
      {path}
    </span>
  );
}
