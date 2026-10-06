import assert from "node:assert/strict";
import test from "node:test";
import { createUiTranslator, normalizeUiKey } from "./ui-translate.ts";

const translate = createUiTranslator([
  {
    "Carnet d’adresses": "Address book",
    "en retard": "overdue",
    "{n} client(s) à relancer": "{n} client(s) to remind",
    "Actifs": "Active",
    "Rechercher…": "Search…",
    "Ce profil est déjà occupé par {x}. Action annulée.": "This profile is already taken by {x}. Action cancelled.",
    "{n} client{x}, {n} compte{x}": "{n} client{x}, {n} account{x}",
    "Voir {n} de plus": "Show {x} more",
  },
]);

test("a number key whose translation uses {x} still carries the number", () => {
  assert.equal(translate("Voir 4 de plus"), "Show 4 more");
});

test("free-text placeholders carry names through", () => {
  assert.equal(
    translate("Ce profil est déjà occupé par Jean Kamga. Action annulée."),
    "This profile is already taken by Jean Kamga. Action cancelled."
  );
});

test("French month names in dates are localized", () => {
  assert.equal(translate("05 oct. 2026"), "05 Oct 2026");
  assert.equal(translate("Membre depuis octobre 2026"), "Membre depuis October 2026");
  assert.equal(translate("Expire le 1 août 2026 · Netflix"), "Expire le 1 August 2026 · Netflix");
  assert.equal(translate("mai"), "mai");
});

test("mixed number and plural placeholders", () => {
  assert.equal(translate("3 clients, 1 compte"), "3 clients, 1 account");
});

test("normalizeUiKey unifies apostrophes and spaces", () => {
  assert.equal(normalizeUiKey("Carnet d’adresses"), normalizeUiKey("Carnet  d'adresses"));
});

test("straight apostrophe matches curly dictionary key", () => {
  assert.equal(translate("Carnet d'adresses"), "Address book");
});

test("keeps surrounding whitespace of text nodes", () => {
  assert.equal(translate(" en retard"), " overdue");
});

test("numbers are carried over through templates", () => {
  assert.equal(translate("3 client(s) à relancer"), "3 client(s) to remind");
});

test("edge punctuation is preserved", () => {
  assert.equal(translate(", en retard"), ", overdue");
});

test("case-insensitive fallback keeps source casing", () => {
  assert.equal(translate("actifs"), "active");
});

test("ellipsis variants match", () => {
  assert.equal(translate("Rechercher..."), "Search…");
});

test("unknown text and pure numbers are left untouched", () => {
  assert.equal(translate("Texte inconnu"), "Texte inconnu");
  assert.equal(translate("3 000"), "3 000");
});
