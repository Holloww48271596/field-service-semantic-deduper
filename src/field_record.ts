import { z } from "zod";

export const fieldRecordSchema = z.object({
  workOrderId: z.string().min(1),
  photo: z.object({
    caption: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/).optional()
  }),
  dispatchStatus: z.enum(["scheduled", "en_route", "on_site", "completed"]),
  technicianFollowUp: z.string().min(1),
  occurredAt: z.string().datetime()
});

export type FieldRecord = z.infer<typeof fieldRecordSchema>;

export type CandidateRecord = {
  id: string;
  score: number;
  metadata: {
    dispatchStatus?: string;
    photoSha256?: string;
    technicianFollowUp?: string;
  };
};

export function semanticDocument(record: FieldRecord): string {
  return [
    `Photo: ${record.photo.caption}`,
    `Dispatch status: ${record.dispatchStatus}`,
    `Technician follow-up: ${record.technicianFollowUp}`
  ].join("\n");
}
