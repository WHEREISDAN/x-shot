import type React from 'react';
import { act, renderHook } from '@testing-library/react';
import { useSelection } from '../renderer/hooks/use-selection';

const sendMessage = jest.fn();

const mouse = (clientX: number, clientY: number) =>
  ({
    clientX,
    clientY,
    preventDefault: jest.fn(),
  }) as unknown as React.MouseEvent;

describe('useSelection', () => {
  beforeEach(() => {
    sendMessage.mockClear();
    Object.defineProperty(window, 'innerWidth', {
      value: 1920,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 1080,
      configurable: true,
    });
    (window as unknown as { electron: unknown }).electron = {
      ipcRenderer: { sendMessage },
    };
  });

  afterEach(() => {
    delete (window as unknown as { electron?: unknown }).electron;
  });

  // An overlay on a display left of the primary, at -1920,0.
  const render = () =>
    renderHook(() =>
      useSelection({ offsetX: -1920, offsetY: 0, displayId: 2 }),
    );

  it('keeps a drawn selection inside the display', () => {
    const { result } = render();
    act(() => result.current.onMouseDown(mouse(1600, 900)));
    act(() => result.current.onMouseMove(mouse(2400, 1400)));

    // Snapped to the 8 px grid (900 -> 904) and cut at the display edge.
    expect(result.current.selection).toEqual({
      x: 1600,
      y: 904,
      width: 320,
      height: 176,
    });
  });

  it('keeps a moved selection inside the display without resizing it', () => {
    const { result } = render();
    act(() => result.current.onMouseDown(mouse(100, 100)));
    act(() => result.current.onMouseMove(mouse(500, 400)));
    act(() => result.current.onMouseUp());
    const { width, height } = result.current.selection!;

    act(() => result.current.onMouseDown(mouse(300, 250)));
    act(() => result.current.onMouseMove(mouse(5000, 5000)));

    expect(result.current.selection).toEqual({
      x: 1920 - width,
      y: 1080 - height,
      width,
      height,
    });
  });

  it('sends global coordinates and the display id on confirm', () => {
    const { result } = render();
    act(() => result.current.onMouseDown(mouse(96, 104)));
    act(() => result.current.onMouseMove(mouse(496, 404)));
    act(() => result.current.confirm());

    expect(sendMessage).toHaveBeenCalledWith('screenshot-data', {
      x: 96 - 1920,
      y: 104,
      width: 400,
      height: 304,
      displayId: 2,
    });
  });

  it('sends an empty selection so main can report it', () => {
    const { result } = render();
    act(() => result.current.onMouseDown(mouse(40, 40)));
    act(() => result.current.onMouseUp());
    act(() => result.current.confirm());

    expect(sendMessage).toHaveBeenCalledWith(
      'screenshot-data',
      expect.objectContaining({ width: 0, height: 0, displayId: 2 }),
    );
  });

  it('accumulates slow incremental resize drags (<4px per move event)', () => {
    const { result } = render();
    // Draw a 200x200 box at (104, 104) -> right=304, bottom=304.
    act(() => result.current.onMouseDown(mouse(104, 104)));
    act(() => result.current.onMouseMove(mouse(304, 304)));
    act(() => result.current.onMouseUp());
    expect(result.current.selection).toEqual({
      x: 104,
      y: 104,
      width: 200,
      height: 200,
    });

    // Grab right-middle handle at (304, 204) and drag +40px in 2px increments.
    act(() => result.current.onMouseDown(mouse(304, 204)));
    for (let step = 1; step <= 20; step += 1) {
      act(() => result.current.onMouseMove(mouse(304 + step * 2, 204)));
    }
    act(() => result.current.onMouseUp());

    expect(result.current.selection).toEqual({
      x: 104,
      y: 104,
      width: 240,
      height: 200,
    });
  });

  it('clamps shrinking past min-size from left, top and top-left handles without shifting opposite edges', () => {
    const { result } = render();
    // Draw a 200x200 box at (104, 104) -> right=304, bottom=304.
    act(() => result.current.onMouseDown(mouse(104, 104)));
    act(() => result.current.onMouseMove(mouse(304, 304)));
    act(() => result.current.onMouseUp());

    // Shrink from left-middle way past the right edge (x = 500).
    act(() => result.current.onMouseDown(mouse(104, 204)));
    act(() => result.current.onMouseMove(mouse(500, 204)));
    act(() => result.current.onMouseUp());
    expect(result.current.selection).toEqual({
      x: 294,
      y: 104,
      width: 10,
      height: 200,
    });

    // Reset to (104, 104, 200, 200) and shrink from top-left past (500, 500).
    act(() => result.current.clear());
    act(() => result.current.onMouseDown(mouse(104, 104)));
    act(() => result.current.onMouseMove(mouse(304, 304)));
    act(() => result.current.onMouseUp());

    act(() => result.current.onMouseDown(mouse(104, 104)));
    act(() => result.current.onMouseMove(mouse(500, 500)));
    act(() => result.current.onMouseUp());
    expect(result.current.selection).toEqual({
      x: 294,
      y: 294,
      width: 10,
      height: 10,
    });

    // Reset to (104, 104, 200, 200) and shrink from top-middle past bottom.
    act(() => result.current.clear());
    act(() => result.current.onMouseDown(mouse(104, 104)));
    act(() => result.current.onMouseMove(mouse(304, 304)));
    act(() => result.current.onMouseUp());

    act(() => result.current.onMouseDown(mouse(204, 104)));
    act(() => result.current.onMouseMove(mouse(204, 500)));
    act(() => result.current.onMouseUp());
    expect(result.current.selection).toEqual({
      x: 104,
      y: 294,
      width: 200,
      height: 10,
    });
  });
});
