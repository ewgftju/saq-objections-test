import { languagesForDocument, localizedCase } from "./documentLanguage";
import type { DocumentLanguage, ObjectionCase } from "../../../types";
import { disputed, normalizeVoteChoice, pointOutcomeFromVotes } from "./decisions";

const DAVGA_LABEL = "Доводы рабочего органа (ДАВГА МФ РК): ";

export function currentProtocolRows(c: ObjectionCase) {
  const latest = c.meeting?.protocolVersions?.at(-1);
  return (latest?.certificateRevision ?? 0) === (c.certificateRevision ?? 0) ? latest?.rows : undefined;
}

export function protocolDavgaFromReason(reason: string) {
  const label = reason.includes(DAVGA_LABEL) ? DAVGA_LABEL : "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: ";
  const index = reason.lastIndexOf(label);
  return index < 0 ? "" : reason.slice(index + label.length);
}

export function signedProtocolDavga(c: ObjectionCase, pointId: string, language: DocumentLanguage = "ru") {
  const version = [...(c.meeting?.protocolVersions || [])].reverse().find((item) => item.signedAt);
  const signedAt = version?.signedAt || "";
  if (version?.languages?.length && !version.languages.includes(language)) return { text: "", signedAt };
  const point = c.issues.find((item) => item.id === pointId);
  const votes = c.votes?.[pointId];
  const outcome = pointOutcomeFromVotes(votes?.votes || {}, votes?.chair) || point?.final || point?.proposal;
  const row = version?.rows.find((item) => item.pointId === pointId && normalizeVoteChoice(item.vote) === outcome);
  return { text: protocolDavgaFromReason((language === "kk" ? row?.editedKk : row?.edited) || "").trim(), signedAt };
}

export function hasDavgaText(value: string) {
  return Boolean(value.trim()) && !/^[\s—–-]+$/u.test(value);
}

/** Latest saved certificate text in the requested language, for manual review only. */
export function certificateDavgaDraft(c: ObjectionCase, pointId: string, language: DocumentLanguage): string {
  for (const document of [...c.documents].reverse()) {
    if (document.kind !== "certificate" || !document.snapshot?.certificate || !languagesForDocument(c, document.kind, document).includes(language)) continue;
    const certificate = document.snapshot.certificate;
    const text = (language === "kk" ? certificate.davgaArgumentsByPointKk?.[pointId] : certificate.davgaArgumentsByPoint?.[pointId])?.trim() || (language === "ru" ? certificate.davgaArguments?.trim() : "") || "";
    if (hasDavgaText(text)) return text;
  }
  return "";
}

export function decisionProjectDavga(c: ObjectionCase, pointId: string, language: DocumentLanguage = "ru") {
  const protocol = signedProtocolDavga(c, pointId, language);
  const overrides = c.decisionProjectDavgaOverrides;
  const values = language === "kk" ? overrides?.byPointKk : overrides?.byPoint;
  return protocol.signedAt && overrides?.protocolSignedAt === protocol.signedAt
    ? values?.[pointId] ?? protocol.text
    : protocol.text;
}

export function motivatedResponseDavga(c: ObjectionCase, pointId: string, language: DocumentLanguage = "ru") {
  const approved = (language === "kk" ? c.motivatedResponseDavgaOverridesKk : c.motivatedResponseDavgaOverrides)?.[pointId];
  if (approved !== undefined) return approved;
  const project = [...c.documents].reverse().find((doc) => doc.kind === "decision-project" && doc.name === "Подписанный проект решения" && doc.snapshot);
  if (project?.snapshot) return decisionProjectDavga({ ...c, ...project.snapshot, decisionProjectDavgaOverrides: project.snapshot.decisionProjectDavgaOverrides }, pointId, language);
  return signedProtocolDavga(c, pointId, language).text;
}

export function missingAppealDavga(c: ObjectionCase, stage: "decision-project" | "motivated-response") {
  if (!c.appealLanguage) return [];
  const language = c.appealLanguage;
  return disputed(c).filter(point => !hasDavgaText(stage === "decision-project" ? decisionProjectDavga(c, point.id, language) : motivatedResponseDavga(c, point.id, language)));
}

export function replaceProtocolDavga(reason: string, davga: string) {
  const label = reason.includes("Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: ") ? "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: " : DAVGA_LABEL;
  const index = reason.lastIndexOf(label);
  return `${index < 0 ? `${reason}\n\n` : reason.slice(0, index)}${label}${davga}`;
}

export function certificateBasisForPoint(
  c: ObjectionCase,
  point: ReturnType<typeof disputed>[number],
  language: DocumentLanguage = "ru",
) {
  if (language === "kk") { c = localizedCase(c, language); point = c.issues.find(item => item.id === point.id)!; }
  const kk = language === "kk";
  const latestCertificate = [...c.documents]
    .reverse()
    .find(
      (document) =>
        document.kind === "certificate" && Boolean(document.snapshot?.certificate),
    );
  const source = latestCertificate?.snapshot;
  const savedPoint = source?.issues.find((item) => item.id === point.id);
  const sourcePoint = savedPoint ? { ...savedPoint, argument: savedPoint.argument || point.argument, additionalArguments: savedPoint.additionalArguments?.length ? savedPoint.additionalArguments : point.additionalArguments } : point;
  const sourceRequests = source?.requests || c.requests;
  const responses = sourceRequests
    .map((request) => ({
      authority: request.recipient.toUpperCase().includes("КВГА") ? "КВГА" : "ДВГА",
      response: request.authorityResponses?.[point.id],
      route: request.route,
    }))
    .filter(
      (
        item,
      ): item is {
        authority: "ДВГА" | "КВГА";
        response: { finding: string; response: string };
        route: ObjectionCase["requests"][number]["route"];
      } => Boolean(item.response),
    );
  const authorityArguments =
    responses
      .map(({ authority, response, route }) =>
        response.finding
          ? `${kk ? (route && route !== "initial" ? "Қосымша дәлелдер" : "Дәлелдер") : (route && route !== "initial" ? "Дополнительные доводы" : "Доводы")} ${kk ? (authority === "КВГА" ? "ІМАК" : "ІМАД") : authority}: ${response.finding}`
          : "",
      )
      .filter(Boolean)
      .join("\n\n") ||
    sourcePoint.authorityFinding ||
    "—";
  const authorityReply =
    responses
      .map(({ authority, response, route }) =>
        response.response
          ? `${kk ? (route && route !== "initial" ? "Қосымша уәжді жауап" : "Уәжді жауап") : (route && route !== "initial" ? "Дополнительный мотивированный ответ" : "Мотивированный ответ")} ${kk ? (authority === "КВГА" ? "ІМАК" : "ІМАД") : authority}: ${response.response}`
          : "",
      )
      .filter(Boolean)
      .join("\n\n") ||
    sourcePoint.position ||
    "—";
  const davgaArguments =
    source?.certificate?.davgaArgumentsByPoint?.[point.id] ||
    source?.certificate?.davgaArguments ||
    c.certificate?.davgaArgumentsByPoint?.[point.id] ||
    c.certificate?.davgaArguments ||
    "—";
  const additionalApplicantArguments = (sourcePoint.additionalArguments || [])
    .map(
      (argument, index) =>
        `${kk ? "Мемлекеттік аудит объектісінің (өтініш берушінің) қосымша дәлелдері" : "Дополнительные доводы объекта гос. аудита (заявителя)"}${
          index ? ` №${index + 1}` : ""
        }: ${argument}`,
    )
    .join("\n\n");
  return [
    responses.length ? authorityArguments : `${kk ? "ІМАД/ІМАК дәлелдері" : "Доводы ДВГА/КВГА"}: ${authorityArguments}`,
    `${kk ? "Мемлекеттік аудит объектісінің (өтініш берушінің) дәлелдері" : "Доводы объекта государственного аудита (заявителя)"}: ${sourcePoint.argument || "—"}`,
    additionalApplicantArguments,
    responses.length
      ? authorityReply
      : `${kk ? "ІМАД/ІМАК уәжді жауабы" : "Мотивированный ответ ДВГА/КВГА"}: ${authorityReply}`,
    `${kk ? "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері" : "Доводы рабочего органа (ДАВГА МФ РК)"}: ${davgaArguments}`,
  ].filter(Boolean).join("\n\n");
}

