# AGENT_STANDARD — Règle de descriptif de calcul (tous les agents)

Cette règle s'applique à **tous les agents de l'OS** (SSOT :
`apps/web/src/core/agent_methods.ts`, contrat Pydantic
`contracts.ComputeMethod`).

## Les trois éléments obligatoires

Chaque agent expose, dans l'onglet **Présentation** de sa page, une section
**« Méthode de calcul (entrée → sortie) »** contenant :

1. **Un graphe de l'algorithme de calcul** *données d'entrée → données de
   sortie* (Mermaid).
2. **L'enchaînement des formules mathématiques**, chacune **expliquée pour
   un non-spécialiste** (nom, formule, explication en langage clair).
3. **Un lien web vers la source SOTA** démontrant chaque partie du calcul.

Un **badge de conformité** indique si les trois éléments sont présents.

## Preuve que « ça donne le bon résultat »

Chaque agent porte des **vérifications numériques** (`checks`) : un cas connu
(entrée → sortie attendue), calculé par les fonctions réelles de
`core/simulators.ts`, comparé à une valeur de référence indépendante issue de
la source SOTA. Le test `apps/web/tests/agent_methods.test.mjs` exécute tous
ces checks (21/21 verts au dernier build) et vérifie que les 22 méthodes sont
conformes et que toutes les URL SOTA sont bien formées.

## Application côté agent créateur

L'agent **Orchestrateur** (créateur d'agents) impose la règle par ses outils
(`packages/agent_harness/orchestrator/os_admin_tools.py`) :

- `create_agent` **refuse** tout agent non-humain sans `ComputeMethod`
  conforme (graphe + formules + sources).
- `verify_agent_sources` **contrôle** explicitement les trois éléments puis
  vérifie chaque lien SOTA via `web_search` avant publication ; le rapport
  passe la porte du Juge.

Les agents **humains** (`kind = human`) sont exemptés de l'exigence de
formules (leur « calcul » est un jugement humain) mais conservent un graphe
entrée → décision et une source (humain dans la boucle / RLHF).

## Couverture actuelle (22 agents)

| Groupe | Agents |
| --- | --- |
| Système | LLM Général, Orchestrateur, Curateur, Juge, Chercheur, Analyste, Rédacteur, KOMAÏ Coding |
| Propulsion | Chimique, Ionique, Ascenseur, Nucléaire, Voile solaire, Tether, Warp, Faisceau |
| Anti-radiations | Blindage passif, actif, Bio & Ops, Blindage réacteur |
| Humains | Camille (propriétaire), Alex (invité) — exemptés de formules |

Chaque simulateur physique est calé sur des valeurs SOTA vérifiées
(Tsiolkovsky, ISP, pression de radiation à 1361 W/m², altitude GEO 35 786 km,
force de faisceau 2P/c, atténuation Beer–Lambert, dose efficace ICRP, etc.).
Le Warp Drive est marqué **théorique** (pas de vérification expérimentale
possible), avec formule d'ordre de grandeur et sources — position SOTA honnête.
