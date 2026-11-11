import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState } from '../../../api/objectionsRepository';
import { DocumentContent } from '../components/DocumentModal';
import { auditAuthorityKazakhName } from '../../../utils/auditAuthority';

test('казахская справка жалобы на уведомление содержит требуемый абзац и полное наименование департамента', () => {
 const c=initialState().cases[0]; c.appealType='Жалоба на уведомление'; c.appealLanguage='kk'; c.org='Исходное'; c.orgTranslations={kk:c.org}; c.issuer='ДВГА по г. Алматы'; c.document.date='2026-09-07'; c.document.number='5-У'; c.appealDate='2026-09-08'; c.appealNumber='5-Ж'; c.documentApplicantNames={certificate:{kk:'Ұйымның'}};
 const html=renderToStaticMarkup(createElement(DocumentContent,{c,kind:'certificate',languages:['kk'],language:'kk'}));
 assert.ok(html.includes(`Қазақстан Республикасы Қаржы министрлігіне ${auditAuthorityKazakhName(c.issuer)} жүргізген 2026 жылғы 07 қыркүйектегі № 5-У бұзушылықтарды жою туралы хабарламаға 2026 жылғы 08 қыркүйектегі № 5-Ж Ұйымның шағымы келіп түсті.`));
 assert.match(html,/жұмыс органы \(ІМАЖАД\)/);
 assert.match(html,/Жұмыс органының \(ІМАЖАД\) дәлелдері:/);
});

test('казахская справка по возражению на уведомление формирует абзац по новому шаблону', () => {
 const c=initialState().cases[0]; c.appealType='Возражение на уведомление'; c.appealLanguage='ru'; c.org='Русское название'; c.orgTranslations={kk:'Атауы'}; c.issuer='ДВГА по г. Алматы'; c.applicantIdentifierType='ИИН'; c.bin='001002003004'; c.document.date='2026-09-07'; c.document.number='5-У'; c.appealDate='2026-09-08'; c.appealNumber='5-В'; c.documentApplicantNames={certificate:{kk:'Ұйымның'}};
 const html=renderToStaticMarkup(createElement(DocumentContent,{c,kind:'certificate',languages:['kk'],language:'kk'}));
 assert.ok(html.includes(`Қазақстан Республикасының Қаржы министрлігіне Ұйымның, ЖСН 001002003004, ${auditAuthorityKazakhName(c.issuer)} камералдық бақылау нәтижелері бойынша жолдаған 2026 жылғы 07 қыркүйектегі № 5-У бұзушылықтарды жою туралы хабарламаға 2026 жылғы 08 қыркүйектегі № 5-В қарсылық келіп түсті.`));
});
