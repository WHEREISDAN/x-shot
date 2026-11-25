import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EditorSection from '../renderer/components/preferences/EditorSection';
import type { AppPreferences, PreferencesUpdate } from '../shared/ipc-types';
import { deepMerge } from '../shared/deep-merge';
import PREFERENCES from './fixtures/preferences';

function Harness({
  initial = PREFERENCES,
  onUpdateSpy,
  onFlushSpy,
}: {
  initial?: AppPreferences;
  onUpdateSpy: jest.Mock;
  onFlushSpy: jest.Mock;
}) {
  const [prefs, setPrefs] = useState<AppPreferences>(initial);
  return (
    <>
      <EditorSection
        preferences={prefs}
        onUpdate={async (updates: PreferencesUpdate, options) => {
          onUpdateSpy(updates, options);
          setPrefs((current) => deepMerge(current, updates));
          return true;
        }}
        onFlush={onFlushSpy}
      />
      <button type="button" onClick={() => setPrefs(initial)}>
        External Reset
      </button>
    </>
  );
}

describe('EditorSection custom hex inputs', () => {
  it('allows typing and backspacing stroke hex and commits valid normalized hex', () => {
    const onUpdate = jest.fn();
    const onFlush = jest.fn();
    render(<Harness onUpdateSpy={onUpdate} onFlushSpy={onFlush} />);

    const strokeInput = screen.getByLabelText('Custom Stroke Color');
    expect(strokeInput).toHaveValue('#ef4444');

    // Backspace / partial typing must not snap back.
    fireEvent.change(strokeInput, { target: { value: '#ef444' } });
    expect(strokeInput).toHaveValue('#ef444');
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.change(strokeInput, { target: { value: '#12' } });
    expect(strokeInput).toHaveValue('#12');
    expect(onUpdate).not.toHaveBeenCalled();

    // Valid uppercase hex commits normalized lowercase.
    fireEvent.change(strokeInput, { target: { value: '#1A2B3C' } });
    expect(onUpdate).toHaveBeenCalledWith(
      { editor: { defaultStrokeColor: '#1a2b3c' } },
      { debounce: true },
    );
    expect(strokeInput).toHaveValue('#1a2b3c');
  });

  it('reverts invalid stroke draft on blur and flushes', () => {
    const onUpdate = jest.fn();
    const onFlush = jest.fn();
    render(<Harness onUpdateSpy={onUpdate} onFlushSpy={onFlush} />);

    const strokeInput = screen.getByLabelText('Custom Stroke Color');
    fireEvent.change(strokeInput, { target: { value: '#12z' } });
    expect(strokeInput).toHaveValue('#12z');

    fireEvent.blur(strokeInput);
    expect(strokeInput).toHaveValue('#ef4444');
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('allows editing fill hex, accepts transparent, reverts invalid on blur, and syncs external reset', () => {
    const onUpdate = jest.fn();
    const onFlush = jest.fn();
    render(<Harness onUpdateSpy={onUpdate} onFlushSpy={onFlush} />);

    const fillInput = screen.getByLabelText('Custom Fill Color');
    expect(fillInput).toHaveValue('transparent');

    // Partial typing works freely.
    fireEvent.change(fillInput, { target: { value: '#00ff' } });
    expect(fillInput).toHaveValue('#00ff');
    expect(onUpdate).not.toHaveBeenCalled();

    // Valid hex commits.
    fireEvent.change(fillInput, { target: { value: '#00FF88' } });
    expect(onUpdate).toHaveBeenLastCalledWith(
      { editor: { defaultFillColor: '#00ff88' } },
      { debounce: true },
    );
    expect(fillInput).toHaveValue('#00ff88');

    // Invalid edit reverts to last valid value on blur.
    fireEvent.change(fillInput, { target: { value: 'not-a-color' } });
    expect(fillInput).toHaveValue('not-a-color');
    fireEvent.blur(fillInput);
    expect(fillInput).toHaveValue('#00ff88');

    // Typing transparent commits 'transparent'.
    fireEvent.change(fillInput, { target: { value: 'TRANSPARENT' } });
    expect(onUpdate).toHaveBeenLastCalledWith(
      { editor: { defaultFillColor: 'transparent' } },
      { debounce: true },
    );
    expect(fillInput).toHaveValue('transparent');

    // External prop update (e.g. reset) resyncs dirty drafts.
    fireEvent.change(fillInput, { target: { value: '#223344' } });
    expect(fillInput).toHaveValue('#223344');
    fireEvent.click(screen.getByRole('button', { name: 'External Reset' }));
    expect(fillInput).toHaveValue('transparent');
  });
});
