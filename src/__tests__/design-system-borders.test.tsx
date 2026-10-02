import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToolButton } from '../renderer/components/editor/editor-tools';
import { Input } from '../renderer/design-system/components/Input';
import { colors } from '../renderer/design-system/tokens';

/** A CSS color as jsdom reports it, so equal colors compare equal. */
function resolved(color: string): string {
  const probe = document.createElement('div');
  probe.style.borderColor = color;
  return probe.style.borderColor;
}

// With the `border` shorthand, React cleared the color when an active or
// focus color was removed, and logged a warning about it.
describe('state border colors', () => {
  it('a tool button gets its border color back when it stops being active', () => {
    const { rerender } = render(
      <ToolButton label="Rect" active onClick={() => {}} />,
    );
    const button = screen.getByRole('button', { name: 'Rect' });
    expect(button.style.borderColor).toBe(resolved(colors.focus));

    rerender(<ToolButton label="Rect" active={false} onClick={() => {}} />);

    expect(button.style.borderColor).toBe(resolved(colors.border.emphasis));
    expect(button.style.borderStyle).toBe('solid');
  });

  it('an input gets its border color back when it loses focus', () => {
    render(<Input aria-label="Name" />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    act(() => input.focus());
    expect(input.style.borderColor).toBe(resolved(colors.focus));

    fireEvent.blur(input);

    expect(input.style.borderColor).toBe(resolved(colors.border.emphasis));
  });
});
