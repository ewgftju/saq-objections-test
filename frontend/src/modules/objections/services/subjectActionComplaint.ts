import type { SubjectAppealDraft, SubjectAuditReport } from "../../../types";
import { SUBJECT_2_PROFILE } from "../../../data/subjectProfiles";

/** Жалоба на действие/бездействие не связывается с исходным документом ВГА. */
export function actionComplaintReport(draft: SubjectAppealDraft, today: string): SubjectAuditReport {
  return {
    documentKind: "action-inaction",
    sourceCaseId: "subject2-action-inaction-unlinked",
    number: draft.initialAppealNumber?.trim() || "",
    date: draft.initialAppealDate || today,
    received: draft.initialAppealDate || today,
    org: SUBJECT_2_PROFILE.orgTranslations.ru,
    orgTranslations: { ...SUBJECT_2_PROFILE.orgTranslations },
    bin: SUBJECT_2_PROFILE.bin,
    identifierType: "БИН",
    address: "г. Алматы",
    issuer: draft.auditAuthority || "",
    points: (draft.manualPoints || []).map((point) => ({
      id: point.id,
      number: point.number,
      title: "",
      finding: "",
      amount: 0,
    })),
  };
}

export function newActionComplaintDraft(id: string): SubjectAppealDraft {
  return {
    id,
    documentKind: "action-inaction",
    ownerRole: "subject2",
    sourceCaseId: "subject2-action-inaction-unlinked",
    sourceFingerprint: "action-inaction-unlinked",
    initialAppealNumber: "",
    initialAppealDate: "",
    auditAuthority: "",
    manualPoints: [],
    postalAddress: "",
    otherInformation: "",
    language: "ru",
    circumstancesMode: "per-point",
    circumstances: "",
    signerName: "",
    signerPosition: "Руководитель",
    place: "",
    selectedPointIds: [],
    argumentsByPoint: {},
    attachments: [],
  };
}
