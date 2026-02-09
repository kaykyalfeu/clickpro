import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContactsEmptyState from "../src/components/ContactsEmptyState";
import { getContactsImportError } from "../src/lib/contactsImport";
import { canImportContacts } from "../src/lib/permissions";

const canImportHtml = renderToStaticMarkup(
  React.createElement(ContactsEmptyState, {
    isAuthenticated: true,
    canImportContacts: true,
    importHref: "/contacts",
    showPermissionMessage: true,
  }),
);

assert.match(canImportHtml, /Importar contatos/);
assert.match(canImportHtml, /href="\/contacts"/);

const noPermissionHtml = renderToStaticMarkup(
  React.createElement(ContactsEmptyState, {
    isAuthenticated: true,
    canImportContacts: false,
    showPermissionMessage: true,
    importHref: "/contacts",
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
    importHref: "/contacts",
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

assert.equal(errorNoToken, "Ative sua licença para gerar o JWT antes de importar.");
const adminCanImport = canImportContacts({ isAdmin: true, hasActiveLicense: false });
assert.equal(adminCanImport, true);

const noError = getContactsImportError({
  baseUrl: "http://localhost:3001",
  clientId: "1",
  token: "token",
  csvText: "name,phone\nAna,5511999999999",
});

assert.equal(noError, null);

const licensedUserCanImport = canImportContacts({ isAdmin: false, hasActiveLicense: true });
assert.equal(licensedUserCanImport, true);

const unlicensedUserCannotImport = canImportContacts({ isAdmin: false, hasActiveLicense: false });
assert.equal(unlicensedUserCannotImport, false);

console.log("Contacts import validation assertions passed.");
