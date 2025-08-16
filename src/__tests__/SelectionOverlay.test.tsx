import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import SelectionOverlay from '../renderer/components/SelectionOverlay';

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
});
