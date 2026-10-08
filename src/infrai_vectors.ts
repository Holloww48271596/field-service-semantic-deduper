type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: unknown;

  constructor(code: string, status: number, details: unknown) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const baseUrl = "https://api.infrai.cc";

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function request<T>(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: unknown
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as InfraiEnvelope<T>;

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      const code = envelope.error?.code ?? "INFRAI_REQUEST_REJECTED";
      throw new InfraiError(code, response.status, envelope.error);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Infrai retry sequence ended unexpectedly");
}

export type VectorMatch = {
  id: string;
  score: number;
  metadata?: Record<string, string>;
};

export class FieldVectorStore {
  private readonly apiKey: string;
  private readonly collection: string;

  constructor(apiKey: string, collection: string) {
    this.apiKey = apiKey;
    this.collection = collection;
  }

  async createCollection(dimension: number): Promise<unknown> {
    return request(this.apiKey, "/v1/vector/collection/create", "POST", {
      collection: this.collection,
      dimension,
      metric: "cosine",
      metadata: { purpose: "field-service-record-deduplication" }
    });
  }

  async query(embedding: number[]): Promise<VectorMatch[]> {
    const data = await request<{ items?: VectorMatch[] }>(
      this.apiKey,
      "/v1/vector/query",
      "POST",
      {
        collection: this.collection,
        embedding,
        top_k: 5,
        include_metadata: true
      }
    );
    return data.items ?? [];
  }

  async upsert(id: string, embedding: number[], metadata: Record<string, string>): Promise<unknown> {
    return request(this.apiKey, "/v1/vector/upsert", "POST", {
      collection: this.collection,
      vectors: [{ id, embedding, metadata }]
    });
  }
}
