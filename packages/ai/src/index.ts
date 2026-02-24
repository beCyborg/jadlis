// @jadlis/ai — Claude API, Agent SDK, Memory, Embeddings
export {
  createMessage,
  classifyIntent,
  type IntentType,
  type ClassifiedIntent,
} from "./claude";

export {
  embedText,
  embedBatch,
  markdownHeaderSplit,
  recursiveSplit,
  chunkDocument,
  indexChunks,
  _resetClients,
  type EmbedOptions,
  type ChunkMetadata,
  type DocumentChunk,
} from "./embeddings";

export {
  semanticSearch,
  type SearchOptions,
  type SearchResult,
} from "./search";

export {
  readFacts,
  writeFact,
  deleteFact,
  buildWorkingMemory,
  invalidateWorkingMemoryCache,
  shouldTriggerEpisodeSummarization,
  summarizeAndStoreEpisode,
  searchMemory,
} from "./memory";

export {
  runAgent,
  getSubagentConfig,
  createPreToolUseHook,
  createPostToolUseHook,
  MAX_TOOL_CALLS_PER_SESSION,
  type AgentRunOptions,
  type AgentDeps,
  type SubagentConfig,
} from "./agent";
