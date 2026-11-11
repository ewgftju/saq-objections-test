import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { DocumentContent } from "../components/DocumentModal";

test("казахский запрос использует шаблон соответствующего вида жалобы", () => {
  const c = initialState().cases[0];
  c.appealLanguage = "ru"; c.org = "Русский"; c.documentApplicantNames = { request: { kk: "Ұйымның" } };
  c.applicantIdentifierType = "ИИН"; c.bin = "001002003004"; c.issuer = "КВГА";
  c.document.date = "2026-09-07"; c.document.number = "1-П"; c.appealDate = "2026-09-08"; c.appealNumber = "5-Ж";
  const render = () => renderToStaticMarkup(createElement(DocumentContent, { c, kind: "request", requestPreview: { recipient: "КВГА", deadline: "2026-09-10T18:00", template: "dvga" } }));
  c.appealType = "Жалоба на уведомление";
  assert.match(render(), /Ұйымның, ЖСН 001002003004.*жүргізген 2026 жылғы 07 қыркүйектегі № 1-П бұзушылықтарды жою туралы хабарламаға/);
  c.appealType = "Жалоба на решение КВГА/ДВГА";
  for (const [kind, phrase] of [["prescription-audit", "аудиторлық есеп бойынша"], ["prescription-preventive", "жіберген профилактикалық бақылау"], ["preventive-control-act", "профилактикалық бақылау нәтижесі туралы актіге"], ["quality-control", "сапаны бақылау нәтижелері бойынша шешімге"], ["administrative-act", "әкімшілік актіге"]] as const) {
    c.agendaDetails = { ...c.agendaDetails, decisionKind: kind };
    const html = render();
    assert.ok(html.includes(phrase));
    assert.match(html, /Ұйымның, ЖСН 001002003004/);
    assert.match(html, /2026 жылғы 08 қыркүйектегі № 5-Ж/);
    assert.match(html, /2026 жылғы 10 қыркүйекке дейінгі мерзімде/);
    assert.doesNotMatch(html, /В связи с поступлением/);
  }
});

test("запрос по возражению на аудиторский отчет формируется на казахском", () => {
  const c = initialState().cases[0];
  c.appealType = "Возражение на аудиторский отчет"; c.appealLanguage = "ru";
  c.documentApplicantNames = { request: { kk: "Ұйымның" } }; c.applicantIdentifierType = "БИН"; c.bin = "001002003004"; c.issuer = "КВГА";
  c.document.date = "2026-09-07"; c.document.number = "1-АО"; c.appealDate = "2026-09-08"; c.appealNumber = "5-В";
  const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "request", requestPreview: { recipient: "КВГА", deadline: "2026-09-10T18:00", template: "dvga" } }));
  assert.match(html, /Ұйымның, БСН 001002003004/);
  assert.match(html, /комитеті жүргізген 2026 жылғы 07 қыркүйектегі № 1-АО аудиторлық есебіне 2026 жылғы 08 қыркүйектегі № 5-В/);
  assert.match(html, /2026 жылғы 10 қыркүйекке дейінгі мерзімде қарсылықтың дәлелдері/);
  assert.doesNotMatch(html, /В связи с поступлением/);
});

test("первые абзацы справки и протокола используют реквизиты соответствующего документа", () => {
  const c = initialState().cases[0]; c.appealLanguage = "ru"; c.issuer = "КВГА"; c.bin = "001002003004";
  c.org = "Организация"; c.orgTranslations = { kk: "Ұйым" }; c.documentApplicantNames = { certificate: { kk: "Ұйымның" }, protocol: { kk: "Ұйымның" } };
  c.document.date = "2026-09-07"; c.document.number = "1-Д"; c.appealDate = "2026-09-08"; c.appealNumber = "5-Ж";
  for (const [type, kind, phrase, noun] of [
    ["Возражение на аудиторский отчет", "", "аудиторлық есебіне", "қарсылық"],
    ["Жалоба на решение КВГА/ДВГА", "prescription-audit", "аудиторлық есеп бойынша", "шағым"],
    ["Жалоба на решение КВГА/ДВГА", "prescription-preventive", "профилактикалық бақылау нәтижелері", "шағым"],
    ["Жалоба на решение КВГА/ДВГА", "preventive-control-act", "нәтижесі туралы актіге", "шағым"],
    ["Жалоба на решение КВГА/ДВГА", "quality-control", "сапаны бақылау нәтижелері бойынша шешімге", "шағым"],
    ["Жалоба на решение КВГА/ДВГА", "administrative-act", "әкімшілік актіге", "шағым"],
  ] as const) {
    c.appealType = type; c.agendaDetails = { ...c.agendaDetails, decisionKind: kind || undefined };
    for (const documentKind of ["certificate", "protocol"]) {
      const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind: documentKind, language: "kk", languages: ["kk"] }));
      assert.ok(html.includes(phrase)); assert.ok(html.includes("Ұйымның, БСН 001002003004"));
      assert.ok(html.includes("2026 жылғы 07 қыркүйектегі № 1-Д")); assert.ok(html.includes("2026 жылғы 08 қыркүйектегі № 5-Ж"));
      assert.ok(html.includes(documentKind === "certificate" ? `${noun} келіп түсті.` : `${noun === "шағым" ? "шағымы" : "қарсылығы"}.`));
    }
  }
});
