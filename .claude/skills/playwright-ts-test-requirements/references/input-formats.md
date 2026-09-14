# Input formats

Part of the [playwright-ts-test-requirements](../SKILL.md) skill.

Run the extraction script on the `source/` folder (or a single file); it converts what it can and lists the rest:

```bash
node .claude/skills/playwright-ts-test-requirements/scripts/extract-requirements.mjs "tasks/<KEY>/requirements/source" [--out <folder>]
```

| Format | How it is read |
|---|---|
| `.md`, `.markdown`, `.txt` | Copied to `extracted/` as is |
| `.csv`, `.tsv` | Converted to a Markdown table |
| `.xlsx` | Every sheet becomes a Markdown table (shared and inline strings) |
| `.docx`, `.doc`, `.rtf`, `.odt`, `.html`, `.htm`, `.webarchive` | `textutil` (macOS); `.docx` falls back to the document XML when `textutil` is missing |
| `.json`, `.yaml`, `.yml` (API contracts, OpenAPI) | Copied inside a code block |
| `.pdf` | Listed for manual reading: open it with the Read tool (use `pages` ranges for more than 10 pages) |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` (designs, screenshots) | Listed for manual reading: open with the Read tool and describe what it requires |
| Pasted text | Save it to `source/pasted-<n>.md` first so it has a reference |
| Jira, Confluence, Google Docs links | Use a connected tool (Atlassian connector, `drive-api` skill) when available; otherwise ask the user for an export (Word, PDF or HTML) |

Checks after extraction:

- Tables, numbered lists and headings survive conversion only partly — compare `extracted/` with the source for structured parts and read the original when in doubt.
- Track changes and comments in Word files are not extracted: ask whether they are accepted.
- Keep the source file and location (heading, page, sheet and row) for every requirement; the review and the traceability matrix reference them.
