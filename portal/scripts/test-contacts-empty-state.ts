import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const ContactsEmptyState = require("../src/components/ContactsEmptyState").default as typeof import("../src/components/ContactsEmptyState").default;

const canImportHtml = renderToStaticMarkup(
  React.createElement(ContactsEmptyState, {
    canImportContacts: true,
    importHref: "/contacts",
    showPermissionMessage: true,
  }),
);

assert.match(canImportHtml, /Importar contatos/);
assert.match(canImportHtml, /href="\/contacts"/);

const noPermissionHtml = renderToStaticMarkup(
  React.createElement(ContactsEmptyState, {
    canImportContacts: false,
    showPermissionMessage: true,
  }),
);

assert.match(noPermissionHtml, /Sem permissão para importar/);
assert.doesNotMatch(noPermissionHtml, /Importar contatos/);

console.log("ContactsEmptyState rendering assertions passed.");
