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
    rulesTest('a participant can request a rematch once the round is over', async () => {
      await seed('g-rematch', { ...STARTED, completed: true });
      await assertSucceeds(asUser('bob', (db) => set(ref(db, 'g-rematch/rematch'), true)));
    });

    rulesTest('a participant cannot request a rematch before the round is over', async () => {
      await seed('g-rematch0', { ...STARTED, completed: false });
      await assertFails(asUser('bob', (db) => set(ref(db, 'g-rematch0/rematch'), true)));
    });

    rulesTest('a non-participant cannot request a rematch', async () => {
      await seed('g-norematch', { ...STARTED, completed: true });
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

  describe('the word is a secret', () => {
    const withWord = { ...STARTED, currentAnimal: 'otter', letters: 'ottre' };

    rulesTest('the drawer can read the word', async () => {
      await seed('g-word1', withWord);
      await assertSucceeds(asUser('alice', (db) => get(ref(db, 'g-word1/currentAnimal'))));
    });

    rulesTest('the guesser cannot read the word', async () => {
      await seed('g-word2', withWord);
      await assertFails(asUser('bob', (db) => get(ref(db, 'g-word2/currentAnimal'))));
    });

    rulesTest('a non-participant cannot read the word', async () => {
      await seed('g-word3', withWord);
      await assertFails(asUser('mallory', (db) => get(ref(db, 'g-word3/currentAnimal'))));
    });

    rulesTest('the guesser can read the scrambled letters', async () => {
      await seed('g-letters1', withWord);
      await assertSucceeds(asUser('bob', (db) => get(ref(db, 'g-letters1/letters'))));
    });

    rulesTest('an anonymous user cannot read the letters', async () => {
      await seed('g-letters2', withWord);
      await assertFails(asUser(null, (db) => get(ref(db, 'g-letters2/letters'))));
    });

    rulesTest('the letters are not secret (any signed-in user may read them)', async () => {
      await seed('g-letters3', withWord);
      await assertSucceeds(asUser('mallory', (db) => get(ref(db, 'g-letters3/letters'))));
    });
  });

  // Regression guard for the hole where a player could rewrite their own role
  // slot to 1 (drawer) and then read the secret word.
  describe('roles cannot be seized', () => {
    const ROLES = { player1: 1, alice: 1, bob: -1, currentAnimal: 'otter', letters: 'ottre' };

    rulesTest('a joined player cannot change their own role', async () => {
      await seed('g-seize1', ROLES);
      await assertFails(asUser('bob', (db) => set(ref(db, 'g-seize1/bob'), 1)));
    });

    rulesTest('a guesser cannot promote themselves to drawer, so cannot read the word', async () => {
      await seed('g-seize2', ROLES);
      await assertFails(asUser('bob', (db) => set(ref(db, 'g-seize2/bob'), 1)));
      await assertFails(asUser('bob', (db) => get(ref(db, 'g-seize2/currentAnimal'))));
    });

    rulesTest('a joiner may take the side opposite the creator', async () => {
      await seed('g-seize3', { player1: 1, alice: 1 });
      await assertSucceeds(asUser('bob', (db) => set(ref(db, 'g-seize3/bob'), -1)));
    });

    rulesTest("a joiner may not claim the creator's seat", async () => {
      await seed('g-seize4', { player1: 1, alice: 1 });
      await assertFails(asUser('mallory', (db) => set(ref(db, 'g-seize4/mallory'), 1)));
    });

    rulesTest('the creator can still create a game claiming their own side', async () => {
      await assertSucceeds(
        asUser('alice', (db) => set(ref(db, 'g-seize5'), { player1: 1, alice: 1 })),
      );
    });
  });

  // Regression guard for unbounded write amplification (cost/DoS).
  describe('inputs are bounded', () => {
    const ROLES = { player1: 1, alice: 1, bob: -1, currentAnimal: 'otter', letters: 'ottre' };

    rulesTest('an oversized guess is rejected', async () => {
      await seed('g-cap1', ROLES);
      await assertFails(asUser('bob', (db) => set(ref(db, 'g-cap1/guesses/bob'), 'x'.repeat(64))));
    });

    rulesTest('a normal guess is accepted', async () => {
      await seed('g-cap2', ROLES);
      await assertSucceeds(asUser('bob', (db) => set(ref(db, 'g-cap2/guesses/bob'), 'otter')));
    });

    rulesTest('an oversized path is rejected', async () => {
      await seed('g-cap3', ROLES);
      await assertFails(
        asUser('alice', (db) => set(ref(db, 'g-cap3/paths/p1'), { path: 'M'.repeat(20001) })),
      );
    });

    rulesTest('a path node may not carry extra children', async () => {
      await seed('g-cap4', ROLES);
      await assertFails(
        asUser('alice', (db) => set(ref(db, 'g-cap4/paths/p1'), { path: 'M0 0', junk: 1 })),
      );
    });

    rulesTest('an oversized word is rejected at creation', async () => {
      await assertFails(
        asUser('alice', (db) =>
          set(ref(db, 'g-cap5'), { player1: 1, alice: 1, currentAnimal: 'x'.repeat(64) }),
        ),
      );
    });

    rulesTest('an oversized letters string is rejected at creation', async () => {
      await assertFails(
        asUser('alice', (db) =>
          set(ref(db, 'g-cap6'), { player1: 1, alice: 1, letters: 'x'.repeat(64) }),
        ),
      );
    });

    rulesTest('an implausible canvas size is rejected', async () => {
      await seed('g-cap7', ROLES);
      await assertFails(asUser('alice', (db) => update(ref(db, 'g-cap7'), { drawHeight: 999999 })));
    });
  });
});
