import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('output/e2e');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: process.platform === 'darwin' ? ['--use-angle=metal'] : [],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const url = process.env.STUDIO_URL || 'http://127.0.0.1:5173';
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const expectState = async (expected) => {
  await page.waitForFunction(
    (expected) => {
      const state = JSON.parse(window.render_game_to_text());
      return Object.entries(expected).every(([key, value]) => state[key] === value);
    },
    expected,
    { timeout: 15000 },
  );
};
const click = (name, exact = true) => page.getByRole('button', { name, exact }).click();
const screenshot = async (name) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
};
const drag = async (points) => {
  const canvas = page.locator('.canvas-host canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * points[0][0], box.y + box.height * points[0][1]);
  await page.mouse.down();
  for (const [x, y] of points.slice(1))
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 5 });
  await page.mouse.up();
};

try {
  await page.goto(url);
  await page.waitForFunction(() => window.render_game_to_text);
  await expectState({ stage: 'pick', mode: 'guided', shape: 'classic', cuts: 0 });
  await screenshot('01-welcome');
  await click('The Tall One', false);
  await expectState({ shape: 'tall' });
  await click('The Heirloom', false);
  await expectState({ shape: 'heirloom' });
  await click('The Ghost', false);
  await expectState({ shape: 'ghost' });
  await screenshot('02-ghost');
  await click('The Sage', false);
  await expectState({ shape: 'sage' });
  await click('The Classic', false);
  await expectState({ shape: 'classic' });
  console.log('Five pumpkin varieties verified.');
  await click('Make your mark');
  await expectState({ stage: 'pick' });
  await click('This is the one');
  await expectState({ stage: 'prepare', tool: 'knife' });
  // The actual canvas gesture opens the lid.
  await drag([
    [0.5, 0.48],
    [0.5, 0.48],
  ]);
  await expectState({ lidOpen: true });
  await click('Scoop');
  await expectState({ tool: 'scoop' });
  await screenshot('03-open-pulp');
  await drag([
    [0.5, 0.43],
    [0.5, 0.3],
  ]);
  await expectState({ scoops: 1 });
  await screenshot('04-pull-pulp');
  for (let i = 1; i < 6; i++) {
    await click('Pull out a scoop');
    await expectState({ scoops: i + 1 });
  }
  await click('Let’s make a mark');
  await expectState({ stage: 'carve', lidOpen: false });
  console.log('Lid and scoop gestures verified.');
  // User-drawn, closed freehand polygon.
  await drag([
    [0.45, 0.44],
    [0.47, 0.4],
    [0.49, 0.44],
    [0.48, 0.48],
    [0.45, 0.44],
  ]);
  await expectState({ cuts: 1 });
  await click('Undo');
  await expectState({ cuts: 0 });
  await click('Redo');
  await expectState({ cuts: 1 });
  await click('Undo');
  await expectState({ cuts: 0 });
  await click('Cutters');
  await click('star cutter');
  await drag([
    [0.56, 0.43],
    [0.56, 0.43],
  ]);
  await expectState({ cuts: 1 });
  await click('Undo');
  await expectState({ cuts: 0 });
  await click('Paint');
  await drag([
    [0.46, 0.45],
    [0.48, 0.47],
    [0.5, 0.45],
    [0.52, 0.47],
    [0.54, 0.45],
  ]);
  await expectState({ strokes: 1 });
  await click('Marker');
  await page.getByLabel('Custom color').fill('#292d28');
  await drag([
    [0.46, 0.51],
    [0.48, 0.53],
    [0.5, 0.51],
    [0.52, 0.53],
    [0.54, 0.51],
  ]);
  await expectState({ strokes: 2 });
  await screenshot('05-painted');
  await click('Eraser');
  await drag([
    [0.48, 0.46],
    [0.5, 0.46],
    [0.52, 0.46],
  ]);
  await expectState({ strokes: 3 });
  await click('Undo');
  await expectState({ strokes: 2 });
  await click('Undo');
  await expectState({ strokes: 1 });
  await click('Undo');
  await expectState({ strokes: 0 });
  console.log('Freehand cutting, cutters, paint, marker, eraser, and undo/redo verified.');
  await click('Need a little inspiration?');
  await click('☻ The classic grin');
  await expectState({ cuts: 4 });
  await screenshot('06-carved-day');
  await click('Bring it to life');
  await expectState({ stage: 'light', light: 'tealight' });
  await click('Night');
  await expectState({ environment: 'night' });
  await screenshot('07-candle-night');
  await click('▥ The wax candle A taller, dancing flame');
  await expectState({ light: 'pillar' });
  await page.locator('#flicker').fill('0.9');
  await page.locator('#brightness').fill('1.7');
  await click('Rotate pumpkin');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).rotation > 0.1);
  await click('Pause rotation');
  await click('Reset view');
  await click('✧ Something spellbinding A little violet LED magic');
  await expectState({ light: 'violet' });
  await screenshot('08-violet');
  await click('✦ Amber glow A steady golden LED');
  await expectState({ light: 'amber' });
  await click('◉ The little tealight Small flame, warm heart');
  await click('Save to My pumpkins');
  await page.getByRole('button', { name: /My pumpkins 1/ }).click();
  assert.equal(await page.locator('.gallery-card').count(), 1);
  await click('Close dialog');
  await click('Keep a little magic');
  await page.locator('#project-name').fill('Test lantern');
  await page.getByLabel('A little more detail').selectOption('720');
  await page.getByLabel('One full rotation').selectOption('6');
  await screenshot('09-export');
  const projectDownload = page.waitForEvent('download');
  await click('Save project');
  const projectFile = await projectDownload;
  await projectFile.saveAs(path.join(output, 'test-lantern.hollow.json'));
  const savedProject = JSON.parse(
    await fs.readFile(path.join(output, 'test-lantern.hollow.json'), 'utf8'),
  );
  assert.equal(savedProject.cuts.length, 4);
  assert.equal(savedProject.scoops, 6);
  const pngDownload = page.waitForEvent('download');
  await click('Save a PNG');
  await (await pngDownload).saveAs(path.join(output, 'test-lantern.png'));
  // Record night, then day. Validate that state and viewport are restored after each export.
  for (const [label, env] of [
    ['After dark Let that glow shine', 'night'],
    ['Golden daylight Every little detail', 'day'],
  ]) {
    await click(label);
    await page.getByLabel('A little more detail').selectOption(env === 'day' ? '1080' : '720');
    const videoDownload = page.waitForEvent('download', { timeout: 60000 });
    await click('Download rotating video');
    const video = await videoDownload;
    const extension = path.extname(video.suggestedFilename());
    const file = path.join(output, `turntable-${env}${extension}`);
    await video.saveAs(file);
    assert.ok((await fs.stat(file)).size > 20000);
    await expectState({ exporting: false, environment: 'night' });
    console.log(`Verified video download: ${file}`);
  }
  // Cancellation is non-destructive and leaves recording available.
  await click('Download rotating video');
  await click('Cancel recording');
  await expectState({ exporting: false });
  await click('Close dialog');
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => window.render_game_to_text);
  await expectState({ cuts: 4, scoops: 6, light: 'tealight', stage: 'light' });
  await click('Start fresh');
  await click('Back to the pumpkin patch');
  await expectState({ cuts: 0, scoops: 0, stage: 'pick' });
  await click('Undo');
  await expectState({ cuts: 4, scoops: 6 });
  await click('Start fresh');
  await click('Back to the pumpkin patch');
  await page.getByRole('button', { name: /My pumpkins 1/ }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles(path.join(output, 'test-lantern.hollow.json'));
  await expectState({ cuts: 4, scoops: 6, stage: 'light' });
  await click('Start fresh');
  await click('Back to the pumpkin patch');
  await click('Freestyle');
  await click('Make your mark');
  await expectState({ stage: 'carve', mode: 'freestyle', scoops: 0 });
  await click('Cutters');
  await click('heart cutter');
  await drag([
    [0.5, 0.48],
    [0.5, 0.48],
  ]);
  await expectState({ cuts: 1 });
  await screenshot('10-freestyle');
  await click('How it works');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);

  // Responsive layout: no horizontal overflow, usable controls, live WebGL.
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('11-mobile');
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await click('Light it up');
  await expectState({ stage: 'light' });
  await click('◉ The little tealight Small flame, warm heart');
  await click('Night');
  await screenshot('12-mobile-night');
  assert.equal(errors.length, 0, errors.join('\n'));
  await fs.writeFile(
    path.join(output, 'report.json'),
    JSON.stringify(
      {
        status: 'passed',
        errors,
        finalState: await state(),
        checks: [
          '5 varieties',
          'guided guard',
          'canvas lid opening',
          'canvas scoop drag',
          '6 scoops',
          'freehand geometry',
          'cutters',
          'paint',
          'marker',
          'eraser',
          'undo/redo',
          'template',
          '4 lights',
          'flicker and brightness',
          'rotation',
          'gallery',
          'project and PNG downloads',
          'day and night video downloads',
          'export cancellation',
          'autosave reload',
          'project import',
          'freestyle',
          'modal escape',
          'mobile overflow',
        ],
      },
      null,
      2,
    ),
  );
  console.log('All workshop checks passed.');
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
  console.error('Current state:', await state().catch(() => 'unavailable'));
  console.error('Browser errors:', errors);
  throw error;
} finally {
  await browser.close();
}
