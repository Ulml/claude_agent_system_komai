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
- **Dossiers d'agents** : les agents peuvent être regroupés à l'écran dans
  des dossiers (façon iOS). La tuile d'un dossier a la même forme de carré
  arrondi qu'une icône d'agent ; les agents membres y apparaissent en
  miniature (grille 2×2, badge « +n » au-delà de 4). L'ouverture du dossier
  révèle les cartes complètes ; les agents d'un dossier ne sont pas répétés
  au niveau racine du bureau.
- **Dossiers créés par l'utilisateur** : bouton « Nouveau dossier »
  (nom + choix libre des agents), mode **Sélection** pour désigner un groupe
  d'agents directement sur le bureau, suppression d'un dossier depuis sa vue
  ouverte (les agents retournent à la racine). Un agent vit dans un seul
  dossier : l'ajouter ailleurs l'y déplace.
- **Sous-dossiers** : les dossiers s'imbriquent (`parentId`). Un dossier
  parent affiche ses sous-dossiers en tuiles dans sa vue ouverte, avec une
  flèche retour ; seuls les dossiers racine tuilent le bureau. Exemple livré :
  « Technologies Spatiales » → « Propulsion » (8 simulateurs) et
  « Protections Anti-Radiations » (4 simulateurs).
- **Orchestrateur — administration de l'OS** : l'orchestrateur sait, par
  outils dédiés, faire ce que l'utilisateur fait à la main : `create_folder`
  / `create_subfolder` (dossiers et sous-dossiers), `create_agent`
  (instancier un agent sur le harnais standard) et `verify_agent_sources`
  (vérifier chaque agent créé contre des **sources internet** via
  `web_search`, rapport de conformité soumis au juge avant publication).
  Outils : `packages/agent_harness/orchestrator/os_admin_tools.py` ;
  primitives client : `AppContext.createFolder` / `createAgent`.
- **Agent Curateur (méta-nœuds)** : agent dédié qui raisonne sur le **graphe
  des agents** (nœuds = agents ; arêtes pondérées : rôle +2, plateforme LLM
  +1, activité projet +1) et crée des **méta-nœuds de regroupement**
  au-dessus des nœuds agents. Il propose des dossiers selon plusieurs
  logiques (rôle, plateforme LLM, activité projet) sur tout l'OS, ou un
  méta-nœud sur **n'importe quel groupe d'agents désigné** par l'utilisateur
  via le mode Sélection. Chaque proposition est soumise à validation
  (Valider → dossier créé ; Refuser → méta-nœud abandonné) ; les
  regroupements identiques à un dossier existant sont dédupliqués.
  Moteur : `apps/web/src/core/curator.ts`, miroir Python
  `packages/agent_harness/core/curator.py`.

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
- **Identification & invitations** : l'utilisateur s'identifie à la connexion
  et voit l'environnement autorisé pour lui (tout par défaut). Il n'y a pas
  de liste déroulante d'utilisateurs. Un utilisateur qui invite ne peut
  accorder que tout ou partie de ce à quoi il a lui-même accès ; s'il désigne
  un agent auquel il n'a pas accès, une **demande est envoyée au
  propriétaire**, qui décide d'accorder l'accès à l'invité seul ou aux deux
  (invitant + invité). Voir `AppContext.invite/resolveRequest` et
  `components/modals/InviteModal.tsx`.

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
