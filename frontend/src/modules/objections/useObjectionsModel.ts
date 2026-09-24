import { seed } from "../../data/objections";
import { useEffect, useState } from "react";
import {
  createDemoRepository,
  initialState,
} from "../../api/objectionsRepository";
import type { Action, DemoState, ObjectionCase, Role, Route } from "../../types";
import { agendaDocumentHtml } from "./components/AgendaModal";
import { applyAction } from "./services/workflow";
import { pathForRoute, routeFromPath } from "./routing";

function synchronizeUpcomingMeetingCases(state: DemoState) {
  if (!state.meetings?.length) return state;
  const next = structuredClone(state);
  const changedMeetings = new Set<string>();

  next.cases.forEach((caseItem: ObjectionCase) => {
    if (caseItem.status !== "certificate_approved") return;
    if (next.meetings!.some((meeting) => meeting.caseIds.includes(caseItem.id)))
      return;

    const readyEvent = [...caseItem.history]
      .reverse()
      .find((event) => event.title === "Справка подписана");
    const readyDate = readyEvent?.date;
    if (!readyDate) return;

    const meeting = [...next.meetings!]
      .filter(
        (item) =>
          !item.agendaSigned &&
          item.dateTime.slice(0, 10) > readyDate &&
          item.dateTime.slice(0, 10) > next.date,
      )
      .sort((left, right) => left.dateTime.localeCompare(right.dateTime))[0];
    if (!meeting) return;

    meeting.caseIds.push(caseItem.id);
    const poll = next.attendancePolls.find((item) => item.id === meeting.pollId);
    if (poll && !poll.caseIds.includes(caseItem.id)) poll.caseIds.push(caseItem.id);
    caseItem.attendanceMeetingDate = meeting.dateTime.slice(0, 10);
    caseItem.history.push({
      date: next.date,
      actor: "Система",
      title: "Обращение добавлено в ближайшее заседание",
      text: "Заседание №" + meeting.number + ": " + meeting.dateTime + ".",
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
