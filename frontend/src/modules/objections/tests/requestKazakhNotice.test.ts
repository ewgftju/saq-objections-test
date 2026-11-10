import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { DocumentContent } from "../components/DocumentModal";

test("получатель запроса выводится на казахском в дательном падеже", () => {
  const c = initialState().cases[0];
  for (const [recipient, expected] of [
    ["ДВГА по Туркестанской области", "Түркістан облысы бойынша Ішкі мемлекеттік аудит департаментіне"],
    ["ДВГА по г. Алматы", "Алматы қаласы бойынша Ішкі мемлекеттік аудит департаментіне"],
    ["КВГА", "Қазақстан Республикасы Қаржы министрлігінің Ішкі мемлекеттік аудит комитетіне"],
  ]) {
    const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "request", requestPreview: { recipient, deadline: "2026-09-10T18:00", template: "dvga" } }));
    assert.ok(html.includes(expected));
  }
});

test("казахские срок, подпись и исполнитель выводятся в стандартных запросах по всем видам", () => {
  const c = initialState().cases[0];
  const requestPreview = { recipient: "ДВГА по г. Алматы", deadline: "2026-09-10T18:00", template: "dvga" as const };
  for (const type of ["Возражение на уведомления", "Возражение на аудиторский отчет", "Жалоба на уведомление", "Жалоба на решение КВГА/ДВГА", "Жалоба на действие/бездействие", "Заявление"] as const) {
    c.appealType = type;
    const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "request", requestPreview }));
    assert.match(html, /Сондай-ақ, Қазақстан Республикасы Премьер-Министрінің/);
    assert.match(html, /14-тармағына сәйкес, <b>осы тармақтың/);
    assert.match(html, /2 \(екі\) жұмыс күнінен кешіктірілмейтін мерзімде ұсынатынын ескертеміз/);
    assert.match(html, /Ішкі мемлекеттік аудит<br\/>бойынша апелляция<br\/>департаментінің директоры/);
    assert.match(html, /Орын\.:/);
    assert.doesNotMatch(html, /Также сообщаем, что в соответствии с пунктом 14/);
  }
});

test("возражение на уведомление: казахский первый абзац с данными и сроком по каждому месяцу", () => {
  const c = initialState().cases[0];
  c.appealType = "Возражение на уведомление"; c.appealLanguage = "ru";
  c.org = "Русское название"; c.documentApplicantNames = { request: { kk: "Ұйымның" } };
  c.applicantIdentifierType = "ИИН"; c.bin = "001002003004";
  c.document.date = "2026-08-25"; c.document.number = "6"; c.appealDate = "2026-08-25"; c.appealNumber = "5";
  const months = ["қаңтарға", "ақпанға", "наурызға", "сәуірге", "мамырға", "маусымға", "шілдеге", "тамызға", "қыркүйекке", "қазанға", "қарашаға", "желтоқсанға"];
  months.forEach((month, i) => {
    const deadline = `2026-${String(i + 1).padStart(2, "0")}-25T18:00`;
    const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "request", requestPreview: { recipient: "ДВГА по г. Алматы", deadline, template: "dvga" } }));
    assert.match(html, /Ұйымның, ЖСН 001002003004/);
    assert.match(html, /2026 жылғы 25 тамыздағы № 6 хабарламаға қатысты 2026 жылғы 25 тамыздағы № 5/);
    assert.ok(html.includes(`2026 жылғы 25 ${month} дейінгі мерзімде`));
    assert.doesNotMatch(html, /Русское название/);
  });
});
