import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState } from '../../../api/objectionsRepository';
import { DocumentContent, kazakhDecisionIntro } from '../components/DocumentModal';

const months=['қаңтардағы','ақпандағы','наурыздағы','сәуірдегі','мамырдағы','маусымдағы','шілдедегі','тамыздағы','қыркүйектегі','қазандағы','қарашадағы','желтоқсандағы'];
test('в казахском тексте проекта решения и ответа дата обращения записана словами',()=>{
 const c=initialState().cases[0]; c.appealType='Жалоба на уведомление'; c.appealLanguage='ru'; c.appealNumber='25645';
 for(let i=0;i<12;i++){c.appealDate=`2026-${String(i+1).padStart(2,'0')}-08`;assert.ok(kazakhDecisionIntro(c).includes(`2026 жылғы 08 ${months[i]} 25645`));}
 c.appealDate='2026-09-08';
 for(const kind of ['decision-project','final-response']){const html=renderToStaticMarkup(createElement(DocumentContent,{c,kind}));assert.match(html,/2026 жылғы 08 қыркүйектегі 25645/);}
});
