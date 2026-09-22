import { COMMISSION_ATTENDANCE_MEMBERS, seed } from "../data/objections";
import type { DemoState } from "../types";

/** The demo adapter is the only module that reads or writes case storage. */
export interface ObjectionsRepository {
  load(): DemoState;
  save(state: DemoState): void;
}

export const STORAGE_KEY = "saq.objections.demo.v1";
const CURRENT_VERSION = 9;

// Version 6 distinguishes incoming SAQ appeals from manually created appeals.

export function initialState(): DemoState {
  return {
    version: CURRENT_VERSION,
    date: "2026-09-08",
    cases: seed(),
    agendas: [],
    notifications: [],
    recommendations: [],
    attendancePolls: [],
    activeCommissionMemberId: COMMISSION_ATTENDANCE_MEMBERS[0].id,
  };
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
        ![1, 2, 3, 4, 5, 6, 7, 8, CURRENT_VERSION].includes(value.version) ||
        !Array.isArray(value.cases) ||
        typeof value.date !== "string"
      ) {
        throw new Error(
          "Сохранённые данные имеют неподдерживаемый формат. Сбросьте демонстрацию.",
        );
      }
      // Версия 9 заменяет все прежние демонстрационные обращения на набор
      // из шести карточек — по одному на каждый вид обращения.
      if (value.version === 8) return initialState();
      return {
        ...value,
        version: CURRENT_VERSION,
        agendas: value.agendas || [],
        notifications: value.notifications || [],
        recommendations: value.recommendations || [],
        attendancePolls: value.attendancePolls || [],
        activeCommissionMemberId:
          value.activeCommissionMemberId || COMMISSION_ATTENDANCE_MEMBERS[0].id,
        cases: value.cases.map((c) => {
          const migrated =
            c.status === "commission_members" || c.status === "documents_review"
              ? { ...c, status: "commission_voting" as const }
              : c;
          const normalized =
            value.version < 5 && migrated.status === "received"
              ? { ...migrated, status: "accepted" as const }
              : migrated;
          // Polls are appended when the working body sends them. The latest
          // sent poll must take precedence even if its meeting date is earlier.
          const latestAttendancePoll = (value.attendancePolls || [])
            .filter((poll) => poll.caseIds.includes(c.id))
            .at(-1);
          const attendanceMembers = latestAttendancePoll
            ? COMMISSION_ATTENDANCE_MEMBERS
                .filter((member) => latestAttendancePoll.responses[member.id] === "yes")
                .map((member) => ({
                  id: member.id,
                  name: member.name,
                  present: true,
                  recused: false,
                  reason: "",
                }))
            : normalized.members;
          return {
            ...normalized,
            members: attendanceMembers,
            unread:
              normalized.unread ??
              (normalized.status === "received" && normalized.channel === "SAQ"),
          };
        }),
      };
    },
    save(state) {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
  };
}
