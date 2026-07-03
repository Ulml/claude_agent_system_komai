# TRD — Référence technique Template_LM

## 1. Pile technique

| Couche | Choix | Raison |
| --- | --- | --- |
| Client | React 19 + TypeScript strict + Vite 6 + Tailwind CSS 4 | Continuité avec les prototypes, build instantané |
| Icônes | lucide-react | Standard des deux prototypes |
| Agents | Python 3.11, **LangGraph + LangChain + Pydantic** | Exigence produit ; graphes supervisables |
| Observabilité | LangSmith (via `LANGSMITH_*` env) + `WorkEvent` Firestore | Traces + travail en direct dans l'UI |
| Backend | **Firebase** : Hosting, Auth (SSO Google), Firestore | Exigence produit ; règles = périmètres |
| Mémoire vectorielle | ChromaDB (optionnelle, repli mot-clé) | Zéro dépendance native obligatoire |

## 2. Couche LLM agnostique

### Client (`apps/web/src/services/llm.ts`)
Une fonction unique `generateText({provider, model, system, prompt})` routant
vers trois protocoles : `google` (Gemini REST), `openai-compatible` (OpenAI,
Ollama, LMLite, vLLM via `baseUrl`), `anthropic` (Messages API). Sans clé,
repli déterministe simulé — l'OS reste utilisable hors ligne.

### Harnais (`packages/agent_harness/main.py::build_llm`)
Le harnais accepte n'importe quel chat model LangChain ; la liaison
(`LLM_PROVIDER`/`LLM_MODEL` ou `contracts.LLMBinding` par agent) est le seul
point de variation.

## 3. Le harnais standard (toutes fonctions Hermes)

`core/harness_graph.py` construit le graphe LangGraph :

```
sense → plan → act → observe → judge ─(conforme)→ END
                ↑__________________(non conforme + garde-fous ok)
```

- **memory_layer.py** : mémoires procédurale (skills .md), sémantique
  (persona JSON), épisodique (JSONL + Chroma).
- **retrieval.py** : RAG sémantique + épisodique injecté en phase SENSE.
- **loop_guardrails.py** : cap d'itérations, détection de stagnation, budget.
- **tracing_eval.py** : LangSmith + LLM-as-Judge + porte de conformité.
- **tools.py** : registre d'outils sûrs (calc AST, fichiers confinés au
  workspace, stub web_search à brancher).
- **summarizer.py** : distillation épisodique → sémantique.
- **learning.py** : les 4 modes d'apprentissage.

## 4. Orchestrateur

`orchestrator/orchestrator_graph.py` : décomposition (DAG, plan par défaut
recherche → analyse → rédaction → revue, extensible via LLM planner),
contrats, exécution en ordre topologique, re-contractualisation automatique
avec les recommandations du juge en cas de non-conformité (max_retries).

Le miroir client (`apps/web/src/core/orchestrator.ts`) applique le même plan
et les mêmes contrats pour le mode démo local.

## 5. TRD KOMAÏ Coding (agent à architecture spécifique)

- **Rôle** : IDE agentique connecté à GitHub ; seul agent dont la page n'est
  pas la page standard à 5 onglets.
- **UI** (`components/koma/KomaCodingView.tsx`) : arborescence de fichiers,
  éditeur JetBrains Mono, **aperçu live** de `index.html` dans une iframe
  **sandboxée** (`sandbox=""` : aucun script, aucune same-origin) ; design
  borderless ; les prompts de codage passent par le méta-chat en adressant
  « KOMAÏ Coding ».
- **Production de code** : toute application produite suit l'arborescence
  agentique SOTA (`agent/core.py`, `agent/tools.py`, `agent/prompts/`…).
- **Résilience LLM** : failover en cascade côté harnais (le `JudgeGate` et le
  `build_llm` acceptent tout modèle de repli) ; les erreurs fournisseur ne
  cassent jamais la session (repli simulé côté client).

## 6. Modèle de données temps réel

Firestore :
- `projects/{id}` — projet + périmètres (map par uid, cf. règles) ;
- `projects/{id}/tasks/{taskId}` — contrat, statut, sortie, conformité ;
- `agents/{id}` — profils (le bureau) ;
- `work_events/{id}` — flux SENSE/PLAN/ACT/OBSERVE (index agent+timestamp).

Écritures de tâches réservées au backend (Admin SDK) ; le client est en
lecture seule sur l'exécution — il n'écrit que projets/périmètres qu'il possède.

## 7. Build & déploiement

```bash
npm run typecheck && npm run build     # dist/ ≈ 84 kB gzip initial
npx firebase-tools deploy --only hosting,firestore
```

Firebase importé dynamiquement : le SDK (~175 kB gzip) n'est chargé que si
`VITE_FIREBASE_*` est configuré. Headers de sécurité définis dans
`firebase.json` (nosniff, DENY frame, referrer-policy, permissions-policy).
