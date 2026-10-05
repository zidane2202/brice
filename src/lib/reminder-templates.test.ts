import assert from "node:assert/strict";
import test from "node:test";
import {
  PRESET_TEMPLATES,
  REMINDER_CATEGORIES,
  reminderCategory,
  renderReminder,
  templatesFor,
  whatsappUrl,
} from "./reminder-templates.ts";

test("WhatsApp links normalize phone numbers", () => {
  assert.equal(whatsappUrl("+237 6 78 12 04 91", "Salut"), "https://wa.me/237678120491?text=Salut");
  assert.equal(whatsappUrl("678120491", "a b"), "https://wa.me/237678120491?text=a%20b");
  assert.equal(whatsappUrl("00237678120491", "x"), "https://wa.me/237678120491?text=x");
  assert.equal(whatsappUrl("", "x"), null);
  assert.equal(whatsappUrl(null, "x"), null);
});

const today = "2026-10-05";

test("subscriptions fall into the right category by days left", () => {
  assert.equal(reminderCategory({ status: "active", end_date: "2026-10-05" }, today), "today");
  assert.equal(reminderCategory({ status: "active", end_date: "2026-10-08" }, today), "soon3");
  assert.equal(reminderCategory({ status: "active", end_date: "2026-10-09" }, today), "soon7");
  assert.equal(reminderCategory({ status: "active", end_date: "2026-10-12" }, today), "soon7");
  assert.equal(reminderCategory({ status: "active", end_date: "2026-10-13" }, today), null);
  assert.equal(reminderCategory({ status: "active", end_date: "2026-10-04" }, today), "expired");
  assert.equal(reminderCategory({ status: "active", end_date: "2026-09-05" }, today), "expired");
  assert.equal(reminderCategory({ status: "active", end_date: "2026-09-04" }, today), "lapsed");
  assert.equal(reminderCategory({ status: "grace", end_date: "2026-09-01" }, today), "grace");
  assert.equal(reminderCategory({ status: "cancelled", end_date: "2026-10-05" }, today), null);
});

test("variables are filled and unknown ones are kept", () => {
  const text = renderReminder("Bonjour {prenom}, {service} expire le {date_fin} ({jours} j). {inconnu}", {
    prenom: "Aïcha",
    service: "Netflix",
    date_fin: "08/10/2026",
    jours: "3",
  });
  assert.equal(text, "Bonjour Aïcha, Netflix expire le 08/10/2026 (3 j). {inconnu}");
});

test("every category has at least two preset messages", () => {
  for (const category of REMINDER_CATEGORIES) {
    assert.ok(PRESET_TEMPLATES.filter((t) => t.category === category.id).length >= 2, category.id);
  }
});

test("custom templates for the category or for all come before presets", () => {
  const custom = [
    { id: "c1", category: "soon3", name: "Mon J-3", body: "x" },
    { id: "c2", category: "all", name: "Général", body: "y" },
    { id: "c3", category: "expired", name: "Autre", body: "z" },
  ];
  const list = templatesFor("soon3", custom);
  assert.deepEqual(list.slice(0, 2).map((t) => t.id), ["c1", "c2"]);
  assert.ok(list.every((t) => t.category === "soon3" || t.category === "all"));
  assert.ok(list.some((t) => t.id.startsWith("preset:")));
});
