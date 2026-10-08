import type { CandidateRecord, FieldRecord } from "./field_record.js";

export type DuplicateDecision =
  | { outcome: "duplicate"; matchedWorkOrderId: string; similarity: number; reason: string }
  | { outcome: "stored"; workOrderId: string; reason: string };

const ACTIVE = new Set(["scheduled", "en_route", "on_site"]);

export function decideDuplicate(
  incoming: FieldRecord,
  candidates: CandidateRecord[],
  threshold = 0.88
): DuplicateDecision {
  const match = candidates.find((candidate) => {
    const samePhoto = Boolean(
      incoming.photo.sha256 && candidate.metadata.photoSha256 === incoming.photo.sha256
    );
    const compatibleStatus =
      candidate.metadata.dispatchStatus === incoming.dispatchStatus ||
      (ACTIVE.has(incoming.dispatchStatus) && ACTIVE.has(candidate.metadata.dispatchStatus ?? ""));
    return samePhoto || (candidate.score >= threshold && compatibleStatus);
  });

  if (match) {
    return {
      outcome: "duplicate",
      matchedWorkOrderId: match.id,
      similarity: match.score,
      reason: incoming.photo.sha256 === match.metadata.photoSha256
        ? "the photo content is already attached to a work order"
        : "the field note is semantically close and the dispatch states agree"
    };
  }

  return {
    outcome: "stored",
    workOrderId: incoming.workOrderId,
    reason: "no compatible field record crossed the duplicate threshold"
  };
}
