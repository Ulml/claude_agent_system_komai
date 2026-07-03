/**
 * Orchestrator client — decomposes a project goal into an end-to-end task
 * flow and simulates its execution in the browser.
 *
 * In production the real decomposition runs server-side in the LangGraph
 * orchestrator (`packages/agent_harness/orchestrator/orchestrator_graph.py`)
 * and this module only mirrors its state from Firestore. The local pipeline
 * below applies the SAME contract shapes (TaskSpecification → TaskOutput →
 * ConformityReport) so the UI is identical in both modes — Single Source of
 * Truth on the data contract, two interchangeable executors.
 */
import type { ConformityReport, TaskNode, TaskOutput, WorkEvent, WorkPhase } from './types';

let uid = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${uid++}`;

/**
 * Deterministic decomposition of a goal into a linear research→analysis→
 * writing→review flow. Mirrors the default plan of the Python orchestrator.
 */
export function decomposeGoal(projectId: string, title: string, goal: string): TaskNode[] {
  const mk = (
    n: number,
    taskTitle: string,
    agentId: string,
    objective: string,
    deliverable: string,
    dependsOn: string[]
  ): TaskNode => ({
    id: nextId(`${projectId}-t${n}`),
    projectId,
    title: taskTitle,
    agentId,
    status: 'pending',
    dependsOn,
    spec: {
      objective,
      constraints: ['Respecter les standards transversaux du projet', 'Sortie structurée (Pydantic)'],
      deliverableFormat: deliverable,
    },
    input: n === 1 ? goal : `Sortie de l'étape ${n - 1}`,
    output: null,
    conformity: null,
    accessible: true,
  });

  const t1 = mk(1, `Recherche — ${title}`, 'researcher', `Collecter le contexte nécessaire à : ${goal}`, 'dossier_recherche.md', []);
  const t2 = mk(2, `Analyse — ${title}`, 'analyst', 'Structurer et quantifier les éléments collectés.', 'analyse.md', [t1.id]);
  const t3 = mk(3, `Rédaction — ${title}`, 'writer', 'Produire le livrable final du projet.', 'livrable_final.md', [t2.id]);
  const t4 = mk(4, `Revue orchestrateur — ${title}`, 'orchestrator', 'Vérifier la cohérence de bout en bout et clôturer.', 'cloture.md', [t3.id]);
  return [t1, t2, t3, t4];
}

/** Phases emitted, in order, while a task "runs" locally. */
const PHASES: { phase: WorkPhase; label: string; detail: string }[] = [
  { phase: 'SENSE', label: 'Analyse du contrat', detail: 'Lecture de la TaskSpecification et des entrées.' },
  { phase: 'PLAN', label: 'Plan d’exécution', detail: 'Décomposition en étapes outillées.' },
  { phase: 'ACT', label: 'Exécution des outils', detail: 'Production de l’artefact demandé.' },
  { phase: 'OBSERVE', label: 'Contrôle du résultat', detail: 'Résultat conforme au format attendu.' },
];

const conformReport = (): ConformityReport => ({
  verdict: 'conform',
  score: 88 + Math.floor(Math.random() * 12),
  criteria: [
    { name: 'Respect du contrat', passed: true, comment: 'Objectif et contraintes couverts.' },
    { name: 'Standards du projet', passed: true, comment: 'Format et structure conformes.' },
  ],
  judgeModel: 'claude-sonnet-5',
  recommendations: ['Continuer à compacter le contexte pour réduire les tokens.'],
});

export interface FlowRunnerCallbacks {
  onTaskUpdate: (task: TaskNode) => void;
  onWorkEvent: (event: WorkEvent) => void;
  onDone: () => void;
}

/**
 * Runs a task flow locally: walks the DAG in dependency order, emitting
 * SENSE/PLAN/ACT/OBSERVE events then an output + judge report per task.
 * Returns a cancel function so unmounting the app stops the timers.
 */
export function runFlowLocally(tasks: TaskNode[], cb: FlowRunnerCallbacks): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let elapsed = 0;
  const schedule = (fn: () => void, delay: number) => {
    elapsed += delay;
    timers.push(setTimeout(fn, elapsed));
  };

  // Linear flows are the default local plan, so dependency order = array order.
  for (const task of tasks) {
    schedule(() => cb.onTaskUpdate({ ...task, status: 'running' }), 400);
    for (const p of PHASES) {
      schedule(() => {
        cb.onWorkEvent({
          id: nextId('w'),
          agentId: task.agentId,
          taskId: task.id,
          phase: p.phase,
          label: p.label,
          detail: p.detail,
          timestamp: Date.now(),
        });
      }, 700);
    }
    schedule(() => {
      const output: TaskOutput = {
        summary: `${task.spec.deliverableFormat} produit : ${task.spec.objective}`,
        artifacts: [task.spec.deliverableFormat],
        tokensUsed: 4_000 + Math.floor(Math.random() * 9_000),
      };
      cb.onTaskUpdate({ ...task, status: 'done', output, conformity: conformReport() });
    }, 700);
  }
  schedule(() => cb.onDone(), 300);

  return () => timers.forEach(clearTimeout);
}
