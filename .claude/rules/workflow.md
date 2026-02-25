# Рабочий процесс Jadlis

## Deep Trilogy

Планы и секции хранятся в **jadlis-creator** (родительский репо):
`/Users/cyborg/Documents/jadlis-creator/context/jadlis/`

### Реализация готового плана

```
/deep-implement @/Users/cyborg/Documents/jadlis-creator/context/jadlis/<NN-name>/sections/.
```

### Research (шаг 7 deep-plan) — обязательные источники

При web research **всегда** использовать дополнительно:
1. **Reddit MCP** (`mcp__claude_ai_Reddit`) — реальный опыт, подводные камни
2. **Exa MCP** (`mcp__claude_ai_Exa`) — глубокий поиск статей, кода, паттернов

Результаты включать в `claude-research.md` отдельными секциями.

### Советники (перед одобрением плана)

**Всегда:**
1. `/jadlis-advisor-nupp:advisor` — NUP Scan (6 принципов)
2. `/jadlis-advisor-make:advisor` — тактическая оценка MAKE

**При сложных решениях:**
3. `/jadlis-advisor-cognitive-biases:advisor` — Bias Scan

## Git Workflow

- Каждый коммит привязан к issue. Без issue — без коммита.
- Issues и PR — в `beCyborg/jadlis` (этот репо)
- Типы: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Связь: `Closes #N` / `Relates to #N` / `Part of #N`

## Финализация

```
/commit                # git add + commit с привязкой к issue
/commit-push-pr        # commit + push + создать PR
/review-pr             # 6 агентов ревьюят параллельно (перед merge)
```

## CI/CD (автоматически при PR)

- `ci.yml` → typecheck + bun test
- `claude-review.yml` → Claude ревьюит на русском
- `security-review.yml` → security scan
- `@claude` в комментарии → interactive response
