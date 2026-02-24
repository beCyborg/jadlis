import { readFileSync } from "fs";
import { chunkDocument, indexChunks } from "../embeddings";

async function main(): Promise<void> {
  const frameworkPath = process.env.FRAMEWORK_PATH;
  const userId = process.env.USER_ID;

  if (!frameworkPath || !userId) {
    throw new Error("FRAMEWORK_PATH and USER_ID env vars required");
  }

  console.log(`Reading framework from: ${frameworkPath}`);
  const content = readFileSync(frameworkPath, "utf-8");

  console.log("Chunking document...");
  const chunks = chunkDocument(content, frameworkPath);
  console.log(`Created ${chunks.length} chunks`);

  console.log("Indexing chunks to Supabase...");
  await indexChunks(chunks, userId, "framework");

  console.log("Done.");
}

main().catch(console.error);
