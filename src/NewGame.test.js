import { describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import NewGame from './NewGame';

describe('NewGame', () => {
  test('renders the Draw and Guess buttons', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<NewGame selectDraw={() => {}} selectGuess={() => {}} />);
    });

    expect(container.textContent).toContain('Draw');
    expect(container.textContent).toContain('Guess');

    act(() => root.unmount());
  });
});
