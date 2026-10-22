import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import type { CommissionMeeting } from "../../../types";
import { agendaDocumentHtml } from "../components/AgendaModal";
import { SessionsPage } from "../pages/ReferencePages";
import { casesEligibleForMeeting } from "../useObjectionsModel";
import {
  excludeCasesFromMeetingState,
  meetingAgendaCaseIds,
  refreshMeetingAgenda,
} from "../services/meetingAgenda";

function fixture(signed = true) {
  const state = initialState();
  const [excluded, remaining] = state.cases;
  state.cases = [excluded, remaining];
  excluded.status = signed ? "commission_voting" : "documents_review";
  remaining.status = "commission_voting";
  excluded.attendanceMeetingDate = "2026-09-10";
  const meeting: CommissionMeeting = {
    id: "meeting-1",
    number: 1,
    dateTime: "2026-09-10T10:00:00",
    caseIds: [excluded.id, remaining.id],
    pollId: "poll-1",
    agendaHtml: agendaDocumentHtml([excluded, remaining], "2026-09-10"),
    agendaSigned: signed,
    statusBeforeAgenda: signed ? { [excluded.id]: "documents_review" } : {},
    created: state.date,
  };
  state.meetings = [meeting];
  state.attendancePolls = [
    {
      id: "poll-1",
      dateTime: meeting.dateTime,
      caseIds: [...meeting.caseIds],
      sentAt: state.date,
      responses: { "commission-member": "yes" },
    },
  ];
  return { state, meeting, excluded, remaining };
}

test("исключённое обращение сохраняется в повестке и возвращается в статус до подписания", () => {
  const { state, meeting, excluded, remaining } = fixture();
  const originalHtml = meeting.agendaHtml;
  const point = excluded.issues[0];
  excluded.votes = {
    [point.id]: {
      yes: 1,
      no: 0,
      approved: true,
      chair: "commission-member",
      present: 1,
      eligible: 1,
      votes: { "commission-member": "accept" },
    },
  };
  point.final = "accept";

  assert.equal(
    excludeCasesFromMeetingState(state, meeting.id, [excluded.id]),
    1,
  );
  assert.deepEqual(meeting.caseIds, [remaining.id]);
  assert.deepEqual(state.attendancePolls[0].caseIds, [remaining.id]);
  assert.deepEqual(meetingAgendaCaseIds(meeting), [excluded.id, remaining.id]);
  assert.equal(meeting.agendaHtml, originalHtml);
  assert.equal(meeting.inactiveCases?.[0].reason, "excluded");
  assert.equal(excluded.status, "documents_review");
  assert.equal(excluded.votes, null);
  assert.equal(point.final, undefined);
  assert.equal(excluded.attendanceMeetingDate, undefined);
  assert.deepEqual(excluded.excludedFromMeetingIds, [meeting.id]);
  assert.equal(
    excludeCasesFromMeetingState(state, meeting.id, [excluded.id]),
    0,
  );

  const nextMeeting: CommissionMeeting = {
    ...meeting,
    id: "meeting-2",
    number: 2,
    dateTime: "2026-09-12T10:00:00",
    caseIds: [],
    pollId: "poll-2",
    agendaSigned: false,
    agendaCaseIds: undefined,
    inactiveCases: undefined,
  };
  state.meetings!.push(nextMeeting);
  assert.deepEqual(
    casesEligibleForMeeting(state, nextMeeting.dateTime).map((item) => item.id),
    [excluded.id],
  );

  // Последующие изменения состава не стирают историческую строку повестки.
  const newlyAdded = { ...remaining, id: "CASE-NEW" };
  state.cases.push(newlyAdded);
  meeting.caseIds.push(newlyAdded.id);
  refreshMeetingAgenda(meeting, state.cases);
  assert.deepEqual(meetingAgendaCaseIds(meeting), [
    excluded.id,
    remaining.id,
    newlyAdded.id,
  ]);
  assert.match(meeting.agendaHtml, new RegExp(excluded.appealNumber));
});

test("исключение до подписания также оставляет запись в повестке", () => {
  const { state, meeting, excluded } = fixture(false);
  assert.equal(
    excludeCasesFromMeetingState(state, meeting.id, [excluded.id]),
    1,
  );
  assert.equal(excluded.status, "documents_review");
  assert.ok(meeting.agendaHtml.includes(excluded.appealNumber));
  assert.deepEqual(meetingAgendaCaseIds(meeting)[0], excluded.id);
});

test("директор видит исключённое обращение в повестке как неактивное", () => {
  const { state, meeting, excluded } = fixture();
  excludeCasesFromMeetingState(state, meeting.id, [excluded.id]);
  const props = {
    cases: state.cases,
    meetings: state.meetings,
    attendancePolls: state.attendancePolls,
    commissionMembers: [{ id: "commission-member", name: "Член АК" }],
    activeCommissionMemberId: "commission-member",
    role: "director" as const,
    date: state.date,
    initialMeetingId: meeting.id,
    onOpen() {},
    onCreateMeeting() {},
    onUpdateAttendanceResponse() {},
    onAddCase() {},
    onExcludeCases() {},
    onTransferCases() {},
    onMoveCase() {},
    onPreviewAgenda() {},
    onSignAgenda() {},
    onCompleteMeeting() {},
  };
  const html = renderToStaticMarkup(createElement(SessionsPage, props));
  assert.match(html, /agenda-item-excluded/);
  assert.match(html, /Исключено из заседания/);
  const commissionHtml = renderToStaticMarkup(
    createElement(SessionsPage, { ...props, role: "commission" }),
  );
  assert.doesNotMatch(commissionHtml, /agenda-item-excluded/);
});
