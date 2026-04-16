# Wiki Schema

This is Chase Allen's personal wiki, maintained by Claude Code sessions.
Every session that touches this vault MUST read this file first and follow its conventions.

## Principles

1. **Inbox is the pressure valve.** When in doubt, write to `inbox/`. Never let "where does this go?" slow down capture.
2. **Claude triages, Chase dumps.** Chase writes fast and loose. Claude organizes, cross-references, and enforces structure.
3. **The schema evolves deliberately.** Change this file when structure needs to change. Don't let conventions drift silently.
4. **Reference, don't duplicate.** Financial data lives in `~/finances/` (beancount). Project work lives in Gas Town (`~/gt/`). The wiki *points to* these, it doesn't copy them.
5. **Frontmatter is mandatory** on all pages except inbox files and this schema doc.

## Folder Reference

| Folder | Purpose | Naming | Frontmatter |
|--------|---------|--------|-------------|
| `inbox/` | Quick capture, unsorted | `YYYY-MM-DD.md` (one per day, append-only) | None |
| `daily/` | Today's focused task list | `YYYY-MM-DD.md` | `date`, `status` (active/done) |
| `daily/archive/` | Completed daily files | Same as daily | Same, status=done |
| `goals/` | Goal hierarchy and individual goals | `_index.md` + `<slug>.md` | `type`, `horizon`, `status` |
| `projects/` | High-level project overviews | `<project-slug>.md` | `status`, `started` |
| `personal/journal/` | Reflections, freeform | `YYYY-MM-DD.md` | `date` |
| `personal/people/` | Person pages | `firstname-lastname.md` | `name`, `met`, `relation` |
| `personal/guitar/` | Lessons, repertoire | Descriptive slugs | `type` (lesson/song/theory) |
| `personal/recipes/` | Recipes and grocery lists | Descriptive slugs | `type` (recipe/grocery) |
| `personal/quotes.md` | Running quote collection | Single file | None |
| `notes/` | General notes, loosely categorized | Descriptive slugs | `topic` |
| `finances/` | Financial docs, dashboards, goals | Descriptive slugs | `topic` |
| `sources/` | Raw inputs (PDFs, clippings, images) | Original filenames | None |

## Frontmatter Template

```yaml
---
title: Page Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [relevant, tags]
# Additional fields per folder (see table above)
---
```

## Daily File Format

```markdown
---
date: YYYY-MM-DD
status: active
---
# YYYY-MM-DD (Day of Week)

## Focus (2-5 items)
- [ ] Task one
- [ ] Task two

## Notes
- Anything that came up during the day

## Carried Forward
- Items that didn't get done, moved to tomorrow
```

### Backlog (`daily/backlog.md`)
A single persistent file for near-term items without a specific date.
- Pull items into dated daily files when the time is right
- Not for long-term goals (those go in `goals/`)
- Review periodically and prune completed/stale items

### Pre-dated Daily Files
For tasks that must happen on a specific day (e.g., "call Monday" — can't call
on the weekend). Create that day's file with the items pre-loaded. Do NOT use
this for deadlines.

### Deadlines
Items with a due date go in the **backlog** with a `⚠️ due: YYYY-MM-DD` tag.
Claude should surface these in every session and include them in the active
daily file until completed. For multi-step deadlines, break them into
actionable todos that move toward completion (e.g., "Fund Roth IRA" becomes
"Log into Schwab" → "Initiate transfer" → "Confirm contribution posted").

### End-of-Day Processing
1. Check off completed items
2. Move incomplete items to `## Carried Forward`
3. Set `status: done` in frontmatter
4. Move file to `daily/archive/`
5. Create next day's file with carried-forward items

## Inbox Processing (Triage)

When processing inbox entries, Claude should:
1. Read the day's inbox file
2. Categorize each item:
   - Actionable today → add to `daily/` file
   - Goal-related → link to relevant `goals/` page
   - Person info → update `personal/people/` page
   - Project note → update `projects/` page
   - General reference → create/update `notes/` page
   - Financial → update `finances/` page
3. Do NOT delete inbox entries — mark them as processed with ~~strikethrough~~

## Goal Hierarchy

Goals use three horizons:
- **north-star**: Life-level direction (1-3 of these)
- **annual**: Year-level objectives
- **quarterly**: 90-day targets, linked to annual goals

`goals/_index.md` is the master tree. Individual goal pages track progress, linked todos, and reflections.

## Wikilinks

Use Obsidian-style `[[wikilinks]]` for cross-references:
- `[[people/john-doe]]` from anywhere
- `[[goals/financial-independence]]` to link a todo to its goal
- Keep links relative to vault root

## Lint Checklist (Run Periodically)

- [ ] All pages (except inbox) have valid frontmatter
- [ ] No orphaned pages (pages with no inbound links)
- [ ] `goals/_index.md` reflects current goal state
- [ ] `daily/` has at most one `status: active` file
- [ ] Inbox files older than 7 days are fully triaged
- [ ] `finances/` docs match current beancount structure
- [ ] No duplicated content between wiki and source systems (GT, beancount)
