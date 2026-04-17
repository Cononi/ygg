import type { Messages } from './types.js'

export const en = {
  commands: {
    create: {
      description:
        'Create a new feature/change proposal. Validates spec completeness via YGG Point scoring',
    },
    next: {
      description: 'Build design, spec, and task list for the active proposal',
    },
    add: {
      description:
        'Implement tasks from the active change plan following spec constraints',
    },
    qa: {
      description:
        'Verify implementation. Run build/test/lint/typecheck and report pass/fail against spec',
    },
    status: {
      description:
        'Show implementation progress dashboard with per-phase completion rates',
    },
    prove: {
      description:
        'Verify entire ygg system installation: directories, agents, commands, skills',
    },
    lang: {
      description: 'Configure ygg system language. Saves to ygg/config.yml',
    },
  },
  skills: {
    create: {
      description:
        'Create a new feature/change proposal. Validates spec completeness via YGG Point scoring, asking clarifying questions until clarity reaches 0.95+. Triggered by /ygg:create command.',
      askInitial: 'What feature or change would you like to create? Describe it in natural language.',
      scoreReady: "Proposal '{{topic}}' created (YGG Point: {{score}}). Choose your next step.",
      nextSteps: 'Continue to design — build design + spec + tasks',
    },
    next: {
      description:
        'Build design, spec, and tasks for the active proposal. Validates architecture decisions via YGG Point scoring. Triggered by /ygg:next command.',
      planReady:
        "'{{topic}}' planning complete (YGG Point: {{score}}). Design: {{decisions}} decisions, Spec: {{specs}} components, Tasks: {{tasks}} items.",
      nextSteps: 'Start implementation',
    },
    add: {
      description:
        'Implement tasks from the active change plan in order, following spec constraints. Records daily changes. Triggered by /ygg:add command.',
      taskStatus: "'{{topic}}' task list ({{done}}/{{total}} complete). How would you like to proceed?",
      nextSteps: 'Implement all remaining tasks',
      qaPrompt: "'{{topic}}' implementation complete. Verification tasks remain. Choose your next step.",
    },
    qa: {
      description:
        'Verify implementation. Run build/test/lint/typecheck and cross-check spec requirements with evidence-based pass/fail report. Triggered by /ygg:qa command.',
    },
    status: {
      description:
        'Show implementation progress dashboard. Reads ygg/change/INDEX.md and active topics\' tasks.md files to display per-phase and overall completion rates. Triggered by /ygg:status command.',
    },
    prove: {
      description:
        'Verify entire ygg system installation. Tests directory structure, agents, commands, skills, hooks, scripts. Triggered by /ygg:prove command.',
    },
    lang: {
      description: 'Configure ygg system language. Saves selected language to ygg/config.yml. Triggered by /ygg:lang command.',
      selectLang: 'Select the language for your ygg system.',
      saved: "Language set to '{{lang}}'. Will be applied on next generate/init.",
    },
    core: {
      description:
        'Shared rules and formats for all /ygg:* commands. Defines the OpenSpec-like pipeline (create→next→add→qa), the per-change system-of-record under ygg/change/, document formats, AskUserQuestion interaction rules, and the shared foundation for multi-AI collaboration. Auto-activates alongside any ygg skill.',
    },
  },
} as const satisfies Messages
