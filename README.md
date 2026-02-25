# jadlis
Jadlis — Just A Digital Life Improvement System

## Параллельная разработка (Worktrees)

Claude Code поддерживает Git worktrees — изолированные рабочие директории для параллельных задач без конфликтов.

### Запуск сессии

```bash
# Именованная сессия (ветка worktree-feature-auth)
claude --worktree feature-auth

# Авто-генерация имени
claude -w
```

### Привязка к существующему PR

```bash
# Resume работы по PR #123
claude --from-pr 123
```

### Как это работает

1. Создаётся `.claude/worktrees/<name>/` — полная изолированная копия репо
2. Создаётся ветка `worktree-<name>` от HEAD
3. Claude работает в изолированной директории
4. При выходе:
   - Нет изменений → автоматическое удаление worktree
   - Есть изменения → Claude спрашивает: keep или remove

### Пример рабочего процесса

```bash
# Terminal 1: работа над Telegram Bot командами
claude -w feat-bot-commands
# → /commit-push-pr → PR #42

# Terminal 2: фикс бага в embedding pipeline
claude -w fix-embedding-bug
# → /commit-push-pr → PR #43

# Terminal 3: resume работы по feedback от Claude Review
claude --from-pr 42
```

Каждая сессия полностью изолирована: отдельные файлы, отдельные ветки. Каждый PR получает свой CI + Claude Review + Security Review.

### Субагенты с worktree isolation

В `.claude/agents/` можно настроить агентов с изоляцией через worktree:

```markdown
---
name: parallel-researcher
isolation: worktree
---
```

Каждый субагент получает свою копию репо — полезно для параллельного research и review.

### Ограничения

- Не запускать worktree внутри уже существующего worktree
- Worktree требует чистого рабочего дерева в родительском репо при создании
