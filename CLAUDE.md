# Jadlis — CLAUDE.md

## О проекте

**Jadlis** (Just A Digital Life Improvement System) — персональный AI-ассистент, связывающий смысл жизни с ежедневными действиями.

**Стек:** Bun monorepo, TypeScript, grammY (Telegram Bot), Hono (HTTP), Supabase (PostgreSQL + pgvector), Anthropic SDK.

## Структура

```
packages/
├── shared/         # Общие типы, Zod schemas, утилиты
├── bot/            # Telegram Bot (grammY + Hono webhook)
├── ai/             # AI-сервисы (Anthropic Claude, Voyage embeddings)
└── mcp-servers/    # MCP серверы для Claude Code
```

## Команды

```bash
bun install          # Установка зависимостей
bun run typecheck    # TypeScript typecheck всех пакетов
bun test             # Запуск тестов (bun:test)
bun run dev          # Локальный запуск с hot reload
```

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

## CI/CD Pipeline

### Автоматические проверки при PR

| Workflow | Что делает |
|----------|-----------|
| `ci.yml` (job: `tests`) | `bun run typecheck` + `bun test` |
| `claude-review.yml` | Claude Sonnet 4.6 ревьюит PR на русском, проверяет CLAUDE.md compliance + issue linking |
| `security-review.yml` | Автоматический security scan (XSS, injection, secrets) |
| `claude-interactive.yml` | Ответ на `@claude` mention в PR/Issues (OWNER/MEMBER/COLLABORATOR) |

### Локальный workflow

```bash
# Быстрый коммит + PR
/commit                    # git add + commit с привязкой к issue
/commit-push-pr            # commit + push + создать PR

# Ревью перед merge
/review-pr                 # 6 агентов параллельно: silent failures, type design,
                           # test coverage, code simplifier, comment analyzer, code reviewer

# Параллельная работа
claude -w feat-new-feature # Worktree: изолированная копия репо
claude --from-pr 42        # Подхватить PR для ревью
```

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

**GitHub Secrets:**
- `ANTHROPIC_API_KEY` — в repo Settings → Secrets (для CI workflows)

**Telegram Mini App — аутентификация:**
Валидация init data через `@tma.js/init-data-node`. НЕ самописная валидация.

**Telegram Bot Webhook — валидация:**
Проверка `X-Telegram-Bot-Api-Secret-Token` в Hono middleware. Запросы без валидного токена отклоняются с 403.
