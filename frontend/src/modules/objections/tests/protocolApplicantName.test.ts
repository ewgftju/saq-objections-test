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
