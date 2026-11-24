import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import SelectionOverlay from '../renderer/components/SelectionOverlay';
import capturePixelSize from '../renderer/components/capture-pixel-size';

describe('SelectionOverlay', () => {
  it('renders nothing when no selection', () => {
    const { container } = render(<SelectionOverlay selection={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders selection rectangle and handles', () => {
    const { container } = render(
      <SelectionOverlay selection={{ x: 10, y: 10, width: 100, height: 80 }} />,
    );
    // rectangle + 8 handles
    expect(container.querySelectorAll('div').length).toBe(9);
  });

  it('shows the capture size in a badge beside the handles', () => {
    const { container } = render(
      <SelectionOverlay
        selection={{ x: 10, y: 60, width: 440, height: 260 }}
        pixelSize={{ width: 880, height: 520 }}
      />,
    );
    expect(container.querySelectorAll('div').length).toBe(9);
    expect(container.querySelector('[data-size-badge]')).toHaveTextContent(
      '880 × 520',
    );
  });
});

describe('capturePixelSize', () => {
  const viewport = { width: 1440, height: 900 };

  it('scales the selection the way main crops the snapshot', () => {
    expect(
      capturePixelSize(
        { x: 100, y: 50, width: 440, height: 260 },
        viewport,
        { width: 2880, height: 1800 },
        1,
      ),
    ).toEqual({ width: 880, height: 520 });
  });

  it('uses the scale factor without a snapshot', () => {
    expect(
      capturePixelSize(
        { x: 0, y: 0, width: 300, height: 200 },
        viewport,
        null,
        1.5,
      ),
    ).toEqual({ width: 450, height: 300 });
  });

  it('has no size for an empty selection', () => {
    expect(
      capturePixelSize(
        { x: 10, y: 10, width: 0, height: 0 },
        viewport,
        null,
        2,
      ),
    ).toBeNull();
  });
});
