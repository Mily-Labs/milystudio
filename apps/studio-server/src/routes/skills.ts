import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { PROJECT_ROOT } from '../config.js';

export const skillsRouter = Router();

interface SkillEntry {
  id: string;
  label: string;
  ru: string;
  en: string;
  install: { ru: string[]; en: string[] };
  source: 'inline' | 'file';
}

/**
 * Skills are install guides for AI clients (Claude Code, Codex, Cursor, etc.)
 * to use the underlying subsystems. They live as data here so the Studio UI
 * can render them even when the target filesystem is read-only.
 */
const INLINE_SKILLS: SkillEntry[] = [
  {
    id: 'text-to-lottie',
    label: 'text-to-lottie',
    ru: 'Генерация Lottie-анимаций через AI-агента (Claude Code / Codex / Cursor)',
    en: 'Generate Lottie animations via AI agents (Claude Code / Codex / Cursor)',
    source: 'inline',
    install: {
      ru: [
        'Скопируйте `.agents/skills/text-to-lottie/SKILL.md` в `~/.mavis/skills/text-to-lottie/SKILL.md`',
        'Перезапустите клиент (Claude Code / Codex) — скилл появится в списке',
        'Запустите text-to-lottie dev-сервер: `npm --prefix text-to-lottie run dev`',
      ],
      en: [
        'Copy `.agents/skills/text-to-lottie/SKILL.md` to `~/.mavis/skills/text-to-lottie/SKILL.md`',
        'Restart your client (Claude Code / Codex) — the skill will appear in the list',
        'Start text-to-lottie dev server: `npm --prefix text-to-lottie run dev`',
      ],
    },
  },
  {
    id: 'omnivoice-mcp',
    label: 'OmniVoice MCP',
    ru: 'Управление OmniVoice (TTS/ASR/дубляж) через MCP-протокол',
    en: 'Control OmniVoice (TTS/ASR/dubbing) via the MCP protocol',
    source: 'inline',
    install: {
      ru: [
        'Запустите OmniVoice API: `bun --prefix OmniVoice run dev:api`',
        'Подключите MCP-сервер из OmniVoice/frontend в Claude / Codex',
        'Используйте инструменты `tts`, `asr`, `dubbing` прямо из чата',
      ],
      en: [
        'Start the OmniVoice API: `bun --prefix OmniVoice run dev:api`',
        'Wire the MCP server from OmniVoice/frontend into Claude / Codex',
        'Use `tts`, `asr`, `dubbing` tools straight from chat',
      ],
    },
  },
];

skillsRouter.get('/', (_req, res) => {
  res.json({ skills: INLINE_SKILLS });
});

skillsRouter.get('/:id', (req, res) => {
  const id = req.params.id;
  const skill = INLINE_SKILLS.find((s) => s.id === id);
  if (!skill) {
    res.status(404).json({ error: 'unknown skill' });
    return;
  }
  // If a SKILL.md file exists on disk, include its raw content as `markdown`.
  const skillFile = path.resolve(PROJECT_ROOT, '.agents', 'skills', id, 'SKILL.md');
  let markdown: string | null = null;
  if (fs.existsSync(skillFile)) {
    try {
      markdown = fs.readFileSync(skillFile, 'utf8');
    } catch {
      markdown = null;
    }
  }
  res.json({ ...skill, markdown });
});