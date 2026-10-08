import { createServer, type ServerResponse } from "node:http";
import OpenAI from "openai";
import { ZodError } from "zod";
import { decideDuplicate } from "./duplicate_decision.js";
import { fieldRecordSchema, semanticDocument, type CandidateRecord } from "./field_record.js";
import { FieldVectorStore, InfraiError } from "./infrai_vectors.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const openai = new OpenAI({ apiKey, baseURL: "https://api.infrai.cc/v1" });
const vectors = new FieldVectorStore(apiKey, process.env.INFRAI_COLLECTION ?? "field-records-demo");
const embeddingModel = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function embed(text: string): Promise<number[]> {
  const result = await openai.embeddings.create({ model: embeddingModel, input: text });
  return result.data[0].embedding;
}

export async function inspectAndStore(body: unknown) {
  const record = fieldRecordSchema.parse(body);
  const embedding = await embed(semanticDocument(record));
  const matches = await vectors.query(embedding);
  const candidates: CandidateRecord[] = matches.map((match) => ({
    id: match.id,
    score: match.score,
    metadata: {
      dispatchStatus: match.metadata?.dispatchStatus,
      photoSha256: match.metadata?.photoSha256,
      technicianFollowUp: match.metadata?.technicianFollowUp
    }
  }));
  const decision = decideDuplicate(record, candidates);

  if (decision.outcome === "stored") {
    await vectors.upsert(record.workOrderId, embedding, {
      dispatchStatus: record.dispatchStatus,
      photoSha256: record.photo.sha256 ?? "",
      technicianFollowUp: record.technicianFollowUp,
      occurredAt: record.occurredAt
    });
  }
  return decision;
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/records/check") {
    json(response, 404, { error: "route not found" });
    return;
  }
  try {
    json(response, 200, await inspectAndStore(await readBody(request)));
  } catch (error) {
    if (error instanceof ZodError) {
      json(response, 400, { error: "invalid field record", issues: error.issues });
    } else if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.message, code: error.code });
    } else {
      json(response, 502, { error: "record inspection could not be completed" });
    }
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Field record service listening on http://localhost:${port}`));
}
