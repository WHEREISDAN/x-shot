import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ScreenshotEditor from '../renderer/components/editor/ScreenshotEditor';
import type { AppPreferences, ScreenshotResult } from '../shared/ipc-types';

const SHOT: ScreenshotResult = {
  imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  width: 400,
  height: 300,
  sessionId: 'interaction',
};

const BORDER_COLOR = '#123456';

// Padding and inset 0 render the plain (non-presentation) stage.
const PREFERENCES = {
  capture: { autoCopyToClipboard: false },
  editor: {
    defaultStrokeColor: '#ef4444',
    defaultFillColor: 'transparent',
    defaultStrokeWidth: 3,
    defaultTextSize: 18,
  },
  pii: { autoDetect: false, defaultStyle: 'black', detectors: null },
  presentation: {
    gradient: { kind: 'linear', angleDeg: 45, stops: [] },
    backgroundImageUrl: null,
    padding: 0,
    inset: 0,
    radius: 0,
    shadow: { enabled: false, x: 0, y: 0, blur: 0, spread: 0, color: '#000' },
    aspect: { preset: 'auto' },
    exportScale: 1,
    borderColor: BORDER_COLOR,
  },
} as unknown as AppPreferences;

// jsdom has no PointerEvent; React reads button and clientX from it.
class PointerEventPolyfill extends MouseEvent {
  pointerId: number;

  constructor(
    type: string,
    init: ConstructorParameters<typeof MouseEvent>[1] & {
      pointerId?: number;
    } = {},
  ) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

type Point = { clientX: number; clientY: number };

// Client points inside the stage. With no layout in jsdom the editor maps
// them linearly into the image, so their order is preserved.
const START: Point = { clientX: -4, clientY: -3 };
const END: Point = { clientX: -1, clientY: -1 };
const MIDDLE: Point = { clientX: -2.5, clientY: -2 };

function stage(): SVGSVGElement {
  return document.querySelector(
    `svg[viewBox="0 0 ${SHOT.width} ${SHOT.height}"]`,
  ) as SVGSVGElement;
}

const shapesOfType = (type: string) =>
  stage().querySelectorAll(`[data-shape-type="${type}"]`);

async function renderEditor() {
  render(
    <ScreenshotEditor
      screenshot={SHOT}
      onDelete={jest.fn()}
      onCopy={jest.fn(async () => true)}
      onSave={jest.fn(async () => {})}
    />,
  );
  // Let the preference requests resolve.
  await act(async () => {});
  await act(async () => {});
}

/** Clicks a toolbar tool the way a mouse does: focus, then click. */
function clickTool(name: string) {
  const button = screen.getByRole('button', { name });
  act(() => button.focus());
  fireEvent.click(button);
}

function drag(
  from: Point,
  to: Point,
  { button = 0, moves = 1 }: { button?: number; moves?: number } = {},
) {
  const pointer = { pointerId: 1, button };
  fireEvent.pointerDown(stage(), { ...pointer, ...from });
  for (let step = 1; step <= moves; step += 1) {
    const t = step / moves;
    fireEvent.pointerMove(stage(), {
      ...pointer,
      clientX: from.clientX + (to.clientX - from.clientX) * t,
      clientY: from.clientY + (to.clientY - from.clientY) * t,
    });
  }
  fireEvent.pointerUp(stage(), { ...pointer, ...to });
}

const pressUndo = () =>
  fireEvent.keyDown(document.activeElement ?? window, {
    key: 'z',
    metaKey: true,
  });

const rectX = () =>
  Number(shapesOfType('rect')[0]?.querySelector('rect')?.getAttribute('x'));

describe('ScreenshotEditor interaction', () => {
  beforeAll(() => {
    (window as unknown as { PointerEvent: unknown }).PointerEvent =
      PointerEventPolyfill;
  });

  beforeEach(() => {
    (window as unknown as { electron: unknown }).electron = {
      ipcRenderer: {
        invoke: jest.fn(async (channel: string) =>
          channel === 'get-preferences' ? PREFERENCES : true,
        ),
        log: jest.fn(),
      },
    };
  });

  afterEach(() => {
    delete (window as unknown as { electron?: unknown }).electron;
  });

  it('undoes with Cmd+Z right after a toolbar button was clicked', async () => {
    await renderEditor();
    clickTool('Ellipse');
    drag(START, END);
    expect(shapesOfType('ellipse')).toHaveLength(1);

    clickTool('Rect');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Rect' }),
    );
    pressUndo();

    expect(shapesOfType('ellipse')).toHaveLength(0);
  });

  it('records one undo entry for a 60-move drag', async () => {
    await renderEditor();
    clickTool('Rect');
    drag(START, END);
    const drawnX = rectX();

    clickTool('Select');
    drag(
      MIDDLE,
      { clientX: MIDDLE.clientX + 3, clientY: MIDDLE.clientY },
      {
        moves: 60,
      },
    );
    expect(rectX()).toBeGreaterThan(drawnX);

    pressUndo();
    expect(rectX()).toBe(drawnX);
    pressUndo();
    expect(shapesOfType('rect')).toHaveLength(0);
  });

  it('draws nothing on a right-button drag', async () => {
    await renderEditor();
    clickTool('Ellipse');
    drag(START, END, { button: 2 });

    expect(stage().querySelectorAll('ellipse')).toHaveLength(0);
  });

  it('removes a text left empty, without an undo entry', async () => {
    await renderEditor();
    clickTool('Text');
    fireEvent.pointerDown(stage(), { pointerId: 1, button: 0, ...START });
    const input = await screen.findByRole('textbox', { name: 'Edit text' });
    expect(shapesOfType('text')).toHaveLength(1);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(shapesOfType('text')).toHaveLength(0);
    pressUndo();
    expect(shapesOfType('text')).toHaveLength(0);
  });

  it('removes a new text when its edit is canceled', async () => {
    await renderEditor();
    clickTool('Text');
    fireEvent.pointerDown(stage(), { pointerId: 1, button: 0, ...START });
    const input = await screen.findByRole('textbox', { name: 'Edit text' });

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(shapesOfType('text')).toHaveLength(0);
  });

  it('keeps typed text, edits it on double-click, and undoes in steps', async () => {
    await renderEditor();
    clickTool('Text');
    fireEvent.pointerDown(stage(), { pointerId: 1, button: 0, ...START });
    const input = await screen.findByRole('textbox', { name: 'Edit text' });
    fireEvent.change(input, { target: { value: 'Hi' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(stage().querySelector('text')).toHaveTextContent('Hi');

    // Plain mode (padding 0) must also open the editor on double-click.
    fireEvent.doubleClick(stage(), START);
    const edit = await screen.findByRole('textbox', { name: 'Edit text' });
    expect(edit).toHaveValue('Hi');
    fireEvent.change(edit, { target: { value: 'Hello' } });
    fireEvent.keyDown(edit, { key: 'Enter' });
    expect(stage().querySelector('text')).toHaveTextContent('Hello');

    pressUndo();
    expect(stage().querySelector('text')).toHaveTextContent('Hi');
    pressUndo();
    expect(shapesOfType('text')).toHaveLength(0);
  });

  it('keeps shortcuts blocked while typing in a side panel field', async () => {
    await renderEditor();
    clickTool('Ellipse');
    drag(START, END);

    const field = screen
      .getAllByDisplayValue(BORDER_COLOR)
      .find((input) => input.getAttribute('type') === 'text') as HTMLElement;
    act(() => field.focus());
    fireEvent.keyDown(field, { key: 'z', metaKey: true });
    fireEvent.keyDown(field, { key: 'Backspace' });

    expect(shapesOfType('ellipse')).toHaveLength(1);
  });
});
