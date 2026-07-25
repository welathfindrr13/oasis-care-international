import assert from "node:assert/strict";
import React from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StatePanel } from "./StatePanel";

test("renders an h2 for a full-page state when requested", () => {
  const markup = renderToStaticMarkup(
    <StatePanel headingLevel={2} kind="loading" title="Loading family updates">
      <p>We are checking your approved updates and concerns.</p>
    </StatePanel>,
  );

  assert.match(markup, /<h2[^>]*>Loading family updates<\/h2>/);
  assert.doesNotMatch(markup, /<h3[^>]*>Loading family updates<\/h3>/);
});

test("keeps h3 as the default for states nested beneath a section heading", () => {
  const markup = renderToStaticMarkup(
    <StatePanel title="No concerns sent">
      <p>Your concerns will appear here.</p>
    </StatePanel>,
  );

  assert.match(markup, /<h3[^>]*>No concerns sent<\/h3>/);
});
