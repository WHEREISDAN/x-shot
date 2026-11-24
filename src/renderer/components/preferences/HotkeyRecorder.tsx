import { useEffect, useId, useRef, useState } from 'react';
import { Hotkey, KeyCap } from '../../design-system';
import cx from '../../design-system/class-names';
import acceleratorFromKeyEvent from './hotkey-accelerator';
import styles from './HotkeyRecorder.module.css';

interface HotkeyRecorderProps {
  /** Id of the row label that names the shortcut. */
  labelId: string;
  /** The stored accelerator, e.g. `CommandOrControl+Shift+1`. */
  value: string | null;
  onRecord: (accelerator: string) => void;
  /** Lets Backspace or Delete clear the shortcut; omit for a required one. */
  onClear?: () => void;
}

/**
 * A shortcut as key caps. Clicking it records the next combo; Escape or
 * leaving the button cancels. Keys are listened for only while recording.
 */
export default function HotkeyRecorder({
  labelId,
  value,
  onRecord,
  onClear,
}: HotkeyRecorderProps) {
  const [recording, setRecording] = useState(false);
  const contentId = useId();
  // Set at once, so a key pressed before React re-renders is not recorded.
  const recordingRef = useRef(false);
  const callbacks = useRef({ onRecord, onClear });
  callbacks.current = { onRecord, onClear };

  const stop = () => {
    recordingRef.current = false;
    setRecording(false);
  };

  useEffect(() => {
    if (!recording) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!recordingRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      const hasModifier =
        event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
      if (event.key === 'Escape' && !hasModifier) {
        stop();
        return;
      }
      const clear = callbacks.current.onClear;
      if (
        (event.key === 'Backspace' || event.key === 'Delete') &&
        !hasModifier
      ) {
        if (!clear) return;
        stop();
        clear();
        return;
      }
      const accelerator = acceleratorFromKeyEvent(event);
      if (!accelerator) return;
      stop();
      callbacks.current.onRecord(accelerator);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recording]);

  const content = () => {
    if (recording) {
      return (
        <>
          <span className={styles.dot} aria-hidden />
          Press shortcut…
          <KeyCap>Esc</KeyCap>
        </>
      );
    }
    if (value) return <Hotkey accelerator={value} />;
    return 'Record shortcut';
  };

  return (
    <button
      type="button"
      aria-labelledby={`${labelId} ${contentId}`}
      onClick={() => {
        recordingRef.current = true;
        setRecording(true);
      }}
      onBlur={stop}
      className={cx(
        styles.recorder,
        recording && styles.recording,
        !recording && !value && styles.unset,
      )}
    >
      <span id={contentId} className={styles.content}>
        {content()}
      </span>
    </button>
  );
}
