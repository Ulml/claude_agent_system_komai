/**
 * SINGLE SOURCE OF TRUTH — initial content of the AI Operating System.
 *
 * The agent STRUCTURE is standard (see packages/agent_harness): only the
 * content below differs between agents. A demo project with an end-to-end
 * task flow is seeded so every screen (desktop, flow, agent tabs, judge
 * reports, meta-tasks) renders meaningful data on first load.
 */
import {
  Bot,
  FolderTree,
  Gavel,
  GitBranch,
  LineChart,
  PenTool,
  Search,
  Terminal,
  UserRound,
  Workflow,
} from 'lucide-react';
import type {
  AgentFolder,
  AgentProfile,
  LearningEntry,
  LLMProvider,
  Project,
  TaskNode,
  WorkEvent,
} from './types';
import { propulsionFolder, spaceTechAgents, spaceTechFolder } from './seed_space_tech';
import { radProtectionAgents, radProtectionFolder } from './seed_rad_protection';
import { agentMethods } from './agent_methods';

/* ------------------------------------------------------------------ */
/* LLM providers — the app is LLM agnostic                             */
/* ------------------------------------------------------------------ */

export const seedProviders: LLMProvider[] = [
  {
    id: 'google',
    name: 'Google',
    protocol: 'google',
    models: ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash'],
    apiKey: '',
    isDefault: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    protocol: 'anthropic',
    models: ['claude-sonnet-5', 'claude-haiku-4-5'],
    apiKey: '',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    protocol: 'openai-compatible',
    models: ['gpt-5.2', 'gpt-5-mini'],
    apiKey: '',
  },
  {
    id: 'local-lmlite',
    name: 'LMLite (local)',
    protocol: 'openai-compatible',
    models: ['qwen3-coder', 'llama-4-scout'],
    apiKey: '',
    baseUrl: 'http://localhost:11434/v1',
  },
];

/* ------------------------------------------------------------------ */
/* Standard mermaid algorithm — one harness, shared by every agent     */
/* ------------------------------------------------------------------ */

const standardLoop = `flowchart TD
  SPEC[Spécification reçue de l'orchestrateur] --> SENSE[SENSE : analyse du contexte et des entrées]
  SENSE --> PLAN[PLAN : décomposition en étapes]
  PLAN --> ACT[ACT : exécution des outils]
  ACT --> OBSERVE[OBSERVE : lecture des retours]
  OBSERVE -->|itération| PLAN
  OBSERVE -->|terminé| JUDGE[JUGE : rapport de conformité]
  JUDGE -->|conforme| OUT[Output + rapport → agent suivant & orchestrateur]
  JUDGE -->|non conforme| PLAN`;

const mkReadme = (role: string, needs: string, delivers: string) => `# ${role}

## Ce dont il a besoin
${needs}

## Ce qu'il réalise
Il exécute sa boucle standard **SENSE → PLAN → ACT → OBSERVE** (harnais Hermes),
sous contrat de la *Spécification de tâche* reçue de l'orchestrateur.

## Ce qu'il livre
${delivers}

## Communication structurée
- **Reçoit** : \`TaskSpecification\` (contrat) de l'orchestrateur.
- **Envoie** : \`TaskOutput\` + \`ConformityReport\` à l'agent suivant et à l'orchestrateur.
`;

/* ------------------------------------------------------------------ */
/* Agents (humans included — same UI, same structure)                  */
/* ------------------------------------------------------------------ */

const rawAgents: AgentProfile[] = [
  {
    id: 'system-llm',
    name: 'LLM Général',
    kind: 'system',
    icon: Bot,
    tagline: 'Le modèle central du système',
    readme: mkReadme(
      'LLM Général',
      'Une question ou une intention utilisateur exprimée dans le méta-chat.',
      'Une réponse directe, ou un routage vers l’orchestrateur si la demande est un projet.'
    ),
    mermaidAlgorithm: standardLoop,
    skills: ['Dialogue multilingue', 'Routage d’intentions', 'Synthèse de contexte'],
    llmBinding: { providerId: 'google', model: 'gemini-3-flash-preview' },
    status: 'idle',
  },
  {
    id: 'orchestrator',
    name: 'Orchestrateur',
    kind: 'orchestrator',
    icon: Workflow,
    tagline: 'Décompose les projets et administre l’OS',
    readme: `# Orchestrateur

## Ce dont il a besoin
La description d'un projet utilisateur, potentiellement ultra-complexe
(centaines ou milliers d'étapes), ou une demande d'administration de l'OS
exprimée dans le méta-chat.

## Ce qu'il réalise
Il exécute sa boucle standard **SENSE → PLAN → ACT → OBSERVE** (harnais
Hermes) et supervise le flux de bout en bout des tâches contractualisées.

## Capacités d'administration de l'OS (outils dédiés)
- **create_folder / create_subfolder** : créer des dossiers et
  sous-dossiers d'agents sur le bureau (ex. « Technologies Spatiales →
  Propulsion », « → Protections Anti-Radiations »).
- **create_agent** : instancier un nouvel agent à partir du harnais
  standard — seul le contenu (README, skills, liaison LLM, modèle simulé)
  est spécifique.
- **verify_agent_sources** : vérifier chaque agent créé contre des
  **sources internet** via \`web_search\` (croisement des faits du README,
  citations datées), avec rapport de vérification soumis au Juge avant
  publication de l'agent sur le bureau.

## Règle SOTA imposée à tout agent créé (docs/AGENT_STANDARD.md)
\`create_agent\` REFUSE tout agent non-humain dépourvu d'une **méthode de
calcul conforme**, qui doit contenir les trois éléments :
1. un **graphe** de l'algorithme de calcul *données d'entrée → données de
   sortie* ;
2. l'**enchaînement des formules** mathématiques expliqué pour non-spécialiste ;
3. un **lien web vers la source SOTA** démontrant chaque partie du calcul.
La conformité est vérifiée avant publication ; l'agent est en outre validé
sur un **cas connu** (entrée → sortie attendue) pour prouver qu'il donne le
bon résultat.

## Ce qu'il livre
Un flux de tâches contractualisées avec suivi temps réel, et des agents /
dossiers créés, vérifiés et validés.

## Communication structurée
- **Émet** : \`TaskSpecification\` (contrats) vers chaque agent.
- **Reçoit** : \`TaskOutput\` + \`ConformityReport\` de chaque agent.`,
    mermaidAlgorithm: `flowchart TD
  GOAL[Objectif projet ou demande d'administration] --> ROUTE{Nature}
  ROUTE -->|projet| DECOMPOSE[Décomposition en tâches]
  DECOMPOSE --> ASSIGN[Assignation agent par tâche]
  ASSIGN --> CONTRACT[Émission des TaskSpecification]
  CONTRACT --> MONITOR[Supervision temps réel]
  MONITOR -->|rapport non conforme| REASSIGN[Réitération / réassignation]
  REASSIGN --> CONTRACT
  MONITOR -->|toutes conformes| DONE[Livraison projet]
  ROUTE -->|administration OS| ADMIN{Outil}
  ADMIN -->|create_folder / create_subfolder| FOLDER[Dossier ou sous-dossier créé]
  ADMIN -->|create_agent| AGENT[Agent instancié sur le harnais standard]
  AGENT --> METHOD[Méthode requise : graphe I/O + formules + sources SOTA]
  METHOD --> VERIFY[verify_agent_sources : web_search + citations]
  VERIFY --> CHECK[Vérif. sur cas connu : entrée → sortie attendue]
  CHECK --> JUDGE[Juge : conformité des faits & du calcul]
  JUDGE -->|conforme| PUBLISH[Agent publié sur le bureau]
  JUDGE -->|non conforme| AGENT`,
    skills: [
      'Décomposition hiérarchique',
      'Allocation de ressources',
      'Supervision LangGraph',
      'Création de dossiers & sous-dossiers',
      'Création d’agents (harnais standard)',
      'Vérification par sources internet',
      'Exigence méthode : graphe I/O + formules + sources SOTA',
    ],
    llmBinding: { providerId: 'anthropic', model: 'claude-sonnet-5' },
    status: 'idle',
  },
  {
    id: 'researcher',
    name: 'Chercheur',
    kind: 'worker',
    icon: Search,
    tagline: 'Recherche et vérification des faits',
    readme: mkReadme(
      'Agent Chercheur',
      'Un sujet de recherche et les contraintes de sources fiables.',
      'Un dossier de recherche sourcé au format Markdown.'
    ),
    mermaidAlgorithm: standardLoop,
    skills: ['Recherche web', 'Vérification croisée', 'Citation de sources'],
    llmBinding: { providerId: 'google', model: 'gemini-3-pro-preview' },
    status: 'idle',
  },
  {
    id: 'analyst',
    name: 'Analyste',
    kind: 'worker',
    icon: LineChart,
    tagline: 'Analyse de données structurées',
    readme: mkReadme(
      'Agent Analyste',
      'Des données brutes ou le dossier du Chercheur.',
      'Une analyse chiffrée avec tableaux et indicateurs.'
    ),
    mermaidAlgorithm: standardLoop,
    skills: ['Statistiques', 'Pandas / SQL', 'Data storytelling'],
    llmBinding: { providerId: 'openai', model: 'gpt-5.2' },
    status: 'idle',
  },
  {
    id: 'writer',
    name: 'Rédacteur',
    kind: 'worker',
    icon: PenTool,
    tagline: 'Rédaction des livrables finaux',
    readme: mkReadme(
      'Agent Rédacteur',
      'L’analyse validée et le style éditorial du projet.',
      'Le document final conforme aux standards transversaux du projet.'
    ),
    mermaidAlgorithm: standardLoop,
    skills: ['Rédaction FR/EN/ES', 'Mise en forme Markdown', 'Ton éditorial'],
    llmBinding: { providerId: 'local-lmlite', model: 'llama-4-scout' },
    status: 'idle',
  },
  {
    id: 'judge',
    name: 'Juge SOTA',
    kind: 'judge',
    icon: Gavel,
    tagline: 'Vérifie la conformité de chaque sortie',
    readme: mkReadme(
      'Juge SOTA 2026',
      'La TaskSpecification, l’output de l’agent et les standards transversaux du projet.',
      'Un ConformityReport (verdict, score, critères) qui alimente aussi l’apprentissage des agents.'
    ),
    mermaidAlgorithm: `flowchart TD
  IN[Output + Spécification + Standards] --> EVAL[Évaluation critère par critère]
  EVAL --> SCORE[Score global 0-100]
  SCORE -->|conforme| PASS[Rapport ✔ transmis]
  SCORE -->|non conforme| FAIL[Rapport ✘ + recommandations]
  FAIL --> LEARN[Mise à jour skills / harnais de l'agent jugé]`,
    skills: ['LLM-as-Judge', 'Grilles de critères', 'Boucle d’amélioration'],
    llmBinding: { providerId: 'anthropic', model: 'claude-sonnet-5' },
    status: 'idle',
  },
  {
    id: 'komai-coding',
    name: 'KOMAÏ Coding',
    kind: 'coding',
    icon: Terminal,
    tagline: 'IDE agentique connecté à GitHub',
    readme: mkReadme(
      'KOMAÏ Coding',
      'Un prompt de codage, un dépôt GitHub (PAT) et un harnais de directives.',
      'Des fichiers de code générés/modifiés, poussés sur GitHub, avec aperçu live.'
    ),
    mermaidAlgorithm: `flowchart TD
  PROMPT[Prompt de codage] --> SENSE[SENSE : lecture du workspace]
  SENSE --> PLAN[PLAN : stratégie de modification]
  PLAN --> ACT[ACT : écriture des fichiers]
  ACT --> OBSERVE[OBSERVE : compilation / aperçu]
  OBSERVE -->|erreur| PLAN
  OBSERVE -->|ok| PUSH[Push GitHub + rapport]`,
    skills: ['Structure de repo SOTA', 'Borderless UI', 'Failover LLM en cascade'],
    llmBinding: { providerId: 'google', model: 'gemini-3-flash-preview' },
    status: 'idle',
  },
  {
    id: 'curator',
    name: 'Curateur',
    kind: 'worker',
    icon: FolderTree,
    tagline: 'Propose des dossiers d’agents par méta-nœuds',
    readme: mkReadme(
      'Agent Curateur',
      'Le graphe des agents de l’OS (nœuds = agents, arêtes = affinités de rôle, de plateforme LLM et d’activité projet), ou n’importe quel groupe d’agents désigné par l’utilisateur.',
      'Des MÉTA-NŒUDS de regroupement — des propositions de dossiers argumentées, soumises à validation de l’utilisateur. Un méta-nœud accepté devient un dossier du bureau.'
    ),
    mermaidAlgorithm: `flowchart TD
  IN[Agents de l'OS ou groupe désigné] --> GRAPH[Construction du graphe d'agents]
  GRAPH --> EDGES[Arêtes pondérées : rôle +2, plateforme +1, activité +1]
  EDGES --> META[Création de méta-nœuds au-dessus des nœuds agents]
  META --> LOGIC{Logique}
  LOGIC -->|rôle| P1[Proposition par rôle]
  LOGIC -->|plateforme LLM| P2[Proposition par plateforme]
  LOGIC -->|activité projet| P3[Proposition par activité]
  LOGIC -->|périmètre désigné| P4[Méta-nœud sur le groupe choisi]
  P1 & P2 & P3 & P4 --> USER[Validation utilisateur]
  USER -->|accepté| FOLDER[Dossier créé sur le bureau]
  USER -->|refusé| DROP[Méta-nœud abandonné]`,
    skills: ['Graphes d’affinité', 'Méta-nœuds de regroupement', 'Dé-duplication de dossiers'],
    llmBinding: { providerId: 'google', model: 'gemini-3-flash-preview' },
    status: 'idle',
  },
  {
    id: 'user-owner',
    name: 'Camille (vous)',
    kind: 'human',
    icon: UserRound,
    tagline: 'Utilisateur — propriétaire du projet',
    readme: mkReadme(
      'Utilisateur propriétaire',
      'Les tâches de son périmètre et les rapports de conformité.',
      'Des validations, remarques et demandes qui nourrissent l’apprentissage des agents.'
    ),
    mermaidAlgorithm: standardLoop,
    skills: ['Validation métier', 'Priorisation'],
    llmBinding: { providerId: 'google', model: 'gemini-3-flash-preview' },
    status: 'idle',
  },
  {
    id: 'user-guest',
    name: 'Alex (invité)',
    kind: 'human',
    icon: GitBranch,
    tagline: 'Utilisateur — périmètre restreint',
    readme: mkReadme(
      'Utilisateur invité',
      'Uniquement les tâches de son périmètre ; le reste apparaît en méta-tâches.',
      'Des contributions limitées à son périmètre d’accès.'
    ),
    mermaidAlgorithm: standardLoop,
    skills: ['Revue de livrables'],
    llmBinding: { providerId: 'google', model: 'gemini-3-flash-preview' },
    status: 'idle',
  },
  // Simulateurs « Technologies Spatiales » (fichiers dédiés) :
  // sous-dossier Propulsion + sous-dossier Protections Anti-Radiations.
  ...spaceTechAgents,
  ...radProtectionAgents,
];

/**
 * Attach the mandatory computation method (graph + explained formulas + SOTA
 * links) to EVERY agent from the SSOT map. This is what enforces the rule
 * uniformly across the OS — an agent without a method entry is flagged by the
 * UI's conformity badge.
 */
export const seedAgents: AgentProfile[] = rawAgents.map((a) => ({
  ...a,
  method: agentMethods[a.id] ?? a.method,
}));

/* ------------------------------------------------------------------ */
/* Desktop folders — group agents on the home screen (iOS-style)       */
/* ------------------------------------------------------------------ */

export const seedFolders: AgentFolder[] = [
  {
    id: 'folder-production',
    name: 'Pôle Production',
    agentIds: ['researcher', 'analyst', 'writer'],
  },
  {
    id: 'folder-users',
    name: 'Utilisateurs',
    agentIds: ['user-owner', 'user-guest'],
  },
  spaceTechFolder,
  propulsionFolder,
  radProtectionFolder,
];

/* ------------------------------------------------------------------ */
/* Demo project with an end-to-end flow (incl. one meta-task)          */
/* ------------------------------------------------------------------ */

export const seedProject: Project = {
  id: 'proj-demo',
  title: 'Étude marché — batteries sodium',
  description:
    'Produire une étude de marché complète sur les batteries sodium-ion : recherche, analyse chiffrée, rapport final.',
  createdAt: Date.now() - 86_400_000,
  isLocked: false,
  perimeters: [
    { memberId: 'user-owner', taskIds: ['t1', 't2', 't3', 't4'], role: 'owner' },
    { memberId: 'user-guest', taskIds: ['t3'], role: 'viewer' },
  ],
};

const conformOk = (judge: string): TaskNode['conformity'] => ({
  verdict: 'conform',
  score: 94,
  criteria: [
    { name: 'Respect du contrat', passed: true, comment: 'Tous les points de la spécification sont couverts.' },
    { name: 'Standards du projet', passed: true, comment: 'Format Markdown et sources citées.' },
    { name: 'Qualité organisationnelle', passed: true, comment: 'Structure claire, transmissible à l’agent suivant.' },
  ],
  judgeModel: judge,
  recommendations: ['Réduire de ~12% les tokens en compactant la phase SENSE.'],
});

export const seedTasks: TaskNode[] = [
  {
    id: 't1',
    projectId: 'proj-demo',
    title: 'Recherche documentaire',
    agentId: 'researcher',
    status: 'done',
    dependsOn: [],
    spec: {
      objective: 'Constituer un dossier sourcé sur le marché des batteries sodium-ion (2023-2026).',
      constraints: ['Sources < 18 mois', 'Minimum 12 références', 'Format Markdown'],
      deliverableFormat: 'dossier_recherche.md',
    },
    input: 'Description du projet + standards transversaux (style, citations).',
    output: {
      summary: 'Dossier de 14 sources : fabricants, coûts au kWh, feuilles de route CATL/BYD/Northvolt.',
      artifacts: ['dossier_recherche.md'],
      tokensUsed: 18_420,
    },
    conformity: conformOk('claude-sonnet-5'),
    accessible: true,
  },
  {
    id: 't2',
    projectId: 'proj-demo',
    title: 'Analyse chiffrée',
    agentId: 'analyst',
    status: 'running',
    dependsOn: ['t1'],
    spec: {
      objective: 'Quantifier TAM/SAM/SOM et courbes de coût à partir du dossier de recherche.',
      constraints: ['Hypothèses explicites', 'Tableaux comparatifs', 'Unités SI'],
      deliverableFormat: 'analyse_marche.md',
    },
    input: 'dossier_recherche.md (sortie de t1).',
    output: null,
    conformity: { verdict: 'pending', score: 0, criteria: [], judgeModel: 'claude-sonnet-5', recommendations: [] },
    accessible: true,
  },
  {
    id: 't3',
    projectId: 'proj-demo',
    title: 'Rédaction du rapport final',
    agentId: 'writer',
    status: 'pending',
    dependsOn: ['t2'],
    spec: {
      objective: 'Rédiger le rapport final de l’étude, prêt à publier.',
      constraints: ['20 pages max', 'Résumé exécutif en tête', 'FR'],
      deliverableFormat: 'rapport_final.md',
    },
    input: 'analyse_marche.md (sortie de t2).',
    output: null,
    conformity: null,
    accessible: true,
  },
  {
    id: 't4',
    projectId: 'proj-demo',
    title: 'Revue stratégique confidentielle',
    agentId: 'orchestrator',
    status: 'pending',
    dependsOn: ['t3'],
    spec: {
      objective: 'Revue confidentielle (pricing interne) — accessible au propriétaire uniquement.',
      constraints: ['Confidentiel'],
      deliverableFormat: 'revue_confidentielle.md',
    },
    input: 'rapport_final.md',
    output: null,
    conformity: null,
    // Rendered as a META-TASK for any member whose perimeter excludes t4.
    accessible: true,
  },
];

/* ------------------------------------------------------------------ */
/* Live work stream & learning entries                                 */
/* ------------------------------------------------------------------ */

export const seedWorkEvents: WorkEvent[] = [
  { id: 'w1', agentId: 'researcher', taskId: 't1', phase: 'SENSE', label: 'Lecture de la spécification', detail: 'Contraintes : sources < 18 mois, 12 références minimum.', timestamp: Date.now() - 7_200_000 },
  { id: 'w2', agentId: 'researcher', taskId: 't1', phase: 'PLAN', label: 'Plan de recherche en 4 axes', detail: 'Fabricants, coûts, brevets, feuilles de route.', timestamp: Date.now() - 7_100_000 },
  { id: 'w3', agentId: 'researcher', taskId: 't1', phase: 'ACT', label: 'web_search ×14', detail: '14 sources collectées et déduplicables.', timestamp: Date.now() - 6_900_000 },
  { id: 'w4', agentId: 'researcher', taskId: 't1', phase: 'OBSERVE', label: 'Contrôle de fraîcheur', detail: 'Toutes les sources datent de moins de 18 mois. Boucle terminée.', timestamp: Date.now() - 6_800_000 },
  { id: 'w5', agentId: 'analyst', taskId: 't2', phase: 'SENSE', label: 'Ingestion du dossier t1', detail: 'Extraction des chiffres de coût au kWh.', timestamp: Date.now() - 600_000 },
  { id: 'w6', agentId: 'analyst', taskId: 't2', phase: 'PLAN', label: 'Modèle TAM/SAM/SOM', detail: 'Trois scénarios : conservateur, médian, agressif.', timestamp: Date.now() - 300_000 },
  { id: 'w7', agentId: 'analyst', taskId: 't2', phase: 'ACT', label: 'calculate(cost_curve)', detail: 'Courbe de coût 2024→2030 en cours de calcul…', timestamp: Date.now() - 60_000 },
];

export const seedLearning: LearningEntry[] = [
  {
    id: 'l1',
    agentId: 'researcher',
    mode: 'judge-feedback',
    summary: 'Le juge recommande de compacter la phase SENSE (−12% tokens).',
    appliedToSkill: 'Recherche web',
    timestamp: Date.now() - 6_000_000,
  },
  {
    id: 'l2',
    agentId: 'writer',
    mode: 'user-feedback',
    summary: 'Camille demande un résumé exécutif systématique en tête de rapport.',
    appliedToSkill: 'Mise en forme Markdown',
    timestamp: Date.now() - 4_000_000,
  },
  {
    id: 'l3',
    agentId: 'analyst',
    mode: 'task-replay',
    summary: 'Rejeu de l’analyse lithium 2025 : entrées + résultat appris comme référence.',
    appliedToSkill: 'Data storytelling',
    timestamp: Date.now() - 3_000_000,
  },
  {
    id: 'l4',
    agentId: 'analyst',
    mode: 'expected-example',
    summary: 'Paire (données_brutes.csv → analyse_attendue.md) intégrée à la mémoire procédurale.',
    appliedToSkill: 'Statistiques',
    timestamp: Date.now() - 2_000_000,
  },
];
