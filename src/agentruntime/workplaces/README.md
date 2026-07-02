# Carvis Workplaces

Each run creates one isolated folder per role under:

```text
workplaces/runs/<timestamp-request>/<role>/
```

Roles:

- `manager`
- `writer`
- `artist`
- `researcher`
- `engineer`

## Files

Each role workspace includes:

- `input.md`: original task text.
- `common/role.md`: common constraints, role setting, collaboration rule, skill usage rule.
- `common/policy.md`: layered context policy and selected task skill.
- `skills/*.md`: task-specific thinking files such as `galgame`, `platformer`, `shop-autobattler`, `repo-doc`, and `generic-game`.
- `skills/selected.md`: the task skill selected for this run.
- `plan.md`: role execution checklist and installed role skills.
- `log.md`: role completion log.
- `result.md`: public role output.
- `task_state.json`: compact task state.
- `handoff_to_engineer.json`: facts, decisions, assets, constraints, risks, and handoff items.
- `evidence_index.json`: compact source pointers.
- `usage.json`: provider/model/role and token usage when metadata is available.

Raw `result.md` files are kept as evidence. Downstream prompts prefer `task_state.json`, `handoff_to_engineer.json`, and selected evidence to avoid passing every upstream long document into engineer.
