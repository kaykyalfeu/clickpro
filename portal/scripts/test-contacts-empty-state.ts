import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const ContactsEmptyState = require("../src/components/ContactsEmptyState").default as typeof import("../src/components/ContactsEmptyState").default;
const { getContactsImportError } = require("../src/lib/contactsImport") as typeof import("../src/lib/contactsImport");

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

const authenticatedHtml = renderToStaticMarkup(
  React.createElement(ContactsEmptyState, {
    isAuthenticated: true,
    importHref: "/contacts",
  }),
);

assert.match(authenticatedHtml, /Importar contatos/);
assert.match(authenticatedHtml, /href="\/contacts"/);
assert.doesNotMatch(authenticatedHtml, /Sem permissão para importar/);

const unauthenticatedHtml = renderToStaticMarkup(
  React.createElement(ContactsEmptyState, {
    isAuthenticated: false,
  }),
);

assert.doesNotMatch(unauthenticatedHtml, /Sem permissão para importar/);
assert.doesNotMatch(unauthenticatedHtml, /Importar contatos/);

const errorNoConfig = getContactsImportError({
  baseUrl: "",
  clientId: "",
  token: "",
  csvText: "",
});

assert.equal(errorNoConfig, "Informe a URL base da API.");

const errorNoToken = getContactsImportError({
  baseUrl: "http://localhost:3001",
  clientId: "1",
  token: "",
  csvText: "name,phone\nAna,5511999999999",
});

assert.equal(errorNoToken, "Informe o JWT Token antes de importar.");

const noError = getContactsImportError({
  baseUrl: "http://localhost:3001",
  clientId: "1",
  token: "token",
  csvText: "name,phone\nAna,5511999999999",
});

assert.equal(noError, null);

console.log("Contacts import validation assertions passed.");
