import type {
  CaseDocument,
  DocumentLanguage,
  DocumentLanguageMode,
  ObjectionCase,
  ViolationPoint,
} from "../../../types";

export const LANGUAGE_LABELS = { ru: "Русский", kk: "Қазақша" } as const;
export function appealLanguage(c: ObjectionCase): DocumentLanguage {
  return c.appealLanguage || "ru";
}
export function selectedLanguages(
  c: ObjectionCase,
  mode?: string,
): DocumentLanguage[] {
  const primary = appealLanguage(c);
  if (mode === "both") return [primary, primary === "ru" ? "kk" : "ru"];
  if (mode && mode !== primary)
    throw new Error("Документ должен включать язык обращения");
  return [primary];
}
export function languagesForDocument(
  c: ObjectionCase,
  kind: string,
  document?: CaseDocument,
): DocumentLanguage[] {
  if (document)
    return (
      document.languages ||
      (kind === "certificate"
        ? document.snapshot?.certificate?.languages
        : kind === "protocol"
          ? document.snapshot?.meeting?.languages
          : undefined) || [document.snapshot?.appealLanguage || "ru"]
    );
  return (
    (kind === "certificate"
      ? c.certificate?.languages
      : kind === "protocol"
        ? c.meeting?.languages
        : undefined) || [appealLanguage(c)]
  );
}
export function pointText(
  c: ObjectionCase,
  point: ViolationPoint,
  field: "title" | "argument",
  language: DocumentLanguage,
): string {
  return (
    point.translations?.[language]?.[field] ??
    (language === appealLanguage(c) ? point[field] : "")
  );
}
/** Copy only: render a language without modifying source data or signed snapshots. */
export function localizedCase(
  c: ObjectionCase,
  language: DocumentLanguage,
  includeDocuments = true,
): ObjectionCase {
  const kk = language === "kk";
  const result = structuredClone(c);
  result.issues = c.issues.map((point) => ({
    ...point,
    title: pointText(c, point, "title", language),
    argument: pointText(c, point, "argument", language),
    additionalArguments:
      point.translations?.[language]?.additionalArguments ??
      (language === appealLanguage(c) ? point.additionalArguments : []),
    authorityFinding: kk ? "" : point.authorityFinding,
    position: kk ? "" : point.position,
  }));
  result.requests = c.requests.map((r) => ({
    ...r,
    authorityResponses: kk ? r.authorityResponsesKk : r.authorityResponses,
  }));
  if (result.certificate)
    result.certificate = {
      ...result.certificate,
      davgaArguments: kk ? "" : result.certificate.davgaArguments,
      davgaArgumentsByPoint: kk
        ? result.certificate.davgaArgumentsByPointKk
        : result.certificate.davgaArgumentsByPoint,
      memberPositions: result.certificate.memberPositions.map((p) => ({
        ...p,
        comment: kk ? p.commentKk || "" : p.comment,
      })),
    };
  if (result.meeting && kk)
    result.meeting.recommendations = result.meeting.recommendationsKk;
  if (result.meeting?.protocolVersions)
    result.meeting.protocolVersions = result.meeting.protocolVersions.map(
      (v) => ({
        ...v,
        rows: v.rows.map((r) => ({
          ...r,
          original: kk ? r.originalKk || "" : r.original,
          edited: kk ? r.editedKk || "" : r.edited,
        })),
      }),
    );
  if (result.decisionProjectDavgaOverrides && kk)
    result.decisionProjectDavgaOverrides.byPoint =
      result.decisionProjectDavgaOverrides.byPointKk || {};
  if (kk)
    result.motivatedResponseDavgaOverrides =
      result.motivatedResponseDavgaOverridesKk;
  if (includeDocuments)
    result.documents = c.documents.map((d) => ({
      ...d,
      snapshot: d.snapshot
        ? {
            ...d.snapshot,
            ...localizedCase(
              {
                ...c,
                ...d.snapshot,
                decisionProjectDavgaOverrides:
                  d.snapshot.decisionProjectDavgaOverrides,
                documents: [],
              },
              language,
              false,
            ),
          }
        : undefined,
    }));
  return result;
}
export function documentMode(
  c: ObjectionCase,
  value?: string,
): DocumentLanguageMode {
  return value === "both" ? "both" : appealLanguage(c);
}
