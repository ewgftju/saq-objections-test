import { ROLES, STATUS } from "../../../data/constants";
import type {
  CommissionMeeting,
  DemoState,
  ObjectionCase,
} from "../../../types";
import { agendaDocumentHtml } from "../components/AgendaModal";

/** Исключение снимает обращение с заседания, но не удаляет его из повестки. */
export function meetingAgendaCaseIds(meeting: CommissionMeeting): string[] {
  if (!meeting.agendaCaseIds) return meeting.caseIds;
  const activeIds = [...meeting.caseIds];
  const excludedIds = new Set(
    (meeting.inactiveCases || [])
      .filter((entry) => entry.reason === "excluded")
      .map((entry) => entry.caseId)
      .filter((id) => !activeIds.includes(id)),
  );
  let activeIndex = 0;
  const result = meeting.agendaCaseIds.flatMap((id) => {
    if (excludedIds.has(id)) return [id];
    const next = activeIds[activeIndex++];
    return next ? [next] : [];
  });
  return [...result, ...activeIds.slice(activeIndex)];
}

export function refreshMeetingAgenda(
  meeting: CommissionMeeting,
  cases: ObjectionCase[],
) {
  const ids = meetingAgendaCaseIds(meeting);
  if (meeting.agendaCaseIds) meeting.agendaCaseIds = ids;
  meeting.agendaHtml = agendaDocumentHtml(
    ids
      .map((id) => cases.find((item) => item.id === id))
      .filter((item): item is ObjectionCase => Boolean(item)),
    meeting.dateTime.slice(0, 10),
  );
}

const votingStatuses = new Set<ObjectionCase["status"]>([
  "commission_voting",
  "circulated",
  "meeting_certificate_approval",
  "meeting_certificate_signed",
  "meeting_certificate_approved",
]);

export function excludeCasesFromMeetingState(
  state: DemoState,
  meetingId: string,
  caseIds: string[],
): number {
  const meeting = state.meetings?.find((item) => item.id === meetingId);
  const poll = meeting
    ? state.attendancePolls.find((item) => item.id === meeting.pollId)
    : undefined;
  if (!meeting || !poll || meeting.completed) return 0;
  const ids = new Set(
    caseIds.filter(
      (id) =>
        meeting.caseIds.includes(id) &&
        state.cases.some(
          (item) =>
            item.id === id &&
            (votingStatuses.has(item.status) ||
              item.status === "certificate_approved" ||
              item.status === "documents_review"),
        ),
    ),
  );
  if (!ids.size) return 0;

  // Сохраняем первоначальную повестку (включая печатную форму). Только
  // активный состав заседания и опрос меняются при исключении.
  meeting.agendaCaseIds ??= [...meeting.caseIds];
  meeting.caseIds = meeting.caseIds.filter((id) => !ids.has(id));
  poll.caseIds = poll.caseIds.filter((id) => !ids.has(id));
  ids.forEach((id) => {
    const target = state.cases.find((item) => item.id === id)!;
    meeting.inactiveCases = [
      ...(meeting.inactiveCases || []).filter((entry) => entry.caseId !== id),
      { caseId: id, reason: "excluded", removedAt: state.date },
    ];
    target.excludedFromMeetingIds = [
      ...new Set([...(target.excludedFromMeetingIds || []), meeting.id]),
    ];
    if (target.attendanceMeetingDate === meeting.dateTime.slice(0, 10)) {
      delete target.attendanceMeetingDate;
    }
    if (votingStatuses.has(target.status)) {
      target.status =
        meeting.statusBeforeAgenda?.[id] ||
        (Object.values(poll.responses).includes("yes")
          ? "documents_review"
          : "certificate_approved");
      // Результаты голосования снятого заседания не должны автоматически
      // учитываться при повторном рассмотрении в другом заседании.
      if (target.votes) {
        for (const point of target.issues) {
          if (target.votes[point.id]) delete point.final;
        }
        target.votes = null;
        if (target.certificate) target.certificate.memberPositions = [];
      }
    }
    target.history.push({
      date: state.date,
      actor: ROLES.director,
      title: "Обращение исключено из заседания",
      text: `Заседание №${meeting.number}. Возвращено в статус «${STATUS[target.status]}». Обращение осталось в повестке дня.`,
    });
  });
  return ids.size;
}
