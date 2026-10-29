import type { ObjectionCase } from "../../../types";
import { disputed } from "./decisions";

const DAVGA_LABEL = "Доводы рабочего органа (ДАВГА МФ РК): ";

export function protocolDavgaFromReason(reason: string) {
  const index = reason.lastIndexOf(DAVGA_LABEL);
  return index < 0 ? "" : reason.slice(index + DAVGA_LABEL.length);
}

export function replaceProtocolDavga(reason: string, davga: string) {
  const index = reason.lastIndexOf(DAVGA_LABEL);
  return `${index < 0 ? `${reason}\n\n` : reason.slice(0, index)}${DAVGA_LABEL}${davga}`;
}

export function certificateBasisForPoint(
  c: ObjectionCase,
  point: ReturnType<typeof disputed>[number],
) {
  const latestCertificate = [...c.documents]
    .reverse()
    .find(
      (document) =>
        document.kind === "certificate" && Boolean(document.snapshot?.certificate),
    );
  const source = latestCertificate?.snapshot;
  const sourcePoint = source?.issues.find((item) => item.id === point.id) || point;
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
          ? `${route && route !== "initial" ? "Дополнительные доводы" : "Доводы"} ${authority}: ${response.finding}`
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
          ? `${route && route !== "initial" ? "Дополнительный мотивированный ответ" : "Мотивированный ответ"} ${authority}: ${response.response}`
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
        `Дополнительные доводы объекта гос. аудита (заявителя)${
          index ? ` №${index + 1}` : ""
        }: ${argument}`,
    )
    .join("\n\n");
  return [
    responses.length ? authorityArguments : `Доводы ДВГА/КВГА: ${authorityArguments}`,
    `Доводы объекта государственного аудита (заявителя): ${sourcePoint.argument || "—"}`,
    additionalApplicantArguments,
    responses.length
      ? authorityReply
      : `Мотивированный ответ ДВГА/КВГА: ${authorityReply}`,
    `Доводы рабочего органа (ДАВГА МФ РК): ${davgaArguments}`,
  ].filter(Boolean).join("\n\n");
}

