import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const ContactsEmptyState = require("../src/components/ContactsEmptyState").default as typeof import("../src/components/ContactsEmptyState").default;

// Test: authenticated user should see import button
const authenticatedHtml = renderToStaticMarkup(
  React.createElement(ContactsEmptyState, {
    isAuthenticated: true,
    importHref: "/contacts",
  }),
);

assert.match(authenticatedHtml, /Importar contatos/);
assert.match(authenticatedHtml, /href="\/contacts"/);
assert.doesNotMatch(authenticatedHtml, /Sem permissão para importar/);

// Test: unauthenticated user should not see import button or permission message
const unauthenticatedHtml = renderToStaticMarkup(
  React.createElement(ContactsEmptyState, {
    isAuthenticated: false,
  }),
);

assert.doesNotMatch(unauthenticatedHtml, /Sem permissão para importar/);
assert.doesNotMatch(unauthenticatedHtml, /Importar contatos/);

console.log("ContactsEmptyState rendering assertions passed.");
