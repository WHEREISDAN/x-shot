import React, { memo } from 'react';
import { Button, DestructiveButton, PrimaryButton } from '../../design-system';
import { colors, spacing, typography } from '../../design-system/tokens';

interface TopBarProps {
  onDelete: () => void;
  onCopy: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  viewScalePercent: number;
  censorPII: boolean;
  setCensorPII: (next: boolean) => void;
}

const TopBar = memo(function TopBar({
  onDelete,
  onCopy,
  onSave,
  viewScalePercent,
  censorPII,
  setCensorPII,
}: TopBarProps) {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[3],
    background: colors.background.overlay,
    color: colors.text.primary,
    borderBottom: `1px solid ${colors.border.default}`,
  };

  const actionsStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
  };

  const checkboxLabelStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing[2],
    fontSize: typography.fontSize.sm,
    cursor: 'pointer',
  };

  const checkboxStyles: React.CSSProperties = {
    cursor: 'pointer',
  };

  const scaleTextStyles: React.CSSProperties = {
    opacity: 0.8,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  };

  return (
    <div style={containerStyles}>
      <div style={actionsStyles}>
        <DestructiveButton size="sm" onClick={onDelete}>
          Delete
        </DestructiveButton>

        <Button size="sm" onClick={onCopy}>
          Copy
        </Button>

        <PrimaryButton size="sm" onClick={onSave}>
          Save
        </PrimaryButton>

        <label htmlFor="toggle-censor-pii" style={checkboxLabelStyles}>
          <input
            id="toggle-censor-pii"
            type="checkbox"
            checked={censorPII}
            onChange={(e) => setCensorPII(e.target.checked)}
            style={checkboxStyles}
          />
          Censor PII
        </label>
      </div>

      <div style={scaleTextStyles}>{Math.round(viewScalePercent)}%</div>
    </div>
  );
});

export default TopBar;
