import { installDigitalAuditCases } from "../data/digitalAuditCases";
import { installAuditPlusCases, installTestStatements, installKazakhTestStatements } from "../data/auditPlusCases";
import { restoreSkippedProtocolCertificate } from "../modules/objections/services/workflow";
import {
  COMMISSION_ATTENDANCE_MEMBERS,
  seed,
  sharedAuditObjection,
  sharedSaqStatementApplication,
} from "../data/objections";
import type { DemoState, Role } from "../types";
import { formatDate } from "../utils/dateFormat";
import { presidingChairId } from "../modules/objections/services/decisions";

/** The demo adapter is the only module that reads or writes case storage. */
export interface ObjectionsRepository {
  load(): DemoState;
  save(state: DemoState): void;
}

export const STORAGE_KEY = "saq.objections.demo.v1";
const CURRENT_VERSION = 21;
const REQUESTED_REMOVAL_IDS = new Set([
  "В-2026-002", "В-2026-007", "В-2026-008",
  "З-2026-010", "З-2026-011", "З-2026-012", "З-2026-013", "З-2026-014",
]);
const REMOVED_COMPLAINT_IDS = new Set(Array.from({ length: 7 }, (_, index) => `Ж-2026-${String(index + 6).padStart(3, "0")}`));
const RESTORED_COMPLAINT_IDS = new Map([["Ж-2026-004", "Ж-2026-001"], ["Ж-2026-005", "Ж-2026-002"]]);

/**
 * Карточки из старого демонстрационного набора больше не должны появляться
 * после обновления приложения или загрузки сохранённого состояния.
 */
const REMOVED_DEMO_CASE_IDS = new Set([
  "ВОЗ-2026-004",
  "ВОЗ-2026-001",
  "ВОЗ-2026-002",
  "ЖАЛ-2026-003",
]);
const RENAMED_DEMO_CASE_IDS = new Map([["В-2026-005", "В-2026-001"]]);

function migratedCaseId(id: string) {
  return RENAMED_DEMO_CASE_IDS.get(id) || id;
}

function removedInMigration(id: string, version: number) {
  return (version < 15 && REMOVED_COMPLAINT_IDS.has(id)) || (version < 16 && id === "З-2026-002") || (version < 20 && REQUESTED_REMOVAL_IDS.has(id)) || (version < 21 && id === "Ж-2026-002");
}

function normalizeCaseIds(ids: readonly string[] | undefined, version = CURRENT_VERSION, renumber = new Map<string, string>()) {
  return (ids || [])
    .filter((id) => !REMOVED_DEMO_CASE_IDS.has(id) && !removedInMigration(id, version))
    .map((id) => migratedCaseId(renumber.get(id) || id));
}

function isRemovedDemoCase(id: string) {
  return REMOVED_DEMO_CASE_IDS.has(id);
}

// Version 6 distinguishes incoming SAQ appeals from manually created appeals.

export function initialState(): DemoState {
  return {
    version: CURRENT_VERSION,
    date: "2026-09-08",
    cases: installKazakhTestStatements(installTestStatements(installAuditPlusCases(restoreRequestedComplaints(seed().filter(c => c.id !== "З-2026-002"))))).filter(c => !REQUESTED_REMOVAL_IDS.has(c.id) && c.id !== "Ж-2026-002"),
    agendas: [],
    notifications: [],
    recommendations: [],
    attendancePolls: [],
    activeCommissionMemberId: COMMISSION_ATTENDANCE_MEMBERS[0].id,
  };
}

/** Восстанавливаем только отсутствующие исходные тестовые карточки, не заменяя существующие. */
function restoreRequestedComplaints(cases: DemoState["cases"]) {
  const restored = [...cases];
  for (const c of installDigitalAuditCases(seed())) {
    const newId = RESTORED_COMPLAINT_IDS.get(c.id);
    if (newId && !restored.some(item => item.id === c.id || item.id === newId)) restored.push({ ...c, id: newId });
  }
  return restored;
}

function authorityRecipientRole(issuer: string): Role {
  return issuer.toUpperCase().includes("КВГА") ? "kvga" : "dvga";
}

export function createDemoRepository(
  storage: Pick<Storage, "getItem" | "setItem">,
): ObjectionsRepository {
  return {
    load() {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return initialState();
      const value = JSON.parse(raw) as DemoState;
      if (
        ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, CURRENT_VERSION].includes(value.version) ||
        !Array.isArray(value.cases) ||
        typeof value.date !== "string"
      ) {
        throw new Error(
          "Сохранённые данные имеют неподдерживаемый формат. Сбросьте демонстрацию.",
        );
      }
      // Переносим оставшееся обращение со старого системного номера и
      // удаляем карточки, которые больше не входят в исходный набор демо.
      // Сначала устраняем дубли, которые могли появиться при одновременном
      // наличии старого и нового номера в localStorage.
      const removedForMigration = (id: string) => isRemovedDemoCase(id) || removedInMigration(id, value.version);
      const renumber = new Map<string, string>();
      if (value.version < 17) for (const [oldId, newId] of RESTORED_COMPLAINT_IDS) {
        if (value.cases.some(item => item.id === oldId) && !value.cases.some(item => item.id === newId)) renumber.set(oldId, newId);
      }
      const caseId = (id: string) => migratedCaseId(renumber.get(id) || id);
      const persistedCases = value.cases.reduce<typeof value.cases>((result, item) => {
        if (removedForMigration(item.id)) return result;
        const id = caseId(item.id);
        if (result.some((existing) => existing.id === id)) return result;
        result.push({
          ...item,
          id,
          appealNumber:
            item.appealNumber === "В-2026-005"
              ? "В-2026-001"
              : item.appealNumber,
        });
        return result;
      }, []);
      let restoredProtocolCertificate = false;
      const cases = persistedCases.map((c) => {
        const migrated =
          c.status === "commission_members"
            ? { ...c, status: "commission_voting" as const }
            : c;
        const normalized =
          value.version < 5 && migrated.status === "received"
            ? { ...migrated, status: "accepted" as const }
            : migrated;
        // The participants belong to the meeting that currently contains the
        // case. Earlier polls can remain in storage after rescheduling and
        // must not replace answers from the current meeting.
        const matchingMeeting = (value.meetings || [])
          .filter(
            (meeting) =>
              meeting.caseIds.some(id => caseId(id) === c.id) &&
              (!normalized.attendanceMeetingDate ||
                meeting.dateTime.slice(0, 10) ===
                  normalized.attendanceMeetingDate),
          )
          .sort((left, right) => right.dateTime.localeCompare(left.dateTime))
          .at(0);
        const latestAttendancePoll = matchingMeeting
          ? (value.attendancePolls || []).find(
              (poll) => poll.id === matchingMeeting.pollId,
            )
          : (value.attendancePolls || [])
              .filter((poll) => poll.caseIds.some(id => caseId(id) === c.id))
              .at(-1);
        const attendanceMembers = latestAttendancePoll
          ? COMMISSION_ATTENDANCE_MEMBERS
              .filter((member) => latestAttendancePoll.responses[member.id] === "yes")
              .map((member) => {
                const present = true;
                const chairId = presidingChairId(
                  COMMISSION_ATTENDANCE_MEMBERS
                    .filter(
                      (item) => latestAttendancePoll.responses[item.id] === "yes",
                    )
                    .map((item) => ({ id: item.id, present })),
                );
                return {
                  id: member.id,
                  name: member.name,
                  present,
                  isChair: member.id === chairId,
                  recused: false,
                  reason: "",
                };
              })
          : normalized.members;
        const chairId = presidingChairId(attendanceMembers);
        const votes =
          latestAttendancePoll && normalized.votes && chairId
            ? Object.fromEntries(
                Object.entries(normalized.votes).map(([pointId, vote]) => [
                  pointId,
                  { ...vote, chair: chairId },
                ]),
              )
            : normalized.votes;
        const requests = normalized.requests.map((request) =>
          request.template === "other" &&
          request.saqRecipient === "subject" &&
          !["Кабинет Объекта", "Кабинет Объекта SAQ", "Кабинет Объект №2 SAQ"].includes(request.recipient)
            ? { ...request, saqRecipient: undefined }
            : request,
        );
        // Версии до независимой маршрутизации могли сохранить обращение
        // на этапе подписания, хотя все запросы уже были направлены.
        // После загрузки такой карточки она должна ожидать ответов.
        const status =
          ["request_approval", "request_signed"].includes(normalized.status) &&
          requests.length > 0 &&
          requests.every((request) => Boolean(request.sent))
            ? "request_approved"
            : (normalized.status as string) === "decision_project_eotinish"
              ? "decision_project_hearing"
              : normalized.status;
        // Файлы, внесённые рабочим органом при единой фиксации ответов,
        // относятся к ответу внешнего органа, а не к ответу ДВГА/КВГА.
        const otherRequest = requests.find(
          (request) => request.template === "other" && !request.saqRecipient,
        );
        const documentsAfterExternalResponseMigration = otherRequest
          ? normalized.documents.map((document) =>
              document.kind === "response-attachment"
                ? { ...document, requestId: otherRequest.id }
                : document,
            )
          : normalized.documents;
        // Ранние версии привязывали файл ответа из кабинета Объекта
        // к первому запросу «иной орган». Переносим его к фактическому
        // запросу в кабинет SAQ, чтобы он был виден рабочему органу.
        const subjectRequests = requests.filter(
          (request) =>
            request.template === "other" && request.saqRecipient === "subject",
        );
        const documents = documentsAfterExternalResponseMigration.map((document) => {
          if (document.kind !== "subject-response-attachment") return document;
          if (requests.some(request => request.id === document.requestId && (request.saqRecipient === "dvga" || request.saqRecipient === "kvga"))) return document;
          const subjectRequest =
            subjectRequests.find((request) => request.responded === document.date) ||
            (subjectRequests.length === 1 ? subjectRequests[0] : undefined);
          return subjectRequest && document.requestId !== subjectRequest.id
            ? { ...document, requestId: subjectRequest.id }
            : document;
        });
        const hasFinalResponse = documents.some(
          (document) => document.kind === "final-response",
        );
        const delivery =
          status === "completed" &&
          hasFinalResponse &&
          normalized.delivery &&
          !normalized.delivery.recipientRoles
            ? {
                ...normalized.delivery,
                recipientRoles: [authorityRecipientRole(normalized.issuer), "subject"] as Role[],
              }
            : normalized.delivery;
        const result = {
          ...normalized,
          status,
          delivery,
          requests,
          documents: [...documents],
          members: attendanceMembers,
          votes,
          unread:
            normalized.unread ??
            (normalized.status === "received" && normalized.channel === "SAQ"),
        };
        if (restoreSkippedProtocolCertificate(result)) restoredProtocolCertificate = true;
        return result;
      });
      const previousNotifications = (value.notifications || [])
        .filter((notification) => !removedForMigration(notification.caseId))
        .map((notification) => ({
          ...notification,
          caseId: caseId(notification.caseId),
        }));
      const legacyFinalResponseNotifications =
        value.version < CURRENT_VERSION
          ? cases.flatMap((c) => {
              const finalResponse = c.documents
                .filter((document) => document.kind === "final-response")
                .at(-1);
              if (!finalResponse || c.status !== "completed") return [];
              const recipientRoles: Role[] = c.delivery?.recipientRoles || [];
              return recipientRoles
                .filter(
                  (recipientRole) =>
                    !previousNotifications.some(
                      (notification) =>
                        notification.caseId === c.id &&
                        notification.kind === "final-response" &&
                        notification.recipientRole === recipientRole,
                    ),
                )
                .map((recipientRole, index) => ({
                  id: `final-response-${c.id}-${index + 1}`,
                  caseId: c.id,
                  recipient:
                    recipientRole === "subject"
                      ? c.org
                      : recipientRole === "kvga"
                        ? "КВГА"
                        : "ДВГА",
                  recipientRole,
                  date: c.delivery?.date || finalResponse.date || c.registered,
                  read: false,
                  kind: "final-response" as const,
                  text: `Направлен окончательный ответ на обращение №${c.appealNumber || c.id} от ${formatDate(c.appealDate || c.registered)}.`,
                }));
            })
          : [];
      const sharedCases = [
        sharedAuditObjection(),
        sharedSaqStatementApplication(),
      ];
      const casesWithSharedCases: DemoState["cases"] = [...cases];
      sharedCases.forEach((sharedCase) => {
        if (!casesWithSharedCases.some((c) => c.id === sharedCase.id)) {
          casesWithSharedCases.unshift(sharedCase);
        }
      });
      const restoredState = {
        ...value,
        version: CURRENT_VERSION,
        agendas: (value.agendas || [])
          .map((agenda) => ({
            ...agenda,
            caseIds: normalizeCaseIds(agenda.caseIds, value.version, renumber),
          }))
          .filter((agenda) => agenda.caseIds.length > 0),
        meetings: (value.meetings || [])
          .map((meeting) => ({
            ...meeting,
            caseIds: normalizeCaseIds(meeting.caseIds, value.version, renumber),
            postponedCaseIds: meeting.postponedCaseIds
              ? normalizeCaseIds(meeting.postponedCaseIds, value.version, renumber)
              : undefined,
            inactiveCases: meeting.inactiveCases
              ?.map((item) =>
                item && typeof item.caseId === "string"
                  ? { ...item, caseId: caseId(item.caseId) }
                  : item,
              )
              .filter(
                (item) =>
                  item &&
                  typeof item.caseId === "string" &&
                  !removedForMigration(item.caseId),
              ),
          }))
          .filter(
            (meeting) =>
              meeting.caseIds.length > 0 ||
              Boolean(meeting.inactiveCases?.length),
          ),
        notifications: [...previousNotifications, ...legacyFinalResponseNotifications],
        recommendations: (value.recommendations || [])
          .filter((recommendation) => !removedForMigration(recommendation.caseId))
          .map((recommendation) => ({
            ...recommendation,
            caseId: caseId(recommendation.caseId),
            caseReference: renumber.get(recommendation.caseReference) || recommendation.caseReference,
          })),
        attendancePolls: (value.attendancePolls || [])
          .map((poll) => ({
            ...poll,
            caseIds: normalizeCaseIds(poll.caseIds, value.version, renumber),
          }))
          .filter(
            (poll) =>
              poll.caseIds.length > 0 ||
              (value.meetings || []).some((meeting) => meeting.pollId === poll.id),
          ),
        activeCommissionMemberId:
          value.activeCommissionMemberId || COMMISSION_ATTENDANCE_MEMBERS[0].id,
        cases: (value.version < 19 ? installKazakhTestStatements(value.version < 18 ? installTestStatements(installAuditPlusCases(value.version < 17 ? restoreRequestedComplaints(casesWithSharedCases) : casesWithSharedCases)) : casesWithSharedCases) : casesWithSharedCases).filter(c => !removedForMigration(c.id)),
      };
      if (restoredProtocolCertificate || value.version < CURRENT_VERSION) {
        try { storage.setItem(STORAGE_KEY, JSON.stringify(restoredState)); } catch { /* Restored data remains available in memory. */ }
      }
      return restoredState;
    },
    save(state) {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
  };
}
