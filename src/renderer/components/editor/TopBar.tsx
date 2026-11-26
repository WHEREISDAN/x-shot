import { memo } from 'react';
import {
  Copy,
  Download,
  EyeOff,
  Minus,
  PanelRight,
  Plus,
  Redo2,
  Settings,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Island,
  IslandSeparator,
  Switch,
} from '../../design-system';
import openPreferencesWindow from '../../utils/open-preferences';
import styles from './TopBar.module.css';

interface TopBarProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  canZoomOut: boolean;
  canZoomIn: boolean;
  viewScalePercent: number;
  censorPII: boolean;
  setCensorPII: (next: boolean) => void;
  onDelete: () => void;
  onCopy: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  /** Set while the Presentation panel is hidden, to show it again. */
  onShowPanel?: () => void;
  onOpenPreferences?: () => void;
}

/** The two islands under the title strip: history and view, and actions. */
const TopBar = memo(function TopBar({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onZoomOut,
  onZoomIn,
  canZoomOut,
  canZoomIn,
  viewScalePercent,
  censorPII,
  setCensorPII,
  onDelete,
  onCopy,
  onSave,
  onShowPanel,
  onOpenPreferences = openPreferencesWindow,
}: TopBarProps) {
  return (
    <>
      <Island
        layout="bar"
        role="group"
        aria-label="History and view"
        className={styles.history}
      >
        <IconButton
          label="Undo"
          icon={<Undo2 />}
          onClick={onUndo}
          disabled={!canUndo}
        />
        <IconButton
          label="Redo"
          icon={<Redo2 />}
          onClick={onRedo}
          disabled={!canRedo}
        />
        <IslandSeparator />
        <IconButton
          label="Zoom out"
          icon={<Minus />}
          onClick={onZoomOut}
          disabled={!canZoomOut}
        />
        <span className={styles.zoom}>{Math.round(viewScalePercent)}%</span>
        <IconButton
          label="Zoom in"
          icon={<Plus />}
          onClick={onZoomIn}
          disabled={!canZoomIn}
        />
        <IslandSeparator />
        <Switch
          className={styles.censor}
          checked={censorPII}
          onChange={setCensorPII}
        >
          <EyeOff aria-hidden />
          Censor PII
        </Switch>
      </Island>

      <Island
        layout="bar"
        role="group"
        aria-label="Capture actions"
        className={styles.actions}
      >
        {onShowPanel && (
          <IconButton
            label="Show Presentation panel"
            icon={<PanelRight />}
            onClick={onShowPanel}
            tooltipAlign="start"
          />
        )}
        <IconButton
          label="Preferences"
          icon={<Settings />}
          onClick={onOpenPreferences}
        />
        <IconButton
          label="Delete"
          icon={<Trash2 />}
          onClick={onDelete}
          tone="danger"
        />
        <span className={styles.spacer} />
        <span className={styles.actionButtons}>
          <Button icon={<Copy aria-hidden />} onClick={onCopy}>
            Copy
          </Button>
          <Button
            variant="primary"
            icon={<Download aria-hidden />}
            onClick={onSave}
          >
            Save
          </Button>
        </span>
      </Island>
    </>
  );
});

export default TopBar;
