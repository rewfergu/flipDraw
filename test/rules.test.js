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

const NEW_GAME = { currentAnimal: 'cat', completed: false, player1: 1 };
const STARTED = { currentAnimal: 'cat', completed: false, player1: 1, alice: 1, bob: -1 };

describe('flipDraw database rules', () => {
  describe('authentication is required', () => {
    rulesTest('anonymous cannot read a game', async () => {
      await seed('g-read', { ...NEW_GAME, alice: 1 });
      await assertFails(asUser(null, (db) => get(ref(db, 'g-read'))));
    });

    rulesTest('anonymous cannot create a game', async () => {
      await assertFails(
        asUser(null, (db) => set(ref(db, 'g-anon'), { ...NEW_GAME, alice: 1 })),
      );
    });
  });

  describe('creating a game', () => {
    rulesTest('a signed-in user can create a game claiming their own uid', async () => {
      await assertSucceeds(
        asUser('alice', (db) => set(ref(db, 'g-create'), { ...NEW_GAME, alice: 1 })),
      );
    });

    rulesTest("a user cannot claim someone else's uid", async () => {
      await assertFails(
        asUser('alice', (db) => set(ref(db, 'g-spoof'), { ...NEW_GAME, bob: 1 })),
      );
    });

    rulesTest('roles must be 1 or -1', async () => {
      await assertFails(
        asUser('alice', (db) => set(ref(db, 'g-badrole'), { ...NEW_GAME, player1: 5, alice: 1 })),
      );
    });
  });

  describe('joining a game', () => {
    rulesTest('a second user may add their own slot', async () => {
      await seed('g-join', { ...NEW_GAME, alice: 1 });
      await assertSucceeds(asUser('bob', (db) => update(ref(db, 'g-join'), { bob: -1 })));
    });

    rulesTest('a user may not add a slot for someone else', async () => {
      await seed('g-noslot', { ...NEW_GAME, alice: 1 });
      await assertFails(asUser('mallory', (db) => update(ref(db, 'g-noslot'), { carol: -1 })));
    });
  });

  describe('playing a game', () => {
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

    rulesTest('a participant can mark the round completed and clear paths', async () => {
      await seed('g-over', STARTED);
      await assertSucceeds(
        asUser('bob', (db) => update(ref(db, 'g-over'), { completed: true, paths: [] })),
      );
    });

    rulesTest('a participant can swap roles for a rematch', async () => {
      await seed('g-rematch', STARTED);
      await assertSucceeds(
        asUser('alice', (db) =>
          update(ref(db, 'g-rematch'), {
            completed: false,
            paths: null,
            player1: -1,
            currentAnimal: 'dog',
            alice: -1,
            bob: 1,
          }),
        ),
      );
    });

    rulesTest('a non-participant cannot tamper with the game', async () => {
      await seed('g-tamper', STARTED);
      await assertFails(asUser('mallory', (db) => update(ref(db, 'g-tamper'), { completed: true })));
      await assertFails(
        asUser('mallory', (db) => set(ref(db, 'g-tamper/paths/p1'), { path: 'M0 0' })),
      );
    });

    rulesTest('a path node must contain a path', async () => {
      await seed('g-shape', STARTED);
      await assertFails(asUser('alice', (db) => set(ref(db, 'g-shape/paths/p1'), { nope: 1 })));
    });

    rulesTest('the word must be a string', async () => {
      await seed('g-word', STARTED);
      await assertFails(
        asUser('alice', (db) => update(ref(db, 'g-word'), { currentAnimal: 42 })),
      );
    });
  });
});
