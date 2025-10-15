## Examples

### Code assistant config
```bash
python meta_prompt.py \
  --task "Add a healthcheck endpoint to our FastAPI app" \
  --config examples/configs/code_assistant.json \
  --format messages
```

### Analytical profile with schema-constrained output
```bash
python meta_prompt.py \
  --task "Summarize Q3 KPIs and next steps" \
  --profile analyst \
  --schema examples/schemas/structured_answer.schema.json \
  --format prompt
```
