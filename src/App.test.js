import { afterEach, beforeEach, describe, expect, mock, setSystemTime, spyOn, test } from 'bun:test';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// ---------------------------------------------------------------------------
// Fake Firebase + Paper, installed *before* App is imported.
// ---------------------------------------------------------------------------
const fake = {
  listeners: [], // { path, cb, active }
  unsubscribed: 0,
  writes: [],
  authCallbacks: [],
  values: new Map(),
};

function record(event, path, cb) {
  const entry = { event, path, cb, active: true };
  fake.listeners.push(entry);
  return () => {
    entry.active = false;
    fake.unsubscribed += 1;
  };
}

const activePaths = () => fake.listeners.filter((l) => l.active).map((l) => l.path);

mock.module('firebase/database', () => ({
  ref: (_db, path) => ({ path }),
  get: (r) => Promise.resolve({ val: () => (fake.values.has(r.path) ? fake.values.get(r.path) : null) }),
  set: (r, value) => {
    fake.writes.push({ op: 'set', path: r.path, value });
    return Promise.resolve();
  },
  update: (r, value) => {
    fake.writes.push({ op: 'update', path: r.path, value });
    return Promise.resolve();
  },
  push: (r) => ({ path: `${r.path}/pushed`, key: 'pushed' }),
  onValue: (r, cb) => record('value', r.path, cb),
  onChildAdded: (r, cb) => record('child_added', r.path, cb),
  onChildChanged: (r, cb) => record('child_changed', r.path, cb),
}));

mock.module('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => {
    fake.authCallbacks.push(cb);
    // Not a game listener, so it isn't recorded in fake.listeners.
    return () => {
      fake.unsubscribed += 1;
    };
  },
  signInWithPopup: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  GoogleAuthProvider: class {},
}));

mock.module('./firebase.config', () => ({
  database: { name: 'db' },
  auth: { name: 'auth', currentUser: null },
  authprovider: {},
}));

const tools = [];
const paperPaths = [];

mock.module('paper', () => ({
  default: {
    setup() {},
    Tool: class {
      constructor() {
        tools.push(this);
      }
    },
    Path: class {
      constructor() {
        this.pathData = null;
        paperPaths.push(this);
      }
      add() {}
      remove() {}
    },
    view: { update() {} },
    project: { activeLayer: { children: [] } },
  },
}));

const { default: App } = await import('./App');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let mounted = null;
let logSpy;

beforeEach(() => {
  logSpy = spyOn(console, 'log').mockImplementation(() => {});
  tools.length = 0;
  paperPaths.length = 0;
  fake.listeners = [];
  fake.unsubscribed = 0;
  fake.writes = [];
  fake.authCallbacks = [];
  fake.values = new Map();
  // setupDrawPlayer() reads window.canvas (a named-access global in browsers).
  window.canvas = { offsetHeight: 720, offsetWidth: 405 };
});

afterEach(() => {
  logSpy?.mockRestore();
  if (mounted) {
    act(() => mounted.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
});

function setGame(id) {
  window.happyDOM.setURL(`http://localhost/index.html?id=${id}`);
}

function renderApp() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<App />));
  mounted = { container, root };
  return { container, root };
}

async function signIn(uid) {
  await act(async () => {
    for (const cb of fake.authCallbacks) {
      cb({ uid, displayName: uid, photoURL: null });
    }
  });
}

const listenerFor = (path) => fake.listeners.filter((l) => l.path === path && l.active).pop();

const childListener = (event, path) =>
  fake.listeners.filter((l) => l.event === event && l.path === path && l.active).pop();

describe('App', () => {
  test('registers game listeners only after sign-in and detaches them on unmount', async () => {
    setGame('game1');
    fake.values.set('game1/u1', 1);
    fake.values.set('game1/player1', 1);

    const { root } = renderApp();
    expect(fake.listeners).toHaveLength(0); // nothing while signed out

    await signIn('u1');

    // Paths, the round flag, and my own role.
    expect(activePaths()).toContain('game1/paths');
    expect(activePaths()).toContain('game1/completed');
    expect(activePaths()).toContain('game1/u1');

    act(() => root.unmount());
    expect(activePaths()).toHaveLength(0); // every listener, plus the auth one
  });

  test('a joining player takes the side opposite the creator', async () => {
    setGame('game2');
    fake.values.set('game2/player1', 1); // no role for u2 yet

    renderApp();
    await signIn('u2');

    const write = fake.writes.find((w) => w.path === 'game2/u2');
    expect(write).toBeTruthy();
    expect(write.value).toBe(-1);
  });

  test('the guesser is subscribed to the letters, never to the word', async () => {
    setGame('game3');
    fake.values.set('game3/u3', -1);
    fake.values.set('game3/player1', 1);

    renderApp();
    await signIn('u3');
    await act(async () => listenerFor('game3/u3').cb({ val: () => -1, key: 'u3' }));

    expect(activePaths()).toContain('game3/letters');
    expect(activePaths()).not.toContain('game3/currentAnimal');
  });

  test('the drawer is subscribed to the word, never to the letters', async () => {
    setGame('game4');
    fake.values.set('game4/u4', 1);
    fake.values.set('game4/player1', 1);

    renderApp();
    await signIn('u4');
    await act(async () => listenerFor('game4/u4').cb({ val: () => 1, key: 'u4' }));

    expect(activePaths()).toContain('game4/currentAnimal');
    expect(activePaths()).not.toContain('game4/letters');
  });

  test('a role swap re-subscribes and detaches the previous role listeners', async () => {
    setGame('game5');
    fake.values.set('game5/u5', -1);
    fake.values.set('game5/player1', 1);

    renderApp();
    await signIn('u5');
    await act(async () => listenerFor('game5/u5').cb({ val: () => -1, key: 'u5' }));
    expect(activePaths()).toContain('game5/letters');

    // A rematch flips my role to drawer.
    await act(async () => listenerFor('game5/u5').cb({ val: () => 1, key: 'u5' }));

    expect(activePaths()).toContain('game5/currentAnimal');
    expect(activePaths()).not.toContain('game5/letters');
  });

  test('stroke writes are coalesced, and the finished stroke is persisted', async () => {
    setGame('game6');
    fake.values.set('game6/u6', 1);
    fake.values.set('game6/player1', 1);

    renderApp();
    await signIn('u6');
    await act(async () => listenerFor('game6/u6').cb({ val: () => 1, key: 'u6' }));

    const tool = tools[tools.length - 1];
    const t0 = Date.parse('2026-01-01T00:00:00Z');
    setSystemTime(t0);

    const before = fake.writes.length;
    act(() => tool.onMouseDown({ point: { x: 0, y: 0 } }));
    for (let i = 1; i <= 50; i++) {
      setSystemTime(t0 + i * 10); // 50 drag events, 10ms apart
      act(() => tool.onMouseDrag({ point: { x: i, y: i } }));
    }
    const dragWrites = fake.writes.length - before;

    expect(dragWrites).toBeGreaterThan(0); // it still streams while drawing
    expect(dragWrites).toBeLessThan(10); // ...but coalesced (not 50 writes)

    const beforeUp = fake.writes.length;
    act(() => tool.onMouseUp({ point: { x: 51, y: 51 } }));
    expect(fake.writes.length).toBe(beforeUp + 1); // the final stroke is saved
  });

  test('incoming strokes are rendered, and malformed ones are ignored', async () => {
    setGame('game7');
    fake.values.set('game7/u7', -1);
    fake.values.set('game7/player1', 1);

    renderApp();
    await signIn('u7');

    const added = childListener('child_added', 'game7/paths');
    const changed = childListener('child_changed', 'game7/paths');

    const before = paperPaths.length;
    await act(async () => added.cb({ key: 'p1', val: () => ({ path: 'M0 0L1 1' }) }));
    expect(paperPaths.length).toBe(before + 1);
    const rendered = paperPaths[paperPaths.length - 1];
    expect(rendered.pathData).toBe('M0 0L1 1');

    // The same stroke keeps growing in place...
    await act(async () => changed.cb({ key: 'p1', val: () => ({ path: 'M0 0L9 9' }) }));
    expect(rendered.pathData).toBe('M0 0L9 9');

    // ...and malformed payloads are dropped, not handed to Paper.
    await act(async () => added.cb({ key: 'p2', val: () => ({ path: 42 }) }));
    await act(async () => changed.cb({ key: 'p1', val: () => ({ path: null }) }));
    expect(paperPaths.length).toBe(before + 1);
    expect(rendered.pathData).toBe('M0 0L9 9');
  });

  test('signing out detaches the game listeners', async () => {
    setGame('game8');
    fake.values.set('game8/u8', 1);
    fake.values.set('game8/player1', 1);

    renderApp();
    await signIn('u8');
    expect(activePaths().length).toBeGreaterThan(0);

    await act(async () => {
      for (const cb of fake.authCallbacks) cb(null);
    });

    expect(activePaths()).toHaveLength(0);
  });
});
