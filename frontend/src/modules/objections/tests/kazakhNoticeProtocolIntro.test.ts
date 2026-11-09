import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState } from '../../../api/objectionsRepository';
import { DocumentContent } from '../components/DocumentModal';
import { auditAuthorityKazakhName } from '../../../utils/auditAuthority';

const months=['қаңтардағы','ақпандағы','наурыздағы','сәуірдегі','мамырдағы','маусымдағы','шілдедегі','тамыздағы','қыркүйектегі','қазандағы','қарашадағы','желтоқсандағы'];
test('казахский протокол жалобы на уведомление использует указанный шаблон и все месяцы', () => {
 const c=initialState().cases[0]; c.appealType='Жалоба на уведомление'; c.appealLanguage='kk'; c.org='Номинатив'; c.orgTranslations={kk:'Номинатив'}; c.issuer='ДВГА по г. Алматы'; c.document.number='5-У'; c.appealNumber='5-Ж'; c.documentApplicantNames={certificate:{kk:'Заявителінің'}};
 for (let i=0; i<12; i++) {const month=String(i+1).padStart(2,'0');c.document.date=`2025-${month}-07`;c.appealDate=`2026-${month}-08`;
 const html=renderToStaticMarkup(createElement(DocumentContent,{c,kind:'protocol',languages:['kk'],language:'kk'}));
 const expected=`${auditAuthorityKazakhName(c.issuer)} жүргізген 2025 жылғы 07 ${months[i]} № 5-У бұзушылықтарды жою туралы хабарламаға 2026 жылғы 08 ${months[i]} № 5-Ж Заявителінің шағымы.`;
 assert.ok(html.includes(expected),months[i]);
 }
});
