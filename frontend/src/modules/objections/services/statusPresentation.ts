import { STATUS } from "../../../data/constants";
import type { CaseStatus, Role } from "../../../types";

/** Членам АК показываем только статусы, относящиеся к их работе с делом. */
const COMMISSION_STATUS: Partial<Record<CaseStatus, string>> = {
  documents_review: "Ознакомление с документами",
  commission_voting: "Голосование",
  circulated: "Голосование",
  meeting_certificate_approval: "Голосование",
  meeting_certificate_signed: "Голосование",
  meeting_certificate_approved: "Голосование",
  meeting: "Формирование протокола",
  protocol: "Подписание протокола",
};

export function statusLabelForRole(status: CaseStatus, role: Role) {
  return role === "commission" ? COMMISSION_STATUS[status] : STATUS[status];
}
