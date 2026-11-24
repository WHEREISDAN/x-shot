import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  acceleratorKeys,
  Hotkey,
  IconButton,
  SegmentedControl,
  Switch,
} from '../renderer/design-system';

const labels = (accelerator: string, mac: boolean) =>
  acceleratorKeys(accelerator, mac).map((key) => key.label);

describe('acceleratorKeys', () => {
  it('shows symbols on macOS', () => {
    expect(labels('CommandOrControl+Shift+1', true)).toEqual(['⌘', '⇧', '1']);
    expect(labels('Control+Alt+Up', true)).toEqual(['⌃', '⌥', '↑']);
  });

  it('shows key names on Windows and Linux', () => {
    expect(labels('CommandOrControl+Shift+1', false)).toEqual([
      'Ctrl',
      'Shift',
      '1',
    ]);
    expect(labels('CmdOrCtrl+Alt+Esc', false)).toEqual(['Ctrl', 'Alt', 'Esc']);
  });

  it('keeps a plus key and upper-cases letters', () => {
    expect(labels('CommandOrControl+Plus', false)).toEqual(['Ctrl', '+']);
    expect(labels('Shift+a', false)).toEqual(['Shift', 'A']);
    expect(labels('F12', true)).toEqual(['F12']);
  });
});

describe('design-system controls', () => {
  it('draws a hotkey as key caps and reads it by key name', () => {
    const { container } = render(
      <Hotkey accelerator="CommandOrControl+Shift+1" mac />,
    );
    const caps = Array.from(
      container.querySelectorAll('kbd kbd'),
      (cap) => cap.textContent,
    );
    expect(caps).toEqual(['⌘', '⇧', '1']);
    expect(container).toHaveTextContent('Command Shift 1');
  });

  it('names an icon button by its label and keeps the tooltip', () => {
    const onClick = jest.fn();
    render(<IconButton label="Undo" icon={<svg />} onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Undo' });
    expect(button).toHaveAttribute('data-tooltip', 'Undo');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('picks one option of a segmented control', () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        label="Export scale"
        options={[
          { value: 1, label: '1x' },
          { value: 2, label: '2x' },
        ]}
        value={2}
        onChange={onChange}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Export scale' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '2x' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '1x' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('toggles a switch named by its label', () => {
    const onChange = jest.fn();
    render(
      <Switch checked={false} onChange={onChange}>
        Censor PII
      </Switch>,
    );
    const toggle = screen.getByRole('switch', { name: 'Censor PII' });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
