import assert from "node:assert/strict";
import test from "node:test";
import { decryptCredential, encryptCredential } from "./provider-credentials.ts";

test("provider credentials are encrypted and decryptable", () => {
  process.env.PROVIDER_CREDENTIALS_KEY = "test-key-that-is-longer-than-thirty-two-characters";
  const encrypted = encryptCredential("secret-123");
  assert.ok(encrypted?.startsWith("enc:v1:"));
  assert.notEqual(encrypted, "secret-123");
  assert.equal(decryptCredential(encrypted), "secret-123");
});

test("provider credential encryption is non deterministic", () => {
  process.env.PROVIDER_CREDENTIALS_KEY = "test-key-that-is-longer-than-thirty-two-characters";
  assert.notEqual(encryptCredential("same"), encryptCredential("same"));
});
