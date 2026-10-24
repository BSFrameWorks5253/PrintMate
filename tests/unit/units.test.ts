import { describe, it, expect } from 'vitest';
import { mmToPt, ptToMm, mmToPx, pxToMm, PAPER_SIZES, STANDARD_PHOTO_PRESETS } from '../../src/utils/units';

describe('Unit Conversion and Geometry Tests', () => {
  it('converts millimeters to points accurately', () => {
    // 25.4 mm should equal exactly 72 points (1 inch)
    expect(mmToPt(25.4)).toBeCloseTo(72, 5);
    // Standard A4 width: 210 mm
    expect(mmToPt(210)).toBeCloseTo(595.2755, 3);
    // Standard A4 height: 297 mm
    expect(mmToPt(297)).toBeCloseTo(841.8897, 3);
  });

  it('converts points to millimeters accurately', () => {
    expect(ptToMm(72)).toBeCloseTo(25.4, 5);
  });

  it('converts mm to pixels at 96 DPI', () => {
    // 25.4 mm = 1 inch = 96 pixels at 96 DPI
    expect(mmToPx(25.4, 96)).toBeCloseTo(96, 5);
  });

  it('converts pixels to mm at 96 DPI', () => {
    expect(pxToMm(96, 96)).toBeCloseTo(25.4, 5);
  });

  it('validates standard paper dimensions', () => {
    expect(PAPER_SIZES.A4.width_mm).toBe(210);
    expect(PAPER_SIZES.A4.height_mm).toBe(297);
    expect(PAPER_SIZES.A3.width_mm).toBe(297);
    expect(PAPER_SIZES.A3.height_mm).toBe(420);
  });

  it('validates passport and ID card presets', () => {
    const indianPassport = STANDARD_PHOTO_PRESETS.find((p) => p.id === 'passport_in');
    expect(indianPassport).toBeDefined();
    expect(indianPassport?.width_mm).toBe(35);
    expect(indianPassport?.height_mm).toBe(45);
    expect(indianPassport?.recommendedCopies).toBe(8);

    const cr80IdCard = STANDARD_PHOTO_PRESETS.find((p) => p.id === 'id_card_cr80');
    expect(cr80IdCard).toBeDefined();
    expect(cr80IdCard?.width_mm).toBe(85.6);
    expect(cr80IdCard?.height_mm).toBe(54);
  });
});
