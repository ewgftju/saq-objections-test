import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState } from '../../../api/objectionsRepository';
import { actionForm } from '../formDefinitions';
import { DocumentContent } from '../components/DocumentModal';

test('протокол предлагает форму наименования из справки для каждого языка', () => {
 const c=initialState().cases[0]; c.appealLanguage='ru'; c.org='Организация'; c.orgTranslations={ru:'Организация',kk:'Ұйым'};
 c.documentApplicantNames={certificate:{ru:'Организации',kk:'Ұйымның'}};
 const fields=actionForm('vote',c,'2026-09-08',{documentLanguageMode:'both'}).fields;
 assert.equal(fields.find(f=>f.name==='documentApplicantName_ru')?.value,'Организации');
 assert.equal(fields.find(f=>f.name==='documentApplicantName_kk')?.value,'Ұйымның');
 const html=renderToStaticMarkup(createElement(DocumentContent,{c,kind:'protocol',language:'ru',languages:['ru']}));
 assert.match(html, /class="protocol-template-intro"[^]*?Организации/); assert.match(html, /class="protocol-template-result"[^]*?Организации/); assert.equal(c.org,'Организация');
});

test('казахская форма наименования обязательна и располагается после названия заявителя', () => {
 const c=initialState().cases[0]; c.appealLanguage='ru'; c.org='Организация'; c.orgTranslations={ru:'Организация'};
 const fields=actionForm('vote',c,'2026-09-08',{documentLanguageMode:'kk'}).fields;
 const applicant=fields.findIndex(f=>f.name==='applicantName_kk'); const document=fields.findIndex(f=>f.name==='documentApplicantName_kk');
 assert.ok(applicant>=0); assert.equal(document,applicant+1); assert.equal(fields[document].required,true);
});

test('пустая казахская форма не позволяет сформировать казахский протокол', async () => {
 const { applyAction } = await import('../services/workflow');
 const state=initialState(); const c=state.cases[0]; c.status='meeting'; c.appealLanguage='ru'; c.orgTranslations={ru:'Организация',kk:'Ұйым'};
 const f=new FormData(); f.set('documentLanguageMode','kk'); f.set('documentApplicantName_kk','   ');
 assert.throws(()=>applyAction(state,c.id,'vote','work',f),/наименование заявителя в тексте документа — Қазақша/i);
});
