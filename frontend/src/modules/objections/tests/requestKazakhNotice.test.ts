import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { DocumentContent } from "../components/DocumentModal";

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
