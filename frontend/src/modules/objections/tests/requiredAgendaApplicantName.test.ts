import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from '../../../api/objectionsRepository';
import { actionForm } from '../formDefinitions';
import { applyAction } from '../services/workflow';
import { agendaItemText } from '../components/AgendaModal';

test('русское наименование для повестки обязательно и для казахской справки', () => {
 let state = initialState(); const c = state.cases[0]; c.status = 'materials'; c.appealLanguage = 'kk'; c.org = 'Қазақша атауы'; c.orgTranslations = { kk: c.org };
 c.issues = [{ ...c.issues.find(p => p.disputed)!, id: 'p1', title: 'Тармақ', argument: 'Дәлел' }];
 const field = actionForm('analysis', c, state.date, {documentLanguageMode:'kk'}).fields.find(f => f.name === 'documentApplicantName_ru');
 assert.ok(field?.required); assert.equal(field?.language, undefined); assert.equal(field?.value, '');
 const form = new FormData(); form.set('documentLanguageMode','kk'); form.set('davgaArgumentsKk_p1','Дәлел'); form.set('documentApplicantName_ru','');
 assert.throws(() => applyAction(state,c.id,'analysis','work',form), /наименовани.*повестки/i);
 form.set('documentApplicantName_ru','Организации'); state=applyAction(state,c.id,'analysis','work',form);
 const saved=state.cases.find(x => x.id===c.id)!; assert.equal(saved.org,'Қазақша атауы'); assert.equal(saved.documentApplicantNames?.certificate?.ru,'Организации'); assert.match(agendaItemText(saved),/Организации/);
});
