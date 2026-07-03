# PRD — Template_LM (Système d'exploitation IA)

Ce document est la source unique des exigences produit de Template_LM,
synthèse des PRD de TemplateLM_1 et de KOMA-Coding-Base.

## 1. Vision

Une application web responsive tout device, opérant dans le navigateur et
hébergée sur Firebase (Google Cloud), qui se comporte comme un **système
d'exploitation d'agents IA** : des agents autonomes persistants, visibles en
icônes sur un bureau, interconnectés et orchestrés pour résoudre des projets
comportant des centaines voire des milliers d'étapes.

## 2. Le méta-chat

- **Une seule fenêtre de chat** + des onglets de navigation juste au-dessus,
  présents sur **toutes** les pages (`MetaChatDock`).
- Le sélecteur de destinataire permet de parler au **LLM général**, à
  l'**orchestrateur**, à n'importe quel **agent** (juge et KOMAÏ inclus).
- L'historique s'ouvre en surcouche de verre au-dessus de la zone de saisie.

## 3. Cycle de vie d'un projet

1. Création du projet (nom + objectif) via la modale Projet.
2. L'orchestrateur décompose l'objectif en un **flux de bout en bout** de
   tâches ; chaque tâche reçoit une `TaskSpecification` (contrat) et un agent.
3. Exécution supervisée : statuts temps réel, événements de travail
   SENSE/PLAN/ACT/OBSERVE, sortie (`TaskOutput`) et rapport du juge
   (`ConformityReport`) par tâche.
4. Tous ces éléments sont visibles en temps réel dans la vue **Flux** et sur
   la page de chaque agent.

## 4. Les agents

- **Structure standard unique** (harnais Hermes, `packages/agent_harness`) ;
  seul le contenu varie : persona, skills, mémoire, liaison LLM, outils.
- **LLM agnostique** : chaque agent est lié à un fournisseur+modèle
  quelconque (API cloud ou local — Ollama/LMLite).
- **Page web dédiée par agent**, 5 onglets (le minimum requis est 4) :
  1. *Présentation* — README (besoins, méthode, livrables) + algorithme Mermaid ;
  2. *Entrées* — inputs et contrats reçus ;
  3. *Travail en direct* — le flux SENSE/PLAN/ACT/OBSERVE en dynamique ;
  4. *Conformité* — les rapports du juge sur ses sorties ;
  5. *Apprentissage* — les 4 modes et les mises à jour de skills appliquées.
- **Exception** : KOMAÏ Coding, IDE de codage connecté à GitHub, conserve son
  architecture spécifique (fichiers, éditeur, aperçu live, harnais — voir TRD).
- **Les humains sont des agents** : même carte sur le bureau, même page.

## 5. Communication structurée inter-agents

| Message | Direction | Modèle |
| --- | --- | --- |
| Contrat | orchestrateur → agent | `TaskSpecification` |
| Résultat | agent → agent suivant + orchestrateur | `TaskOutput` |
| Conformité | juge → agent suivant + orchestrateur | `ConformityReport` |

Aucun texte libre inter-agents : tout passe par ces modèles Pydantic
(`packages/shared_contracts`), sérialisés en JSON via LangChain/LangGraph.

## 6. Multi-utilisateurs & périmètres

- Un projet définit des **périmètres** : `{membre, rôle, liste de tâches}`.
- Un membre ne voit que les tâches de son périmètre ; les autres sont
  remplacées par des **méta-tâches** qui révèlent uniquement la structure du
  projet (avant / après / entre ses tâches).
- Application double : côté client (`AppContext.visibleTasks`) et côté
  serveur (`firebase/firestore.rules`).
- Le sélecteur d'utilisateur de la barre supérieure permet de constater la
  bascule périmètre → méta-tâches en démo.

## 7. Apprentissage des agents (4 modes)

1. **Juge SOTA 2026** : ses recommandations réécrivent les skills/harnais
   pour réduire itérations et tokens à la prochaine exécution.
2. **Remarques utilisateur** : même effet, déclenché depuis le méta-chat.
3. **Rejeu** : fichier d'entrées + résultat d'une tâche déjà accomplie.
4. **Exemple attendu** : fichiers d'entrée + fichier de résultat attendu.

Implémentation : `packages/agent_harness/core/learning.py` ; visualisation :
onglet *Apprentissage* de chaque page agent.

## 8. Réglages

- 7 thèmes glassmorphiques, langues FR/EN/ES, gestion des plateformes LLM
  (nom, modèles, clé API masquée, URL locale) — plafond de 10 plateformes.

## 9. Non-fonctionnel

- Responsive mobile → desktop (grilles adaptatives, cibles tactiles ≥ 44 px).
- Publiable immédiatement : `npm run build` → Firebase Hosting.
- Mode démo local intégral sans clé ni backend.
- Code lisible par un développeur peu expérimenté en agentic coding :
  commentaires d'intention en tête de chaque fichier, SSOT systématique.
