import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import Letters from './Letters';

let mounted = null;
let logSpy;

beforeEach(() => {
  logSpy = spyOn(console, 'log').mockImplementation(() => {});
});

function render(letters, submitGuess = () => {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const ref = createRef();
  act(() => {
    root.render(<Letters ref={ref} letters={letters} submitGuess={submitGuess} />);
  });
  mounted = { container, root };
  return { container, root, ref };
}

afterEach(() => {
  logSpy?.mockRestore();
  if (mounted) {
    act(() => mounted.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
});

const slots = (container) => [...container.querySelectorAll('.word .position')];
const poolTiles = (container) => [...container.querySelectorAll('.letter-pool .letter')];
const allTiles = (container) => [...container.querySelectorAll('.letter')];
const text = (el) => el.textContent.trim();
const tile = (container, letter) => allTiles(container).find((t) => text(t) === letter);

describe('Letters', () => {
  test('renders one empty slot per letter, with no positional hint', () => {
    const { container } = render('god');

    expect(slots(container)).toHaveLength(3);
    expect(poolTiles(container)).toHaveLength(3);
    // The answer is never encoded in the DOM.
    expect(container.querySelectorAll('[data-letter]')).toHaveLength(0);
    expect(poolTiles(container).map(text).sort()).toEqual(['d', 'g', 'o']);
  });

  test('assembles the guess from the slots, in slot order', () => {
    const { container, ref } = render('god');
    const [s0, s1, s2] = slots(container);

    expect(ref.current.currentGuess()).toBe('');
    act(() => {
      s0.appendChild(tile(container, 'd'));
      s1.appendChild(tile(container, 'o'));
      s2.appendChild(tile(container, 'g'));
    });
    expect(ref.current.currentGuess()).toBe('dog');
  });

  test('proposes the word only once every slot is filled', () => {
    const submitted = [];
    const { container, ref } = render('god', (word) => submitted.push(word));
    const [s0, s1, s2] = slots(container);

    act(() => s0.appendChild(tile(container, 'd')));
    act(() => ref.current.onDrop());
    expect(submitted).toEqual([]); // not full yet

    act(() => {
      s1.appendChild(tile(container, 'o'));
      s2.appendChild(tile(container, 'g'));
    });
    act(() => ref.current.onDrop());
    expect(submitted).toEqual(['dog']);
  });

  test('the drop guard accepts a slot that already holds the dragged tile', () => {
    const { container, ref } = render('god');
    const slot = slots(container)[0];
    const tileBeingDragged = poolTiles(container)[0];
    const other = poolTiles(container)[1];
    const pool = container.querySelector('#letter-pool');

    expect(ref.current.canDrop(tileBeingDragged, slot)).toBe(true); // empty slot

    slot.appendChild(tileBeingDragged);
    // dragula re-checks on release, when the tile already sits in the slot —
    // returning false here silently reverts every drop.
    expect(ref.current.canDrop(tileBeingDragged, slot)).toBe(true);

    expect(ref.current.canDrop(other, slot)).toBe(false); // one tile per slot
    expect(ref.current.canDrop(tileBeingDragged, pool)).toBe(true); // back to the pool
  });

  test('rebuilds when the letters change', () => {
    const { container, root, ref } = render('god');

    act(() => {
      root.render(<Letters ref={ref} letters="abc" submitGuess={() => {}} />);
    });

    expect(slots(container)).toHaveLength(3);
    expect(poolTiles(container).map(text).sort()).toEqual(['a', 'b', 'c']);
  });
});
