import { act, renderHook } from '@testing-library/react';
import {
  useEditorState,
  type RectShape,
  type TextShape,
} from '../renderer/hooks/use-editor-state';

const rect: RectShape = {
  id: 'rect-1',
  type: 'rect',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  strokeColor: '#ef4444',
  strokeWidth: 3,
};

const text: TextShape = {
  id: 'text-1',
  type: 'text',
  x: 5,
  y: 5,
  text: 'Text',
  fontSize: 18,
  strokeColor: '#ef4444',
  strokeWidth: 3,
};

const rectX = (shapes: unknown[]) => (shapes[0] as RectShape | undefined)?.x;

describe('useEditorState gestures and undo', () => {
  it('records one undo entry for a 60-move drag', () => {
    const { result } = renderHook(() => useEditorState());
    act(() => {
      result.current.addShape(rect);
    });
    act(() => result.current.selectShape(rect.id));
    act(() => result.current.beginGesture());
    for (let move = 0; move < 60; move += 1) {
      act(() => result.current.moveSelectedShapeBy(1, 0));
    }
    act(() => result.current.endGesture());
    expect(rectX(result.current.shapes)).toBe(70);

    act(() => result.current.undo());
    expect(rectX(result.current.shapes)).toBe(10);
    act(() => result.current.undo());
    expect(result.current.shapes).toEqual([]);
    expect(result.current.hasUndo).toBe(false);
  });

  it('records one undo entry for a resize made of many updates', () => {
    const { result } = renderHook(() => useEditorState());
    act(() => {
      result.current.addShape(rect);
    });
    act(() => result.current.beginGesture());
    [110, 120, 130].forEach((width) => {
      act(() =>
        result.current.updateShape(
          rect.id,
          (s) => ({ ...s, width }) as RectShape,
        ),
      );
    });
    act(() => result.current.endGesture());

    act(() => result.current.undo());
    expect((result.current.shapes[0] as RectShape).width).toBe(100);
  });

  it('records nothing for a gesture that changes nothing', () => {
    const { result } = renderHook(() => useEditorState());
    act(() => result.current.beginGesture());
    act(() => result.current.endGesture());
    expect(result.current.hasUndo).toBe(false);
  });

  it('records nothing when a placed text is removed in the same gesture', () => {
    const { result } = renderHook(() => useEditorState());
    act(() => {
      result.current.beginGesture();
      result.current.addShape(text);
    });
    act(() => {
      result.current.deleteShapeById(text.id);
      result.current.endGesture();
    });
    expect(result.current.shapes).toEqual([]);
    expect(result.current.hasUndo).toBe(false);
  });

  it('commits a drawn shape as one entry and selects it', () => {
    const { result } = renderHook(() => useEditorState());
    act(() => result.current.startProvisionalShape(rect));
    act(() =>
      result.current.updateProvisionalShape(
        (s) => ({ ...s, width: 200 }) as RectShape,
      ),
    );
    act(() => result.current.commitProvisionalShape());

    expect(result.current.provisionalShape).toBeNull();
    expect(result.current.selectedShapeId).toBe(rect.id);
    expect((result.current.shapes[0] as RectShape).width).toBe(200);
    act(() => result.current.undo());
    expect(result.current.shapes).toEqual([]);
    act(() => result.current.redo());
    expect(result.current.shapes).toHaveLength(1);
  });

  it('composes multiple synchronous shape mutations in one frame without stale closures', () => {
    const rect2: RectShape = { ...rect, id: 'rect-2', x: 50, y: 60 };
    const { result } = renderHook(() => useEditorState());

    act(() => {
      result.current.addShape(rect);
      result.current.addShape(rect2);
      result.current.addShapes([text]);
      result.current.updateTextShape(text.id, 'Updated');
      result.current.updateShape(
        rect2.id,
        (s) => ({ ...s, width: 150 }) as RectShape,
      );
      result.current.selectShape(rect.id);
      result.current.moveSelectedShapeBy(5, 3);
      result.current.moveSelectedShapeBy(7, 2);
      result.current.deleteShapeById(rect2.id);
    });

    expect(result.current.shapes).toHaveLength(2);
    expect(result.current.getShapeById(rect.id)).toMatchObject({
      x: 22,
      y: 25,
    });
    expect(result.current.getShapeById(text.id)).toMatchObject({
      text: 'Updated',
    });
    expect(result.current.getShapeById(rect2.id)).toBeUndefined();
  });

  it('clears stale selectedShapeId and open gestureBaseRef on undo and redo', () => {
    const rect2: RectShape = { ...rect, id: 'rect-2', x: 40, y: 40 };
    const { result } = renderHook(() => useEditorState());

    act(() => {
      result.current.addShape(rect);
    });
    act(() => {
      result.current.addShape(rect2);
      result.current.selectShape(rect2.id);
    });
    expect(result.current.selectedShapeId).toBe(rect2.id);

    // Start a gesture then undo before ending it.
    act(() => {
      result.current.beginGesture();
      result.current.moveSelectedShapeBy(15, 0);
    });
    act(() => result.current.undo());

    // rect2 is no longer in restored shapes, so selectedShapeId must be cleared.
    expect(result.current.shapes.map((s) => s.id)).toEqual([rect.id]);
    expect(result.current.selectedShapeId).toBeNull();

    // Ending the interrupted gesture must not push a bogus undo entry.
    act(() => result.current.endGesture());
    act(() => result.current.undo());
    expect(result.current.shapes).toEqual([]);

    // Redo restores [rect]; selecting rect and undoing clears it too.
    act(() => result.current.redo());
    act(() => result.current.selectShape(rect.id));
    expect(result.current.selectedShapeId).toBe(rect.id);
    act(() => result.current.undo());
    expect(result.current.selectedShapeId).toBeNull();
  });
});
