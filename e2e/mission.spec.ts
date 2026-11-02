import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('landing reports real system status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'NEXUS', level: 1 })).toBeVisible();
  await expect(page.getByText('Simulator mode (no API keys)')).toBeVisible();
  await expect(page.getByText(/Agents registered: \d+/)).toBeVisible();
});

test('run a mission end-to-end, inspect trace, accept and challenge', async ({ page }) => {
  await page.goto('/#console');
  const mission = page.getByLabel('What strategic problem are you trying to solve?');
  await mission.fill('Open a bakery in Lisbon that sells gluten-free bread to tourists');
  await page.getByRole('radio', { name: 'Startup Validation' }).click();
  await page.getByRole('button', { name: 'Initiate Operation' }).click();

  const decision = page.locator('.decision-text');
  await expect(decision).toContainText(/bakery/i, { timeout: 30_000 });
  await expect(page.getByRole('note')).toContainText('Simulated output');
  await expect(page.locator('.confidence-score')).toHaveText(/Confidence \d+\/100/);
  await expect(page.getByRole('cell', { name: 'Head of Product' })).toBeVisible();

  await page.getByRole('button', { name: /^Researcher/, description: /Opens the structured trace/ }).click();
  const dialog = page.getByRole('dialog', { name: /Researcher/ });
  await expect(dialog).toContainText('"findings"');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('tab', { name: 'Debate' }).click();
  await expect(page.getByText('Most dangerous assumption')).toBeVisible();

  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Not committed to memory' })).toBeVisible();

  await page.getByLabel('Refinement constraint').fill('Keep the budget under 20k EUR');
  await page.getByRole('button', { name: 'Refine plan' }).click();
  await expect(page.locator('.refinement-note')).toContainText('20k', { timeout: 30_000 });
  await expect(decision).toContainText('20k');
});

test('history persists server-side and comparison opens', async ({ page }) => {
  await page.goto('/#console');
  await page
    .getByLabel('What strategic problem are you trying to solve?')
    .fill('Launch an AI education copilot for rural schools');
  await page.getByRole('button', { name: 'Initiate Operation' }).click();
  await expect(page.locator('.decision-text')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.locator('.history-item').first()).toBeVisible();
  await page.getByRole('button', { name: 'Compare Plans' }).click();
  await expect(page.getByRole('dialog', { name: 'Compare plans' })).toBeVisible();
});

test('console has no serious accessibility violations', async ({ page }) => {
  await page.goto('/#console');
  await page
    .getByLabel('What strategic problem are you trying to solve?')
    .fill('Plan a community solar program for low-income neighbourhoods');
  await page.getByRole('button', { name: 'Initiate Operation' }).click();
  await expect(page.locator('.decision-text')).toBeVisible({ timeout: 30_000 });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});
