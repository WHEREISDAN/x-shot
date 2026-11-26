import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BottomToolbar from '../renderer/components/editor/BottomToolbar';

type EyeDropperWindow = Window & {
  EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
};

function renderToolbar(setStrokeColor = jest.fn()) {
  render(
    <BottomToolbar
      activeTool="select"
      setActiveTool={jest.fn()}
      strokeColor="#ef4444"
      setStrokeColor={setStrokeColor}
      strokeWidth={3}
      setStrokeWidth={jest.fn()}
      textSize={18}
      setTextSize={jest.fn()}
      showTextControls={false}
      showTextSelectLevel={false}
      textSelectLevel="word"
      setTextSelectLevel={jest.fn()}
    />,
  );
  return { setStrokeColor };
}

describe('BottomToolbar Eyedropper', () => {
  const originalEyeDropper = (window as EyeDropperWindow).EyeDropper;

  afterEach(() => {
    if (originalEyeDropper) {
      (window as EyeDropperWindow).EyeDropper = originalEyeDropper;
    } else {
      delete (window as EyeDropperWindow).EyeDropper;
    }
  });

  it('disables Eyedropper with an unavailable tooltip when window.EyeDropper is missing', () => {
    delete (window as EyeDropperWindow).EyeDropper;
    const { setStrokeColor } = renderToolbar();

    const button = screen.getByRole('button', { name: /eyedropper/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      'data-tooltip',
      expect.stringMatching(/unavailable/i),
    );
    fireEvent.click(button);
    expect(setStrokeColor).not.toHaveBeenCalled();
  });

  it('picks a color when window.EyeDropper is available', async () => {
    const open = jest.fn(async () => ({ sRGBHex: '#123456' }));
    (window as EyeDropperWindow).EyeDropper = jest
      .fn()
      .mockImplementation(() => ({ open }));
    const { setStrokeColor } = renderToolbar();

    const button = screen.getByRole('button', { name: 'Eyedropper' });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(setStrokeColor).toHaveBeenCalledWith('#123456'));
  });
});
