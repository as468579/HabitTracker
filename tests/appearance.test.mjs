import test from "node:test";
import assert from "node:assert/strict";
import { themes, withFontSize, createUi, readFontSize } from "../src/theme.ts";

test("font preferences reject invalid stored values and keep every theme's typography proportional", () => {
  assert.equal(readFontSize(null), "standard");
  assert.equal(readFontSize("unexpected"), "standard");
  assert.equal(readFontSize("largest"), "largest");
  for (const base of Object.values(themes)) {
    const normal = createUi(base);
    const enlarged = withFontSize(base, "largest");
    const largeUi = createUi(enlarged);
    assert.equal(enlarged.colors, base.colors);
    assert.equal(base.font.body, 14);
    for (const key of Object.keys(base.font)) {
      assert.equal(enlarged.font[key], base.font[key] * 1.3);
    }
    for (const key of ["body", "label", "caption", "buttonText", "input"]) {
      assert.equal(largeUi[key].fontSize, normal[key].fontSize * 1.3);
      assert.equal(largeUi[key].lineHeight, normal[key].lineHeight * 1.3);
    }
    assert.equal(largeUi.input.minHeight, normal.input.minHeight);
  }
});
