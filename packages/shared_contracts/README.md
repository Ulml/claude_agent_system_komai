# @template-lm/shared_contracts

Pydantic models that define **every structured message** exchanged inside
Template_LM — the Single Source of Truth of the data layer.

| Contract | Direction |
| --- | --- |
| `TaskSpecification` | orchestrator → agent |
| `TaskOutput` | agent → next agent + orchestrator |
| `ConformityReport` | judge → next agent + orchestrator + learning loop |
| `AgentProfile`, `Project`, `Perimeter`, `WorkEvent`, `LearningEntry` | persisted in Firestore, rendered by the web client |

The TypeScript mirror is `apps/web/src/core/types.ts`. **Any change here must
be reflected there** (field names are camelCased on the TS side).

## Install (editable, from the monorepo root)

```bash
pip install -e packages/shared_contracts
```
