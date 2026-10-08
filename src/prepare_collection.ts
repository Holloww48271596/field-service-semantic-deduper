import { FieldVectorStore } from "./infrai_vectors.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before preparing the collection");

const store = new FieldVectorStore(apiKey, process.env.INFRAI_COLLECTION ?? "field-records-demo");
const dimension = Number(process.env.EMBEDDING_DIMENSION ?? 1536);

await store.createCollection(dimension);
console.log(`Collection prepared with ${dimension} dimensions.`);
