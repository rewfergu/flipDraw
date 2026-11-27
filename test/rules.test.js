// Security-rules tests for the Realtime Database.
//
// These run against the Firebase Database emulator (a JDK 21+ is required), via:
//   bun run test:rules
//
// They are skipped unless FLIPDRAW_RULES=1, so a plain `bun test` stays green
// and offline. They never touch the real database.
import { afterAll, beforeAll, describe, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { get, ref, set, update } from 'firebase/database';

const runRules = process.env.FLIPDRAW_RULES === '1';
// `test` when running for real, otherwise a no-op that marks each test skipped.
const rulesTest = runRules ? test : test.skip;

let testEnv;

if (runRules) {
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

// Runs `fn` against the database as `uid` (or anonymously when uid is null).
function asUser(uid, fn) {
  const ctx = uid
    ? testEnv.authenticatedContext(uid)
    : testEnv.unauthenticatedContext();
  return fn(ctx.database());
}

// Seeds a game by a trusted context (bypasses rules).
function seed(gameId, data) {
  return testEnv.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), gameId), data));
}

const OPEN = { player1: 1, alice: 1 };
const STARTED = { player1: 1, alice: 1, bob: -1, currentAnimal: 'otter', completed: false };

describe('flipDraw database rules', () => {
  describe('authentication', () => {
    rulesTest('anonymous cannot read a game', async () => {
      await seed('g-read', { ...OPEN, currentAnimal: 'cat', completed: false });
      await assertFails(asUser(null, (db) => get(ref(db, 'g-read'))));
    });

    rulesTest('anonymous cannot create a game', async () => {
      await assertFails(asUser(null, (db) => set(ref(db, 'g-anon'), { ...OPEN })));
    });
  });

  describe('creating a game', () => {
    rulesTest('a signed-in user can create a game claiming their own uid', async () => {
      await assertSucceeds(
        asUser('alice', (db) => set(ref(db, 'g-create'), { player1: 1, alice: 1 })),
      );
    });

    rulesTest("a user cannot claim someone else's uid", async () => {
      await assertFails(
        asUser('alice', (db) => set(ref(db, 'g-spoof'), { player1: 1, bob: 1 })),
      );
    });

    rulesTest('roles must be 1 or -1', async () => {
      await assertFails(
        asUser('alice', (db) => set(ref(db, 'g-bad'), { player1: 5, alice: 1 })),
      );
    });
  });

  describe('joining', () => {
    rulesTest('a second user may add their own slot', async () => {
      await seed('g-join', { player1: 1, alice: 1 });
      await assertSucceeds(asUser('bob', (db) => update(ref(db, 'g-join'), { bob: -1 })));
    });

    rulesTest('a user may not add a slot for someone else', async () => {
      await seed('g-noslot', { player1: 1, alice: 1 });
      await assertFails(asUser('mallory', (db) => update(ref(db, 'g-noslot'), { carol: -1 })));
    });
  });

  describe('server-owned fields are read-only to clients', () => {
    rulesTest('a client cannot write the word', async () => {
      await seed('g-word', STARTED);
      await assertFails(asUser('alice', (db) => update(ref(db, 'g-word'), { currentAnimal: 'dog' })));
    });

    rulesTest('a client cannot mark the round complete', async () => {
      await seed('g-done', STARTED);
      await assertFails(asUser('bob', (db) => update(ref(db, 'g-done'), { completed: true })));
    });

    rulesTest('a client cannot set the winner', async () => {
      await seed('g-win', STARTED);
      await assertFails(asUser('bob', (db) => update(ref(db, 'g-win'), { winner: 'bob' })));
    });
  });

  describe('guesses are proposed, not asserted', () => {
    rulesTest('the guesser may submit a guess', async () => {
      await seed('g-guess', STARTED);
      await assertSucceeds(asUser('bob', (db) => set(ref(db, 'g-guess/guesses/bob'), 'otter')));
    });

    rulesTest('the drawer may not submit a guess', async () => {
      await seed('g-drawguess', STARTED);
      await assertFails(asUser('alice', (db) => set(ref(db, 'g-drawguess/guesses/alice'), 'otter')));
    });

    rulesTest('a non-participant may not submit a guess', async () => {
      await seed('g-outguess', STARTED);
      await assertFails(asUser('mallory', (db) => set(ref(db, 'g-outguess/guesses/mallory'), 'otter')));
    });
  });

  describe('rematch is requested, not performed', () => {
    rulesTest('a participant can request a rematch', async () => {
      await seed('g-rematch', STARTED);
      await assertSucceeds(asUser('bob', (db) => set(ref(db, 'g-rematch/rematch'), true)));
    });

    rulesTest('a non-participant cannot request a rematch', async () => {
      await seed('g-norematch', STARTED);
      await assertFails(asUser('mallory', (db) => set(ref(db, 'g-norematch/rematch'), true)));
    });
  });

  describe('drawing', () => {
    rulesTest('a participant can draw a path', async () => {
      await seed('g-draw', STARTED);
      await assertSucceeds(
        asUser('alice', (db) => set(ref(db, 'g-draw/paths/p1'), { path: 'M0 0L1 1' })),
      );
    });

    rulesTest('the drawer can publish the canvas size', async () => {
      await seed('g-size', STARTED);
      await assertSucceeds(
        asUser('alice', (db) => update(ref(db, 'g-size'), { drawHeight: 800, drawWidth: 400 })),
      );
    });

    rulesTest('a non-participant cannot draw', async () => {
      await seed('g-intruder', STARTED);
      await assertFails(asUser('mallory', (db) => set(ref(db, 'g-intruder/paths/p1'), { path: 'M0 0' })));
    });

    rulesTest('a path node must contain a path', async () => {
      await seed('g-shape', STARTED);
      await assertFails(asUser('alice', (db) => set(ref(db, 'g-shape/paths/p1'), { nope: 1 })));
    });
  });
});
