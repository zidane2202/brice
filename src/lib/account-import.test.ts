import assert from "node:assert/strict";
import test from "node:test";
import { accountPeriod, parseAccountCsv, prefillAccountRow, toAccountCsv } from "./account-import.ts";

test("known services get their official name and profile count, capped by the plan", () => {
  assert.deepEqual(prefillAccountRow({ service_name: "netflix" }, 10), { service_name: "Netflix", max_slots: "5" });
  assert.deepEqual(prefillAccountRow({ service_name: "netflix" }, 3), { service_name: "Netflix", max_slots: "3" });
  assert.deepEqual(prefillAccountRow({ service_name: "Netflix", max_slots: "4" }, 10), { service_name: "Netflix", max_slots: "4" });
  assert.deepEqual(prefillAccountRow({ service_name: "IPTV maison" }, 10), { service_name: "IPTV maison" });
});

test("reads an accounts CSV with French headers", () => {
  const rows = parseAccountCsv("Service;Email;Mot de passe;Profils;Échéance;Coût\nNetflix;Moi@Mail.com;secret;5;20/10/2026;6 500 FCFA\n;;;;;");
  assert.deepEqual(rows, [
    { service_name: "Netflix", account_email: "moi@mail.com", account_password: "secret", max_slots: "5", end_date: "2026-10-20", cost: "6500" },
  ]);
});

test("the due date wins, otherwise start plus duration", () => {
  assert.deepEqual(accountPeriod({ end_date: "2026-10-20" }, "2026-10-05"), { start_date: "2026-09-20", end_date: "2026-10-20", duration_months: 1 });
  assert.deepEqual(accountPeriod({ start_date: "2026-01-31", duration_months: "1" }, "2026-10-05"), { start_date: "2026-01-31", end_date: "2026-02-28", duration_months: 1 });
  assert.deepEqual(accountPeriod({ duration_months: "3" }, "2026-10-05"), { start_date: "2026-10-05", end_date: "2027-01-05", duration_months: 3 });
});

test("round-trips through the CSV export", () => {
  const rows = [{ service_name: "Spotify", label: "Famille", max_slots: "6" }];
  assert.deepEqual(parseAccountCsv(toAccountCsv(rows)), rows);
});
