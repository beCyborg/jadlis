// @jadlis/ai — Claude API, Agent SDK, Memory, Embeddings
export {
  createMessage,
  createMessageWithTools,
  classifyIntent,
  type IntentType,
  type ClassifiedIntent,
} from "./claude";

export {
  buildZonePrompt,
  buildMorningPlanPrompt,
  buildTaskTransferPrompt,
  buildTomorrowPlanPrompt,
  buildDaySummaryPrompt,
  DETERMINE_ZONE_TOOL,
  SUGGEST_TASK_ACTIONS_TOOL,
  PLAN_TOMORROW_TOOL,
  ZONE_DISPLAY,
  ZONE_PROMPT_CACHEABLE,
  MORNING_PLAN_PROMPT_CACHEABLE,
  TOMORROW_PLAN_PROMPT_CACHEABLE,
  TASK_TRANSFER_PROMPT_CACHEABLE,
  DAY_SUMMARY_PROMPT_CACHEABLE,
  type ZoneDetermination,
} from "./prompts/dailyCycle";

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
