import { seed } from "../../data/objections";
import { useEffect, useState } from "react";
import {
  createDemoRepository,
  initialState,
} from "../../api/objectionsRepository";
import type {
  Action,
  CaseStatus,
  DemoState,
  ObjectionCase,
  Role,
  Route,
} from "../../types";
import { agendaDocumentHtml } from "./components/AgendaModal";
import { applyAction } from "./services/workflow";
import { pathForRoute, routeFromPath } from "./routing";

const COMPLETED_MEETING_STATUSES: CaseStatus[] = [
  "hearing",
  "hearing_ready",
  "meeting",
  "protocol",
  "decision_project",
  "decision_project_approval",
  "decision_project_signed",
  "decision_project_eotinish",
  "decision_project_hearing",
  "decided",
  "final_response_approval",
  "final_response_signed",
  "delivered",
  "completed",
];

function meetingDate(meeting: { dateTime: string }) {
  return meeting.dateTime.slice(0, 10);
}

function isMeetingCompleted(caseItem: ObjectionCase) {
  return COMPLETED_MEETING_STATUSES.includes(caseItem.status);
}

function rescheduleSource(caseItem: ObjectionCase, state: DemoState) {
  const meetings = state.meetings || [];
  const excluded = new Set(caseItem.excludedFromMeetingIds || []);
  return meetings
    .filter(
      (meeting) =>
        excluded.has(meeting.id) ||
        (meeting.caseIds.includes(caseItem.id) &&
          meetingDate(meeting) < state.date &&
          !isMeetingCompleted(caseItem)),
    )
    .sort((left, right) => right.dateTime.localeCompare(left.dateTime))[0];
}

function nextMeetingForCase(state: DemoState, caseItem: ObjectionCase) {
  const meetings = state.meetings || [];
  const source = rescheduleSource(caseItem, state);
  const excluded = new Set(caseItem.excludedFromMeetingIds || []);
  const sourceDate = source ? meetingDate(source) : "";
  const alreadyScheduled = meetings.some(
    (meeting) =>
      meeting.caseIds.includes(caseItem.id) &&
      !excluded.has(meeting.id) &&
      (sourceDate ? meetingDate(meeting) > sourceDate : true),
  );
  if (alreadyScheduled) return undefined;

  if (!source) {
    if (caseItem.status !== "certificate_approved") return undefined;
    const readyEvent = [...caseItem.history]
      .reverse()
      .find((event) => event.title === "Справка подписана");
    if (!readyEvent) return undefined;
    return meetings
      .filter(
        (meeting) =>
          !meeting.agendaSigned &&
          meetingDate(meeting) > readyEvent.date &&
          meetingDate(meeting) > state.date,
      )
      .sort((left, right) => left.dateTime.localeCompare(right.dateTime))[0];
  }

  return meetings
    .filter(
      (meeting) =>
        !meeting.agendaSigned &&
        !excluded.has(meeting.id) &&
        meetingDate(meeting) > sourceDate &&
        meetingDate(meeting) > state.date,
    )
    .sort((left, right) => left.dateTime.localeCompare(right.dateTime))[0];
}

/** Обращения, которые должны быть включены именно в это новое заседание. */
export function casesEligibleForMeeting(state: DemoState, dateTime: string) {
  const meeting = (state.meetings || []).find(
    (item) => item.dateTime === dateTime && !item.agendaSigned,
  );
  if (!meeting) return [];
  return state.cases.filter(
    (caseItem) => nextMeetingForCase(state, caseItem)?.id === meeting.id,
  );
}

function synchronizeUpcomingMeetingCases(state: DemoState) {
  if (!state.meetings?.length) return state;
  const next = structuredClone(state);
  const changedMeetings = new Set<string>();

  next.cases.forEach((caseItem: ObjectionCase) => {
    const meeting = nextMeetingForCase(next, caseItem);
    if (!meeting) return;

    meeting.caseIds.push(caseItem.id);
    const poll = next.attendancePolls.find((item) => item.id === meeting.pollId);
    if (poll && !poll.caseIds.includes(caseItem.id)) poll.caseIds.push(caseItem.id);
    caseItem.attendanceMeetingDate = meeting.dateTime.slice(0, 10);
    const source = rescheduleSource(caseItem, next);
    caseItem.history.push({
      date: next.date,
      actor: "Система",
      title: source
        ? "Обращение перенесено в следующее заседание"
        : "Обращение добавлено в ближайшее заседание",
      text:
        (source ? "После заседания №" + source.number + ". " : "") +
        "Заседание №" + meeting.number + ": " + meeting.dateTime + ".",
    });
    changedMeetings.add(meeting.id);
  });

  changedMeetings.forEach((meetingId) => {
    const meeting = next.meetings!.find((item) => item.id === meetingId)!;
    const meetingCases = meeting.caseIds
      .map((caseId) => next.cases.find((item) => item.id === caseId))
      .filter((item): item is ObjectionCase => Boolean(item));
    meeting.agendaHtml = agendaDocumentHtml(
      meetingCases,
      meeting.dateTime.slice(0, 10),
    );
  });

  return changedMeetings.size ? next : state;
}

export function useObjectionsModel() {
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [role, setRole] = useState<Role>("work");
  const [route, setRoute] = useState<Route>(() =>
    routeFromPath(window.location.pathname),
  );
  const [loaded] = useState(() => {
    try {
      return { state: createDemoRepository(localStorage).load(), error: "" };
    } catch {
      return {
        state: initialState(),
        error:
          "Не удалось прочитать сохранённые данные. Показаны исходные тестовые обращения. Изменения будут сохранены при следующем действии, если браузер разрешает хранение.",
      };
    }
  });
  const [state, setState] = useState(() => {
    loaded.state = { ...loaded.state, cases: loaded.state.cases.map(c => ["ВОЗ-2026-001", "ВОЗ-2026-002", "ЖАЛ-2026-003"].includes(c.id) ? { ...c, org:c.org.replace(" — Демо", ""), applicant:c.applicant.replace(" (демо)", ""), address:c.address.replace(", демонстрационный адрес", "") } : c) };
    if (loaded.state.cases.some(c => c.id === "ВОЗ-2026-004")) return loaded.state;
    const prepared = { ...seed().find(c => c.id === "ВОЗ-2026-002")!, id: "ВОЗ-2026-004" };
    return { ...loaded.state, cases: [prepared, ...loaded.state.cases] };
  });
  useEffect(() => {
    const handler = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function navigate(next: Route) {
    window.history.pushState(null, "", pathForRoute(next));
    setRoute(next);
  }
  function commit(next: DemoState, message: string) {
    const synchronized = synchronizeUpcomingMeetingCases(next);
    createDemoRepository(localStorage).save(synchronized);
    setState(synchronized);
    setError("");
    setToast(message);
  }
  function perform(caseId: string, action: Action, form: FormData) {
    commit(
      applyAction(state, caseId, action, role, form),
      "Действие сохранено",
    );
  }
  return {
    state,
    role,
    setRole,
    route,
    navigate,
    perform,
    commit,
    error: error || loaded.error,
    setError,
    toast,
    setToast,
  };
}
