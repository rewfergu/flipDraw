import { expect, test } from '@playwright/test';

// Signs a page in through the Auth emulator's fake Google popup.
async function signIn(page, email) {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Sign in with Google' }).click(),
  ]);

  await popup.waitForLoadState('domcontentloaded');
  await popup.getByRole('button', { name: /add new account/i }).click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#sign-in').click();

  // Signed in once the app no longer offers to sign in. (For a player joining
  // via an invite URL the menu closes, so there is no "Sign Out" to wait for.)
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toHaveCount(0, {
    timeout: 30_000,
  });
}

// Dragula listens for mouse events, so Playwright's HTML5 dragTo() won't work —
// drive a real mouse drag between the two elements' centres instead.
async function dragCentre(page, from, to) {
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  const fromX = fromBox.x + fromBox.width / 2;
  const fromY = fromBox.y + fromBox.height / 2;
  const toX = toBox.x + toBox.width / 2;
  const toY = toBox.y + toBox.height / 2;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(fromX + ((toX - fromX) * step) / 10, fromY + ((toY - fromY) * step) / 10);
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
}

// Surface browser errors in the test output (handy when CI fails).
function watchConsole(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[${label}:${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => console.log(`[${label}:pageerror] ${err.message}`));
}

test('two players play a round and rematch', async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();
  watchConsole(alice, 'alice');
  watchConsole(bob, 'bob');
  // Unique emails so repeated runs against a long-lived emulator don't collide.
  const run = Date.now().toString(36);

  // --- Alice creates a game as the drawer -------------------------------
  await alice.goto('/');
  await signIn(alice, `alice-${run}@example.com`);

  // The server picks the word. Retry in case the Functions emulator is still
  // warming up on a cold start — its database triggers only fire once loaded.
  let word = '';
  for (let attempt = 0; attempt < 6 && !word; attempt++) {
    if (attempt > 0) await alice.goto('/');
    await alice.getByRole('button', { name: 'Draw' }).click();
    await expect(alice).toHaveURL(/index\.html\?id=/);
    const title = alice.locator('#drawingTitle');
    await expect(title).toBeVisible();
    try {
      await expect(title).toHaveText(/.+/, { timeout: 5_000 });
      word = (await title.textContent()).trim();
    } catch {
      // Not seeded yet — try a fresh game.
    }
  }
  expect(word.length).toBeGreaterThan(1);
  const gameUrl = alice.url();

  // --- Bob joins as the guesser ----------------------------------------
  await bob.goto(gameUrl);
  await signIn(bob, `bob-${run}@example.com`);

  await expect(bob.locator('.letter-pool .letter')).toHaveCount(word.length);

  // The answer never reaches the guesser's client.
  await expect(bob.locator('[data-letter]')).toHaveCount(0);
  await expect(bob.locator('#drawingTitle')).toHaveCount(0);

  // He has exactly the right letters, just not the order.
  const tiles = (await bob.locator('.letter-pool .letter').allInnerTexts()).map((t) => t.trim());
  expect(tiles.slice().sort()).toEqual(word.split('').sort());

  // --- Bob assembles the word ------------------------------------------
  for (let i = 0; i < word.length; i++) {
    const slot = bob.locator('.word .position').nth(i);
    const tile = await bob.evaluateHandle(
      (letter) => [...document.querySelectorAll('.letter-pool .letter')].find((t) => t.textContent.trim() === letter),
      word[i],
    );
    await dragCentre(bob, tile.asElement(), slot);
  }

  // Filling every slot is what triggers the submit.
  await expect(bob.locator('.word .position .letter')).toHaveCount(word.length);

  // --- The server judges it, and both players win ----------------------
  await expect(alice.getByRole('heading', { name: 'You Win!' })).toBeVisible({ timeout: 30_000 });
  await expect(bob.getByRole('heading', { name: 'You Win!' })).toBeVisible();

  // --- Rematch: roles swap server-side ---------------------------------
  await alice.getByRole('button', { name: 'Play Again' }).click();

  await expect(bob.locator('#drawingTitle')).toHaveText(/.+/, { timeout: 30_000 });
  const nextWord = (await bob.locator('#drawingTitle').textContent()).trim();
  expect(nextWord).not.toBe(word);

  await expect(alice.locator('.letter-pool .letter')).toHaveCount(nextWord.length);
  await expect(alice.locator('#drawingTitle')).toHaveCount(0);
});
