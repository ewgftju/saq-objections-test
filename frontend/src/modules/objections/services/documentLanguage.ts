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
  if (mode === "ru" || mode === "kk") return [mode];
  if (mode) throw new Error("Выберите допустимый язык документа");
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
  // Applicant arguments are quoted in their original language in every version.
  if (field === "argument") return point.argument;
  return (
    point.translations?.[language]?.[field] ??
    (language === appealLanguage(c) ? point[field] : "")
  );
}
/** Statement wording as captured in the latest certificate, without modifying it. */
export function certificateStatementSource(c: ObjectionCase) {
  const snapshot = [...c.documents].reverse().find(item => item.kind === "certificate" && item.snapshot?.certificate)?.snapshot;
  return { request: snapshot?.request ?? c.request, translations: snapshot ? snapshot.statementTranslations : c.statementTranslations };
}

export function protocolStatementTranslation(c: ObjectionCase, language: DocumentLanguage) {
  const fromCertificate = certificateStatementSource(c).translations?.[language]?.trim();
  if (fromCertificate) return fromCertificate;
  const previous = [...(c.meeting?.protocolVersions || [])].reverse().find(item => (item.certificateRevision ?? 0) === (c.certificateRevision ?? 0));
  return previous?.statementTranslations?.[language] || "";
}

/** Description from the current certificate in one of its actual languages. */
export function certificatePointTitle(c: ObjectionCase, point: ViolationPoint, language: DocumentLanguage): string {
  const doc = [...c.documents].reverse().find(item => item.kind === "certificate" && item.snapshot?.certificate);
  const source = doc?.snapshot;
  const languages = doc?.languages || source?.certificate?.languages || c.certificate?.languages || [appealLanguage(c)];
  if (!languages.includes(language)) return "";
  const sourcePoint = source?.issues.find(item => item.id === point.id) || point;
  return pointText({ ...c, ...source, appealLanguage: source?.appealLanguage || c.appealLanguage }, sourcePoint, "title", language);
}

export function protocolPointTitle(c: ObjectionCase, point: ViolationPoint, language: DocumentLanguage): string {
  const fromCertificate = certificatePointTitle(c, point, language);
  if (fromCertificate) return fromCertificate;
  const version = [...(c.meeting?.protocolVersions || [])].reverse().find(item => (item.certificateRevision ?? 0) === (c.certificateRevision ?? 0));
  return version?.pointTitles?.[point.id]?.[language] || "";
}

export function protocolIssuesWithTitles(c: ObjectionCase, titles?: Record<string, Partial<Record<DocumentLanguage, string>>>): ViolationPoint[] {
  return c.issues.map(point => ({ ...point, translations: { ...point.translations, ...Object.fromEntries(Object.entries(titles?.[point.id] || {}).map(([language, title]) => [language, { ...point.translations?.[language as DocumentLanguage], title }])) } }));
}

/** Copy only: render a language without modifying source data or signed snapshots. */
export function localizedCase(
  c: ObjectionCase,
  language: DocumentLanguage,
  includeDocuments = true,
): ObjectionCase {
  const kk = language === "kk";
  const result = structuredClone(c);
  result.org = c.orgTranslations?.[language]?.trim() || c.org;
  result.issues = c.issues.map((point) => ({
    ...point,
    title: pointText(c, point, "title", language),
    argument: pointText(c, point, "argument", language),
    additionalArguments: point.additionalArguments,
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
  return value === "both" || value === "ru" || value === "kk" ? value : appealLanguage(c);
}
