import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from '../../../api/objectionsRepository';
import { actionForm } from '../formDefinitions';

test('в казахской версии справки наименования заявителя стоят рядом перед описаниями', () => {
 const c=initialState().cases[0]; c.appealLanguage='ru'; c.orgTranslations={ru:c.org};
 for (const mode of ['kk','both']) {
  const fields=actionForm('analysis',c,'2026-09-08',{documentLanguageMode:mode}).fields.filter(f=>f.language==='kk');
  assert.equal(fields[0].name,'applicantName_kk'); assert.equal(fields[1].name,'documentApplicantName_kk');
  assert.ok(fields.findIndex(f=>f.name.startsWith('pointTitle_'))>1);
  assert.equal(fields[0].required,true); assert.equal(fields[1].required,false);
 }
});

test('если исходное казахское наименование известно, форма документа остаётся перед описаниями', () => {
 const c=initialState().cases[0]; c.appealLanguage='kk'; c.orgTranslations={kk:'Ұйым'};
 const fields=actionForm('analysis',c,'2026-09-08',{documentLanguageMode:'kk'}).fields.filter(f=>f.language==='kk');
 assert.equal(fields[0].name,'applicantName_kk'); assert.equal(fields[0].value,'Ұйым'); assert.equal(fields[1].name,'documentApplicantName_kk'); assert.ok(fields.findIndex(f=>f.name.startsWith('pointTitle_'))>1);
});

test('поля каждого пункта справки сгруппированы отдельно', async () => {
 const { createElement }=await import('react'); const { renderToStaticMarkup }=await import('react-dom/server'); const { LanguageFields }=await import('../components/ActionModal');
 const c=initialState().cases[0]; c.appealLanguage='ru'; c.orgTranslations={ru:c.org};
 c.issues=[5,10].map(n=>({id:`p${n}`,number:String(n),title:`Вопрос ${n}`,argument:`Довод ${n}`,finding:'',disputed:true,amount:0}));
 const fields=actionForm('analysis',c,'2026-09-08',{documentLanguageMode:'kk'}).fields;
 const html=renderToStaticMarkup(createElement(LanguageFields,{fields,primary:'kk',values:{},certificatePoints:c.issues}));
 const first=html.split('aria-label="Пункт № 5"')[1].split('</section>')[0];
 const second=html.split('aria-label="Пункт № 10"')[1].split('</section>')[0];
 for(const [section,n] of [[first,5],[second,10]] as const){assert.match(section,new RegExp(`Описание оспариваемого вопроса № ${n}`));assert.match(section,new RegExp(`Перевод доводов заявителя по пункту № ${n}`));assert.match(section,new RegExp(`Доводы ДАВГА по пункту № ${n}`));}
 assert.ok(html.indexOf('Наименование заявителя в тексте документа — Қазақша')<html.indexOf('aria-label="Пункт № 5"'));
});
