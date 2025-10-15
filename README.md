## Advanced Meta-Prompt Generator

An opinionated CLI to generate robust AI meta-prompts. It produces either:

- messages: a chat array of `{role, content}`
- prompt: a single string with `[System]` and `[User]` sections

### Quick start

```bash
python3 meta_prompt.py --task "Write a hello world in Python" --profile code --format prompt
```

### Use a JSON config

```bash
python3 meta_prompt.py \
  --task "Add a healthcheck endpoint to our FastAPI app" \
  --config examples/configs/code_assistant.json \
  --format messages
```

### Constrain output to a JSON Schema

```bash
python3 meta_prompt.py \
  --task "Summarize Q3 KPIs and next steps" \
  --profile analyst \
  --schema examples/schemas/structured_answer.schema.json \
  --format prompt
```

See `examples/` for more.
