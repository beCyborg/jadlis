# Jadlis — CLAUDE.md

## О проекте

**Jadlis** (Just A Digital Life Improvement System) — персональный AI-ассистент, связывающий смысл жизни с ежедневными действиями.

**Стек:** Bun monorepo, TypeScript, grammY (Telegram Bot), Hono (HTTP), Supabase (PostgreSQL + pgvector), Anthropic SDK.

## Структура

packages/
├── shared/         # Общие типы, Zod schemas, утилиты
├── bot/            # Telegram Bot (grammY + Hono webhook)
├── ai/             # AI-сервисы (Anthropic Claude, Voyage embeddings)
└── mcp-servers/    # MCP серверы для Claude Code

## Команды

bun install          # Установка зависимостей
bun run typecheck    # TypeScript typecheck всех пакетов
bun test             # Запуск тестов (bun:test)
bun run dev          # Локальный запуск с hot reload

## Стандарты кода

- **TypeScript strict mode** — `strict: true` в tsconfig. Запрещено использовать `any`.
- **Zod для валидации** — все внешние данные (webhook payload, API responses, env vars) валидируются через Zod.
- **Repository pattern** — обращение к Supabase только через классы-репозитории в `packages/shared/src/repositories/`. Прямые вызовы Supabase клиента вне репозиториев запрещены.
- **Anthropic SDK напрямую** — использовать `@anthropic-ai/sdk`. Не использовать Vercel AI SDK или другие обёртки.

## Git Workflow

**Каждый коммит привязан к GitHub Issue. Без issue — без коммита.**

Типы: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
Связь: `Closes #N` (закрывает issue) / `Relates to #N` / `Part of #N`

PR обязателен для мержа в main. Прямые push в main запрещены branch protection.

## Для Claude в CI

При автоматическом review (claude-review.yml, claude-interactive.yml):

- **Писать review комментарии на русском языке**
- Проверять привязку коммитов к Issues (наличие `Closes #N` или `Relates to #N`)
- Не предлагать изменения в `.github/workflows/` без явной необходимости
- Использовать Context7 MCP для проверки актуальности API вызовов библиотек

## Безопасность

**Абсолютные запреты:**
- Не коммитить `.env`, `.env.local`, secrets, API keys
- `SUPABASE_SERVICE_ROLE_KEY` — только на сервере (bot, ai пакеты). Никогда во фронтенде или Mini App.

**Telegram Mini App — аутентификация:**
Валидация init data через `@tma.js/init-data-node`. НЕ самописная валидация.

**Telegram Bot Webhook — валидация:**
Проверка `X-Telegram-Bot-Api-Secret-Token` в Hono middleware. Запросы без валидного токена отклоняются с 403.
