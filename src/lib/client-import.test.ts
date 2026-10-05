import assert from "node:assert/strict";
import test from "node:test";
import { autoAssignSlots, normalizeImportRow, parseImportCsv, toImportCsv } from "./client-import.ts";

test("each row gets a free profile of its service, never twice the same", () => {
  const netflix = { id: "acc-n", service_name: "Netflix" };
  const slots = [
    { id: "n1", slot_number: 1, label: null, account: netflix },
    { id: "n2", slot_number: 2, label: "Salon", account: netflix },
    { id: "s1", slot_number: 1, label: null, account: { id: "acc-s", service_name: "Spotify" } },
  ];
  const rows = [
    { first_name: "A", service: "netflix", profile: "Salon" },
    { first_name: "B", service: "Netflix" },
    { first_name: "C", service: "Netflix" },
    { first_name: "D" },
    { first_name: "E", service: "Spotify", profile: "Profil 9" },
  ];
  assert.deepEqual(autoAssignSlots(rows, slots), ["n2", "n1", null, null, "s1"]);
});

test("a CSV with only some columns is accepted", () => {
  const rows = parseImportCsv("prénom;téléphone\nJean;699 00 00 00\nAïcha;");
  assert.deepEqual(rows, [{ first_name: "Jean", phone: "699000000" }, { first_name: "Aïcha" }]);
});

test("empty lines and rows without any identity are skipped", () => {
  const rows = parseImportCsv("first_name,service\n,Netflix\nPaul,Netflix\n\n");
  assert.deepEqual(rows, [{ first_name: "Paul", service: "Netflix" }]);
});

test("a CSV without any known column is rejected", () => {
  assert.throws(() => parseImportCsv("foo;bar\n1;2"), /Aucune colonne reconnue/);
});

test("fields are normalised to the platform format", () => {
  assert.deepEqual(
    normalizeImportRow({ start_date: "4/8/2026", price: "3 000 FCFA", duration_months: "3 mois", phone: "+237 699-00-00-00", email: " Jean@Mail.COM ", pin_code: "" }),
    { start_date: "2026-08-04", price: "3000", duration_months: "3", phone: "+237699000000", email: "jean@mail.com" }
  );
  assert.deepEqual(normalizeImportRow({ price: "abc", duration_months: "40" }), {});
});

test("the generated CSV round-trips through the importer", () => {
  const rows = [{ first_name: "Jean", last_name: "Kamga; fils", phone: "699000000" }, { first_name: "Paul", service: "Netflix", price: "3000" }];
  const csv = toImportCsv(rows);
  assert.ok(csv.startsWith("first_name;last_name;phone;email;service;profile;start_date;duration_months;price;payment_rail;pin_code"));
  assert.deepEqual(parseImportCsv(csv), rows);
});
