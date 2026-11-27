// Integration test for the server-side game logic in functions/index.js.
//
// Runs against the Database + Functions emulators (a JDK 21+ is required), via:
//   bun run test:functions
//
// Skipped unless FLIPDRAW_FUNCTIONS=1, so a plain `bun test` stays offline.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, set, update } from 'firebase/database';

const runFunctions = process.env.FLIPDRAW_FUNCTIONS === '1';
const fnTest = runFunctions ? test : test.skip;

let testEnv;

if (runFunctions) {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-flipdraw',
      database: {
        rules: readFileSync('database.rules.json', 'utf8'),
        host: '127.0.0.1',
        port: 9000,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Polls `readValue` until `predicate` holds (Cloud Functions are asynchronous).
async function waitFor(readValue, predicate, label, timeoutMs = 15000) {
  const start = Date.now();
  for (;;) {
    const value = await readValue();
    if (predicate(value)) {
      return value;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for ${label}; last value = ${JSON.stringify(value)}`);
    }
    await sleep(150);
  }
}

function dbAs(uid) {
  return testEnv.authenticatedContext(uid).database();
}

describe('server-side game logic (Cloud Functions)', () => {
  fnTest('seedGame picks a word and opens the round', async () => {
    const alice = dbAs('seed-alice');
    await set(ref(alice, 'seed-game'), { player1: 1, 'seed-alice': 1 });

    const word = await waitFor(
      () => get(ref(alice, 'seed-game/currentAnimal')).then((s) => s.val()),
      (v) => typeof v === 'string' && v.length > 0,
      'seeded word',
    );

    expect(typeof word).toBe('string');
    expect((await get(ref(alice, 'seed-game/completed'))).val()).toBe(false);
  });

  fnTest('checkGuess rejects a wrong guess and accepts the right one', async () => {
    const alice = dbAs('guess-alice');
    await set(ref(alice, 'guess-game'), { player1: 1, 'guess-alice': 1 });
    const answer = await waitFor(
      () => get(ref(alice, 'guess-game/currentAnimal')).then((s) => s.val()),
      (v) => typeof v === 'string' && v.length > 0,
      'word',
    );

    const bob = dbAs('guess-bob');
    await update(ref(bob, 'guess-game'), { 'guess-bob': -1 }); // bob joins as guesser

    // A wrong guess is cleared and the round stays open.
    await set(ref(bob, 'guess-game/guesses/guess-bob'), 'definitely-not-the-word');
    await waitFor(
      () => get(ref(bob, 'guess-game/guesses/guess-bob')).then((s) => s.val()),
      (v) => v == null,
      'wrong guess cleared',
    );
    expect((await get(ref(bob, 'guess-game/completed'))).val()).toBe(false);

    // The right guess wins, decided by the server.
    await set(ref(bob, 'guess-game/guesses/guess-bob'), answer);
    await waitFor(
      () => get(ref(bob, 'guess-game/completed')).then((s) => s.val()),
      (v) => v === true,
      'completed',
    );
    expect((await get(ref(bob, 'guess-game/winner'))).val()).toBe('guess-bob');
  });

  fnTest('startRematch swaps the roles, picks a new word and clears the board', async () => {
    const alice = dbAs('rematch-alice');
    await set(ref(alice, 'rematch-game'), { player1: 1, 'rematch-alice': 1 });
    await waitFor(
      () => get(ref(alice, 'rematch-game/currentAnimal')).then((s) => s.val()),
      (v) => typeof v === 'string' && v.length > 0,
      'word',
    );

    const bob = dbAs('rematch-bob');
    await update(ref(bob, 'rematch-game'), { 'rematch-bob': -1 });

    await set(ref(bob, 'rematch-game/rematch'), true);

    await waitFor(
      () => get(ref(alice, 'rematch-game/rematch-alice')).then((s) => s.val()),
      (v) => v === -1,
      'alice flipped to guesser',
    );
    expect((await get(ref(bob, 'rematch-game/rematch-bob'))).val()).toBe(1);
    expect((await get(ref(alice, 'rematch-game/rematch'))).val()).toBe(null);
    expect((await get(ref(alice, 'rematch-game/completed'))).val()).toBe(false);
  });
});
