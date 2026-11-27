// Server-side game logic for flipDraw.
//
// The client may only *propose* actions (create a game, draw paths, submit a
// guess, ask for a rematch). Everything authoritative — the word, whether the
// round is complete, who won, and the role swap — is written here with the
// Admin SDK, and the security rules deny clients from writing those fields.
const { onValueCreated, onValueWritten } = require('firebase-functions/v2/database');
const { logger } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

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

function normalize(value) {
  return (value == null ? '' : String(value)).trim().toLowerCase();
}

// Seed a brand-new game: pick the word and set the initial flags. Clients
// cannot write currentAnimal/completed, so the server owns them.
exports.seedGame = onValueCreated('/{gameId}', async (event) => {
  const { gameId } = event.params;
  const game = event.data.val() || {};
  await event.data.ref.update({
    currentAnimal: game.currentAnimal || pickAnimal(),
    completed: false,
  });
  logger.info('seeded game', { gameId, currentAnimal: game.currentAnimal });
});

// Validate a submitted guess. A client can only propose; the server decides.
exports.checkGuess = onValueWritten('/{gameId}/guesses/{uid}', async (event) => {
  const { gameId, uid } = event.params;
  const guess = normalize(event.data.after.val());
  if (!guess) {
    return;
  }

  const gameRef = getDatabase().ref(`/${gameId}`);
  const game = (await gameRef.get()).val();
  if (!game) {
    return;
  }

  if (game.completed || guess !== normalize(game.currentAnimal)) {
    // Wrong guess (or the round is already over): drop it so the player can retry.
    await gameRef.child(`guesses/${uid}`).remove();
    return;
  }

  await gameRef.update({ completed: true, winner: uid, paths: null });
  logger.info('correct guess', { gameId, uid, answer: game.currentAnimal });
});

// Start a new round: swap the roles, pick a new word and clear the board.
exports.startRematch = onValueWritten('/{gameId}/rematch', async (event) => {
  const { gameId } = event.params;
  if (event.data.after.val() !== true) {
    return;
  }

  const gameRef = getDatabase().ref(`/${gameId}`);
  const game = (await gameRef.get()).val();
  if (!game || game.rematch !== true) {
    return; // already handled (trigger is at-least-once)
  }

  const next = {
    completed: false,
    winner: null,
    paths: null,
    rematch: null,
    currentAnimal: pickAnimal(),
  };
  // Flip every role (they are exactly 1 / -1); leaves metrics untouched.
  for (const key of Object.keys(game)) {
    if (game[key] === 1 || game[key] === -1) {
      next[key] = game[key] * -1;
    }
  }

  await gameRef.update(next);
  logger.info('started rematch', { gameId });
});
