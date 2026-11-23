import type { CaseDocument, ViolationPoint } from "../../../types";

/**
 * Возвращает только документы, прикреплённые к конкретному оспариваемому пункту.
 * Идентификатор файла и идентификатор пункта имеют приоритет над именем файла:
 * одинаковые имена могут встречаться у разных вложений.
 */
export function evidenceDocumentsForPoint(
  point: Pick<ViolationPoint, "id" | "number" | "evidence" | "evidenceAttachmentIds">,
  documents: readonly CaseDocument[],
): CaseDocument[] {
  const attachments = documents.filter(
    (document) => document.kind === "attachment" && Boolean(document.dataUrl),
  );

  if (point.evidenceAttachmentIds?.length) {
    const byId = new Map(
      attachments
        .filter((document) => document.evidencePointId === point.id && document.evidenceAttachmentId)
        .map((document) => [document.evidenceAttachmentId!, document]),
    );
    return point.evidenceAttachmentIds.flatMap((id) => {
      const document = byId.get(id);
      return document ? [document] : [];
    });
  }

  // Обращения, созданные до появления идентификаторов: связь уже сохранялась в поле text.
  const legacyPointLabel = `Доказательства по пункту № ${point.number}`;
  const pointDocuments = attachments.filter(
    (document) =>
      document.evidencePointId === point.id ||
      (!document.evidencePointId && document.text === legacyPointLabel),
  );
  if (pointDocuments.length) return pointDocuments;

  // Никогда не показываем чужой файл только потому, что у него такое же имя.
  const fileNames = new Set(
    (point.evidence || "").split(",").map((name) => name.trim()).filter(Boolean),
  );
  return attachments.filter(
    (document) =>
      !document.evidencePointId &&
      !document.text?.startsWith("Доказательства по пункту № ") &&
      fileNames.has(document.filename || document.name),
  );
}
