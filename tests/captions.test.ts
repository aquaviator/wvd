import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const videoDir = 'public/media/products/uk-landlord-mtd-ledger/video';

describe.each(['promo-v1.0.1.vtt', 'tutorial-v1.0.1.vtt'])('%s', (file) => {
  it('keeps every caption within the approved two-line safe area', () => {
    const blocks = readFileSync(`${videoDir}/${file}`, 'utf8').trim().split(/\r?\n\r?\n/).slice(1);
    for (const block of blocks) {
      const lines = block.split(/\r?\n/);
      const timing = lines.findIndex((line) => line.includes('-->'));
      expect(lines[timing]).toContain('line:88% position:50% size:74% align:center');
      const caption = lines.slice(timing + 1);
      expect(caption.length).toBeLessThanOrEqual(2);
      expect(Math.max(...caption.map((line) => line.length))).toBeLessThanOrEqual(58);
    }
  });
});
