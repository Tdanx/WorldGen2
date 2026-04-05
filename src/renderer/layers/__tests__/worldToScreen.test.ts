import { describe, it, expect } from 'vitest';
import { worldToScreen } from '../PoliticalLayer';

describe('worldToScreen', () => {
  // Camera centered at (500,500), zoom=0.2 (full world visible), 1000×1000 canvas
  it('maps camera center to screen center', () => {
    const [sx, sy] = worldToScreen(500, 500, 1000, 1000, 500, 500, 0.2);
    expect(sx).toBeCloseTo(500);
    expect(sy).toBeCloseTo(500);
  });

  // World origin (0,0): NDC_x=(0-500)*(0.002)=-1, NDC_y=-(0-500)*(0.002)=1
  // screen_x = (-1+1)*500 = 0, screen_y = (1-1)*500 = 0
  it('maps world origin to screen top-left at full zoom', () => {
    const [sx, sy] = worldToScreen(0, 0, 1000, 1000, 500, 500, 0.2);
    expect(sx).toBeCloseTo(0);
    expect(sy).toBeCloseTo(0);
  });

  // World (750, 250): upper-right quadrant → screen upper-right
  // NDC_x = (750-500)*(0.002) = 0.5 → sx = (0.5+1)*500 = 750
  // NDC_y = -(250-500)*(0.002) = 0.5 → sy = (1-0.5)*500 = 250
  it('maps upper-right world point to upper-right screen quadrant', () => {
    const [sx, sy] = worldToScreen(750, 250, 1000, 1000, 500, 500, 0.2);
    expect(sx).toBeCloseTo(750);
    expect(sy).toBeCloseTo(250);
    expect(sx).toBeGreaterThan(500);
    expect(sy).toBeLessThan(500);
  });
});
