import assert from "node:assert/strict";
import test from "node:test";
import { documentLabel } from "../services/documentLabels";
import { displayProtocolReason, protocolDavgaFromReason, replaceProtocolDavga } from "../services/protocolReason";

test("казахское сокращение и ранее сохранённые доводы", () => {
  const old = "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: Бұрынғы мәтін";
  const updated = "Жұмыс органының (ҚР ҚМ ІМАЖАД) дәлелдері: Бұрынғы мәтін";
  assert.equal(documentLabel("ДАВГА", "kk"), "ІМАЖАД");
  assert.equal(documentLabel("ДАВГА", "ru"), "ДАВГА");
  assert.equal(displayProtocolReason(old, "kk"), updated);
  assert.equal(displayProtocolReason(old, "ru"), old);
  assert.equal(protocolDavgaFromReason(old), "Бұрынғы мәтін");
  assert.equal(protocolDavgaFromReason(updated), "Бұрынғы мәтін");
  assert.equal(replaceProtocolDavga(old, "Жаңа мәтін"), "Жұмыс органының (ҚР ҚМ ІМАЖАД) дәлелдері: Жаңа мәтін");
});
