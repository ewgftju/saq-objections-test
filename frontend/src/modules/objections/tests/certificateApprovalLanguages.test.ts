import assert from "node:assert/strict";
import test from "node:test";
import { initialState } from "../../../api/objectionsRepository";
import { addDocument, applyAction } from "../services/workflow";

for (const decisions of [["accepted", "rejected"], ["rejected", "accepted"], ["accepted", "accepted"], ["rejected", "rejected"]] as const) {
  test(`язык новой версии следует принятым изменениям: ${decisions.join(", ")}`, () => {
    let state = initialState();
    const c = state.cases[0];
    c.status = "meeting";
    c.appealLanguage = "kk";
    const point = c.issues.find(item => item.disputed)!;
    c.issues = [point];
    c.documents = [];
    c.certificate = { languages: ["kk"], davgaArguments: "", davgaArgumentsByPoint: { [point.id]: "Исходные RU" }, davgaArgumentsByPointKk: { [point.id]: "Бастапқы KZ" }, memberPositions: [] };
    addDocument(c, "work", state.date, "Исходная справка", "certificate", "");
    c.certificateChangeRequests = [{ stage: "protocol", proposedAt: "2026-09-01T10:00:00Z", proposedBy: "Рабочий орган", status: "pending", changes: [
      { pointId: point.id, pointNumber: point.number, language: "ru", before: "Исходные RU", proposed: "Новые RU" },
      { pointId: point.id, pointNumber: point.number, language: "kk", before: "Бастапқы KZ", proposed: "Жаңа KZ" },
    ] }];
    const form = new FormData(); form.set(`decision_${point.id}`, decisions[0]); form.set(`decision_${point.id}_kk`, decisions[1]);
    state = applyAction(state, c.id, "review-certificate-change", "director", form);
    const saved = state.cases.find(item => item.id === c.id)!;
    const docs = saved.documents.filter(item => item.kind === "certificate");
    assert.deepEqual(docs[0].languages, ["kk"]);
    if (decisions.every(item => item === "rejected")) {
      assert.equal(docs.length, 1);
      assert.deepEqual(saved.certificate?.languages, ["kk"]);
    } else {
      const expected = (["ru", "kk"] as const).filter((_, index) => decisions[index] === "accepted");
      assert.equal(docs.length, 2);
      assert.deepEqual(docs[1].languages, expected);
      assert.deepEqual(docs[1].snapshot?.certificate?.languages, expected);
      assert.equal(saved.certificate?.davgaArgumentsByPoint?.[point.id], decisions[0] === "accepted" ? "Новые RU" : "Исходные RU");
      assert.equal(saved.certificate?.davgaArgumentsByPointKk?.[point.id], decisions[1] === "accepted" ? "Жаңа KZ" : "Бастапқы KZ");
    }
  });
}
