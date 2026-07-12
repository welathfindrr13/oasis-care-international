import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const globals = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

function token(name) {
  const value = source.match(
    new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"),
  )?.[1];
  assert.ok(value, `Missing hexadecimal token --${name}`);
  return value;
}

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first, second) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

test("foundation text and semantic states meet WCAG AA contrast", () => {
  const pairs = [
    ["primary text", "color-text-primary", "color-background-primary"],
    ["secondary text", "color-text-secondary", "color-background-primary"],
    ["placeholder text", "color-base-gray-500", "color-background-primary"],
    ["teal action", "color-accent-teal", "color-background-primary"],
    ["information", "color-info", "color-info-soft"],
    ["attention", "color-attention", "color-attention-soft"],
    ["blocking", "color-danger", "color-danger-soft"],
    ["confirmed success", "color-success", "color-success-soft"],
    ["primary button", "color-text-inverse", "color-accent-teal"],
    ["danger button", "color-text-inverse", "color-danger"],
  ];

  for (const [label, foreground, background] of pairs) {
    const ratio = contrast(token(foreground), token(background));
    assert.ok(ratio >= 4.5, `${label} contrast was ${ratio.toFixed(2)}:1`);
  }
});

test("focus indicator meets WCAG non-text contrast", () => {
  for (const background of [
    "color-background-primary",
    "color-background-secondary",
  ]) {
    const ratio = contrast(token("color-focus"), token(background));
    assert.ok(ratio >= 3, `focus contrast was ${ratio.toFixed(2)}:1`);
  }

  const controlRatio = contrast(
    token("color-control-border"),
    token("color-background-primary"),
  );
  assert.ok(
    controlRatio >= 3,
    `control boundary contrast was ${controlRatio.toFixed(2)}:1`,
  );
});

test("global foundation loads tokens first and preserves non-text inputs", () => {
  assert.ok(
    globals.indexOf('@import "../styles/tokens.css";') <
      globals.indexOf("@tailwind base;"),
  );
  assert.match(globals, /input:not\(\[type="checkbox"\]\)/);
  assert.doesNotMatch(globals, /(?:^|\n)input,\s*\ntextarea,\s*\nselect\s*\{/);
  assert.match(
    globals,
    /a:not\(\[class\]\) \{[\s\S]*?text-decoration-line: underline;/,
  );
  assert.doesNotMatch(globals, /a\[class\]/);
  assert.match(globals, /\[aria-invalid="true"\]/);
  assert.match(globals, /\.oasis-field-error/);
});
