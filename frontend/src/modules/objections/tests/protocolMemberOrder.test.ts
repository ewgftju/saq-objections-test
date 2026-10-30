import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { COMMISSION_ATTENDANCE_MEMBERS } from "../../../data/objections";
import { DocumentContent } from "../components/DocumentModal";

function attendance(absent: string[] = []) {
  const c = initialState().cases[0];
  c.members = COMMISSION_ATTENDANCE_MEMBERS.map((member) => ({ ...member, present: !absent.includes(member.id), recused: false, reason: "" })).reverse();
  c.meeting = { date: "2026-10-30", number: "1", audio: "", signed: "2026-10-30" };
  const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "protocol" }));
  return html.split("Члены Апелляционной комиссии:</b>")[1].split("Секретарь Апелляционной комиссии:")[0];
}

test("члены АК перечислены по должностям, председательствующий исключён", () => {
  const html = attendance();
  const positions = ["Директор ДАВГА Күреңбек", "Заместитель Председателя КВГА Ахметов", "Директор ДМБУА Алиева", "Заместитель директора ДЮС Абетова", "Руководитель управления ДМБУА Урхумбаева", "Представитель НПО"];
  for (const item of positions) assert.ok(html.includes(item), item);
  for (let i = 1; i < positions.length; i++) assert.ok(html.indexOf(positions[i - 1]) < html.indexOf(positions[i]));
  assert.doesNotMatch(html, /Вице-министр/);
});

test("директор ДАВГА не повторяется среди членов, когда председательствует", () => {
  const html = attendance(["kenbeil-dm"]);
  assert.doesNotMatch(html, /Директор ДАВГА Күреңбек/);
  assert.ok(html.indexOf("Заместитель Председателя КВГА Ахметов") < html.indexOf("Директор ДМБУА Алиева"));
});

test("справка показывает председательствующего первым и сохраняет привязку голосов", () => {
  const c = initialState().cases[0];
  const point = c.issues.find((item) => item.disputed)!;
  c.issues = [point];
  c.members = COMMISSION_ATTENDANCE_MEMBERS.map((member) => ({ ...member, present: true, recused: false, reason: "" })).reverse();
  c.certificate = { davgaArguments: "Доводы", memberPositions: c.members.map((member) => ({ id: member.id, name: member.name, pointId: point.id, result: "accept", comment: `комментарий-${member.id}` })) };
  const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "certificate" }));
  const table = html.split('<table class="certificate-members-table certificate-point-votes-table">')[1].split('</table>')[0];
  const names = ["Вице-министр Кеңбеил", "Директор ДАВГА Күреңбек", "Заместитель Председателя КВГА Ахметов", "Директор ДМБУА Алиева", "Заместитель директора ДЮС Абетова", "Руководитель управления ДМБУА Урхумбаева", "Представитель НПО"];
  for (const name of names) assert.ok(table.includes(name), name);
  for (let i = 1; i < names.length; i++) assert.ok(table.indexOf(names[i - 1]) < table.indexOf(names[i]));
  const comments = ["kenbeil-dm", "kurenbek-shb", "akhmetov-rk", "alieva-at", "abetova-ku", "urkhumbayeva-tzh", "umertayev-bk"];
  for (let i = 1; i < comments.length; i++) assert.ok(table.indexOf(`комментарий-${comments[i - 1]}`) < table.indexOf(`комментарий-${comments[i]}`));
  c.members.find((member) => member.id === "kenbeil-dm")!.present = false;
  const noChair = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "certificate" }));
  const headers = noChair.split('<table class="certificate-members-table certificate-point-votes-table">')[1].split('</thead>')[0];
  assert.ok(headers.indexOf("Директор ДАВГА Күреңбек") < headers.indexOf("Заместитель Председателя КВГА Ахметов"));
});
