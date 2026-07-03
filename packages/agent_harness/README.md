# @template-lm/agent_harness

Le **harnais standard** de tous les agents de Template_LM : une seule boucle
LangGraph (`SENSE → PLAN → ACT → OBSERVE → porte du juge`), instanciée une
fois par agent. Architecture inspirée de l'agent
[Hermes](https://github.com/nousresearch/hermes-agent).

**La structure est identique pour tous les agents** ; seul le contenu change :
persona, skills (mémoire procédurale), liaison LLM et outils.

```
agent_harness/
├── core/
│   ├── harness_graph.py   # Le graphe LangGraph complet (le "HARNESS")
│   ├── memory_layer.py    # Procedural + Semantic + Episodic (Chroma optionnel)
│   ├── retrieval.py       # RAGRetriever (semantic + episodic)
│   ├── loop_guardrails.py # Loop engineering + garde-fous de fin de boucle
│   ├── tracing_eval.py    # LLM Ops (LangSmith + LLM-as-Judge + porte de conformité)
│   ├── tools.py           # Tool calling (web_search, calculate, fichiers confinés)
│   ├── summarizer.py      # Agent résumeur (épisodique → sémantique)
│   └── learning.py        # Les 4 modes d'apprentissage
├── orchestrator/
│   └── orchestrator_graph.py  # Décomposition projet → flux de tâches + supervision
├── skills/example_skills.md   # Mémoire procédurale initiale
├── config/default_persona.json# Mémoire sémantique initiale
├── main.py                    # Point d'entrée CLI (tâche unique ou flux complet)
├── requirements.txt
└── .env.example
```

## Démarrage

```bash
pip install -r requirements.txt -e ../shared_contracts
cp .env.example .env            # renseigner LLM_PROVIDER / LLM_MODEL / clé
python main.py "Rédige une note sur les batteries sodium-ion"
python main.py --flow "Étude de marché batteries sodium-ion"
```

## Agnosticisme LLM

Le harnais reçoit **n'importe quel chat model LangChain** ; chaque agent du
pool peut donc être lié à un fournisseur différent (API cloud ou runtime
local type Ollama/LMLite) — voir `main.py::build_llm`.

## Contrats

Toutes les entrées/sorties sont des modèles Pydantic de
`packages/shared_contracts` : `TaskSpecification` (reçue), `TaskOutput` +
`ConformityReport` (émis vers l'agent suivant et l'orchestrateur).
