// Server-side game logic for flipDraw.
//
// The client may only *propose* actions (create a game, draw paths, submit a
// guess, ask for a rematch). Everything authoritative — the word, whether the
// round is complete, who won, and the role swap — is written here with the
// Admin SDK, and the security rules deny clients from writing those fields.
//
// The word itself is a secret: only the drawer may read `currentAnimal`. The
// guesser receives a scrambled string of the same letters via `letters`.
const { onValueCreated, onValueWritten } = require('firebase-functions/v2/database');
const { logger } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');

initializeApp();

const ANIMALS = [
  'ant', 'ape', 'bat', 'bear', 'bee', 'bird', 'boar', 'cat', 'cow', 'crab',
  'crow', 'deer', 'dog', 'dove', 'duck', 'eel', 'elk', 'fish', 'fox', 'frog',
  'goat', 'hare', 'hawk', 'hen', 'hog', 'horse', 'koala', 'llama', 'lynx',
  'mole', 'moose', 'moth', 'mouse', 'newt', 'otter', 'owl', 'panda', 'pig',
  'puma', 'rat', 'seal', 'shark', 'sheep', 'skunk', 'slug', 'snail', 'snake',
  'swan', 'toad', 'trout', 'turkey', 'wolf', 'wombat', 'worm', 'zebra',
];

function pickAnimal() {
  const words = ANIMALS.filter((word) => word.length < 8);
  return words[Math.floor(Math.random() * words.length)];
}

// Same letters, different order — the guesser sees this, never the word.
function scramble(word) {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters.join('');
}

function normalize(value) {
  return (value == null ? '' : String(value)).trim().toLowerCase();
}

// Seed a brand-new game. The server picks the word and the scrambled letters
// itself and clears any authoritative field a client may have injected in the
// creation write (a node-level `.write` grant cascades to children, so
// `currentAnimal`/`letters`/`winner` can arrive at creation time).
exports.seedGame = onValueCreated('/{gameId}', async (event) => {
  const { gameId } = event.params;
  const word = pickAnimal();
  await event.data.ref.update({
    currentAnimal: word,
    letters: scramble(word),
    completed: false,
    winner: null,
    guesses: null,
  });
  logger.info('seeded game', { gameId });
});

// Validate a submitted guess. A client can only propose; the server decides.
exports.checkGuess = onValueWritten('/{gameId}/guesses/{uid}', async (event) => {
  const { uid } = event.params;
  const guess = normalize(event.data.after.val());
  if (!guess) {
    return;
  }

  // Derive the reference from the event: the trigger may be bound to a
  // different database instance (namespace) than the Admin default.
  const gameRef = event.data.after.ref.parent.parent;
  const game = (await gameRef.get()).val();
  if (!game) {
    return;
  }

  if (game.completed || guess !== normalize(game.currentAnimal)) {
    // Wrong guess (or the round is already over): drop it so the player can retry.
    await gameRef.child(`guesses/${uid}`).remove();
    return;
  }

  await gameRef.update({
    completed: true,
    winner: uid,
    paths: null,
    // Don't leave the winning word behind in a broadly-readable node.
    [`guesses/${uid}`]: null,
  });
  logger.info('correct guess', { uid });
});

// Start a new round: swap the roles, pick a new word and clear the board.
exports.startRematch = onValueWritten('/{gameId}/rematch', async (event) => {
  const { gameId } = event.params;
  if (event.data.after.val() !== true) {
    return;
  }

  const gameRef = event.data.after.ref.parent;
  const word = pickAnimal();

  // A transaction both checks the request and performs the flip atomically, so
  // a duplicate delivery (database triggers are at-least-once) or two racing
  // requests cannot flip the roles twice.
  const result = await gameRef.transaction((game) => {
    // The first attempt can run against an empty local cache. Returning the
    // current (absent) value lets the SDK reconcile with the server and retry
    // rather than aborting for good.
    if (game === null) {
      return null;
    }
    if (game.rematch !== true) {
      return; // abort — this request has already been handled
    }

    const next = {
      ...game,
      completed: false,
      winner: null,
      paths: null,
      guesses: null,
      rematch: null,
      currentAnimal: word,
      letters: scramble(word),
    };
    // Flip every role (they are exactly 1 / -1); metrics are left untouched.
    for (const key of Object.keys(next)) {
      if (next[key] === 1 || next[key] === -1) {
        next[key] = next[key] * -1;
      }
    }
    return next;
  });

  if (!result.committed) {
    return;
  }
  logger.info('started rematch', { gameId });
});
