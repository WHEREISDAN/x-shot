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
});
