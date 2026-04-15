/** @cono-ai/ygg — Public API */

// Types
export type {
  Result,
  ComponentType,
  Scope,
  HookEvent,
  HookHandler,
  PlanEntry,
  GenerateContext,
  Generator,
  ValidationIssue,
} from './types/index.js'
export {
  ok,
  err,
  SpecParseError,
  PlanBuildError,
  GenerateError,
  ValidationError,
} from './types/index.js'

// Schemas
export { agentSpecSchema } from './schemas/agent.schema.js'
export type { AgentSpec } from './schemas/agent.schema.js'
export { hookSpecSchema } from './schemas/hook.schema.js'
export type { HookSpec } from './schemas/hook.schema.js'
export { commandSpecSchema } from './schemas/command.schema.js'
export type { CommandSpec } from './schemas/command.schema.js'
export { skillSpecSchema } from './schemas/skill.schema.js'
export type { SkillSpec } from './schemas/skill.schema.js'
export { planSchema } from './schemas/plan.schema.js'
export type { Plan } from './schemas/plan.schema.js'

// YGG Point Types
export type {
  EvaluatorType,
  QualityEvaluator,
  Dimension,
  DimensionScore,
  QAEntry,
  YggPointResult,
  YggPointQuestion,
  YggPointConfig,
  StageName,
  StageDefinition,
} from './types/ygg-point.js'

// Core
export { parseComponentSpec, inferComponentType } from './core/spec-parser.js'
export { buildSinglePlan } from './core/plan-builder.js'
export { executeGenerate } from './core/generator.js'
export { validateOutput } from './core/validator.js'
export { YggPointEngine } from './core/ygg-point.js'
export { createStageDefinition } from './core/dimensions/create.js'
export { nextStageDefinition } from './core/dimensions/next.js'

// Generators
export { generateAgent } from './generators/agent-generator.js'
export { generateHook, hookSpecToSettings } from './generators/hook-generator.js'
export { generateCommand } from './generators/command-generator.js'
export { generateSkill } from './generators/skill-generator.js'

// Utils
export { logger, setLogLevel } from './utils/logger.js'
export { resolveTargetPath, resolveSupplementaryPath } from './utils/paths.js'
export { parseFrontmatter, stringifyFrontmatter } from './utils/frontmatter.js'
export { computeHash, fileExists, safeWriteFile } from './utils/file-writer.js'
