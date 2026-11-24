import { AppWindow, Monitor, X } from 'lucide-react';
import { Island, IslandSeparator, ToolButton } from '../design-system';
import styles from './QuickDock.module.css';

interface QuickDockProps {
  onToggleWindows: () => void;
  onToggleDisplays: () => void;
  onCancel: () => void;
  windowsOpen: boolean;
  displaysOpen: boolean;
}

export default function QuickDock({
  onToggleWindows,
  onToggleDisplays,
  onCancel,
  windowsOpen,
  displaysOpen,
}: QuickDockProps) {
  return (
    <div
      role="toolbar"
      aria-label="Screenshot quick actions"
      tabIndex={-1}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      data-quick-dock="1"
      className={styles.quickDock}
    >
      <Island layout="dock">
        <ToolButton
          label="Windows"
          icon={<AppWindow />}
          onClick={onToggleWindows}
          active={windowsOpen}
          pressed={windowsOpen}
          showLabel
        />
        <ToolButton
          label="Displays"
          icon={<Monitor />}
          onClick={onToggleDisplays}
          active={displaysOpen}
          pressed={displaysOpen}
          showLabel
        />
        <IslandSeparator />
        <ToolButton
          label="Cancel"
          icon={<X />}
          onClick={onCancel}
          tooltip="Cancel (Esc)"
          showLabel
        />
      </Island>
    </div>
  );
}
