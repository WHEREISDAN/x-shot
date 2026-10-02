import { fireEvent, renderHook } from '@testing-library/react';
import {
  isTextEntryElement,
  useEditorShortcuts,
  type UseEditorShortcutsOptions,
} from '../renderer/hooks/use-editor-shortcuts';

function element(html: string): Element {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild as Element;
}

describe('isTextEntryElement', () => {
  it.each([
    '<input>',
    '<input type="text">',
    '<input type="email">',
    '<input type="password">',
    '<input type="number">',
    '<textarea></textarea>',
    '<select></select>',
    '<div contenteditable="true"></div>',
    '<div contenteditable=""></div>',
  ])('treats %s as typing', (html) => {
    expect(isTextEntryElement(element(html))).toBe(true);
  });

  it.each([
    '<button>Rect</button>',
    '<input type="checkbox">',
    '<input type="radio">',
    '<input type="range">',
    '<input type="color">',
    '<div></div>',
    '<div contenteditable="false"></div>',
  ])('does not treat %s as typing', (html) => {
    expect(isTextEntryElement(element(html))).toBe(false);
  });

  it('handles no focused element', () => {
    expect(isTextEntryElement(null)).toBe(false);
  });
});

describe('useEditorShortcuts', () => {
  function setup(overrides: Partial<UseEditorShortcutsOptions> = {}) {
    const options: UseEditorShortcutsOptions = {
      editingActive: false,
      onCopy: jest.fn(),
      onSave: jest.fn(),
      onUndo: jest.fn(),
      onRedo: jest.fn(),
      onDeleteSelected: jest.fn(),
      onEscape: jest.fn(),
      setZoom: jest.fn(),
      resetView: jest.fn(),
      setPan: jest.fn(),
      ...overrides,
    };
    renderHook(() => useEditorShortcuts(options));
    return options;
  }

  function focusNew(html: string): HTMLElement {
    const node = element(html) as HTMLElement;
    document.body.appendChild(node);
    node.focus();
    return node;
  }

  const pressUndo = (target: Element | Window = window) =>
    fireEvent.keyDown(target, { key: 'z', metaKey: true });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('still undoes while a toolbar button has focus', () => {
    const options = setup();
    const button = focusNew('<button>Rect</button>');
    expect(document.activeElement).toBe(button);

    pressUndo(button);
    expect(options.onUndo).toHaveBeenCalledTimes(1);
  });

  it('still deletes while a checkbox has focus', () => {
    const options = setup();
    const checkbox = focusNew('<input type="checkbox">');
    fireEvent.keyDown(checkbox, { key: 'Delete' });
    expect(options.onDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it('stays blocked while typing in a text input or textarea', () => {
    const options = setup();
    pressUndo(focusNew('<input type="text">'));
    pressUndo(focusNew('<textarea></textarea>'));
    fireEvent.keyDown(focusNew('<input>'), { key: 'Backspace' });

    expect(options.onUndo).not.toHaveBeenCalled();
    expect(options.onDeleteSelected).not.toHaveBeenCalled();
  });

  it('stays blocked while a text shape is being edited', () => {
    const options = setup({ editingActive: true });
    pressUndo();
    expect(options.onUndo).not.toHaveBeenCalled();
  });
});
