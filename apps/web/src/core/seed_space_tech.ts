/**
 * SINGLE SOURCE OF TRUTH — le dossier « Technologies Spatiales ».
 *
 * Huit agents SIMULATEURS de technologies de propulsion/accès à l'espace.
 * Tous sont des instances de l'agent STANDARD (même harnais Hermes, même
 * boucle SENSE → PLAN → ACT → OBSERVE, même page à 5 onglets) : seul le
 * contenu change — README technique, modèle physique simulé, compétences,
 * liaison LLM. Importés par core/seed.ts et regroupés dans le dossier
 * `spaceTechFolder` affiché sur le bureau.
 */
import {
  ArrowUpFromLine,
  Cable,
  Orbit,
  Radiation,
  Rocket,
  SatelliteDish,
  Sun,
  Zap,
} from 'lucide-react';
import type { AgentFolder, AgentProfile } from './types';

/** Boucle Mermaid commune à tous les simulateurs ; seul le modèle varie.
 *  (Exportée : réutilisée par seed_rad_protection.ts — SSOT.) */
export const mkSimulatorMermaid = (model: string) => `flowchart TD
  IN[Scénario de mission : masse, delta-v, durée, charge utile] --> SENSE[SENSE : validation des paramètres]
  SENSE --> PLAN[PLAN : choix du pas d'intégration et des hypothèses]
  PLAN --> MODEL[ACT : ${model}]
  MODEL --> INTEG[Intégration numérique de la trajectoire]
  INTEG --> OBSERVE[OBSERVE : convergence, bilans masse/énergie]
  OBSERVE -->|non convergé| PLAN
  OBSERVE -->|convergé| JUDGE[JUGE : conformité physique du rapport]
  JUDGE --> OUT[Rapport de simulation → orchestrateur]`;

/** README type d'un simulateur : besoins/livrables standard + fiche techno.
 *  (Exporté : réutilisé par seed_rad_protection.ts — SSOT.) */
export const mkSimReadme = (title: string, body: string) => `# Simulateur — ${title}

## Ce dont il a besoin
Un scénario de mission (masse du vaisseau, delta-v visé, durée, charge
utile) transmis via \`TaskSpecification\` par l'orchestrateur.

## Ce qu'il livre
Un rapport de simulation structuré (\`TaskOutput\`) : trajectoire, bilans de
masse et d'énergie, faisabilité, accompagné du rapport de conformité du juge.

${body}
`;

export const spaceTechAgents: AgentProfile[] = [
  {
    id: 'sim-chemical',
    name: 'Propulsion Chimique',
    kind: 'worker',
    icon: Rocket,
    tagline: 'Simulateur de fusées chimiques (base actuelle)',
    readme: mkSimReadme(
      'Propulsion chimique (Chemical Rockets)',
      `## Fonctionnement
Mélange d'un carburant (ex. kérosène RP-1) et d'un oxydant (ex. oxygène
liquide) dans une chambre de combustion. Les gaz chauds sont expulsés à
grande vitesse par une tuyère ; par la 3e loi de Newton (action-réaction),
la fusée est propulsée dans la direction opposée.

## Exemples
- Falcon 9 et la plupart des lanceurs actuels.

## Avantages
- Forte poussée (thrust), idéale pour décoller de Terre.

## Inconvénients
- Faible impulsion spécifique (ISP ~300-500 s) → beaucoup de carburant
  (~72% de la masse d'un Falcon 9 est du fuel).
- Limité pour les longs voyages (Mars ou au-delà).

## État
Technologie **mature**, utilisée pour tous les lancements et la plupart des
manœuvres spatiales.`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('combustion + équation de Tsiolkovsky (ISP 300-500 s)'),
    skills: ['Équation de Tsiolkovsky', 'Chimie de combustion RP-1/LOX', 'Étagement de lanceurs'],
    llmBinding: { providerId: 'google', model: 'gemini-3-flash-preview' },
    status: 'idle',
  },
  {
    id: 'sim-ion',
    name: 'Moteurs Ioniques',
    kind: 'worker',
    icon: Zap,
    tagline: 'Simulateur de propulsion électrique',
    readme: mkSimReadme(
      'Moteurs ioniques / Propulsion électrique (Ion Engines / Electric Thrusters)',
      `## Fonctionnement
L'électricité (souvent de panneaux solaires) ionise un gaz propulseur
(xénon ou krypton) et l'accélère via des champs électriques ou magnétiques
jusqu'à ~140 000 km/h. Les ions expulsés génèrent une poussée faible mais
continue.
- **Gridded Ion Thruster** : grille électrostatique accélérant les ions.
- **Hall Effect Thruster** : champ magnétique piégeant les électrons pour
  ioniser et accélérer le gaz.

## Avantages
- ISP très élevée (~3 000-10 000 s, jusqu'à 10× les moteurs chimiques) →
  très économe en carburant.
- Durée de vie longue (années).

## Inconvénients
- Poussée très faible (pas de décollage possible).
- Nécessite une source d'énergie électrique puissante.

## État
**Utilisé** (mission Dawn de la NASA vers les astéroïdes, Starlink).
Technologie mature pour missions interplanétaires.`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('ionisation xénon + accélération électrostatique (ISP 3k-10k s)'),
    skills: ['Physique des plasmas', 'Effet Hall', 'Optimisation poussée continue'],
    llmBinding: { providerId: 'anthropic', model: 'claude-sonnet-5' },
    status: 'idle',
  },
  {
    id: 'sim-elevator',
    name: 'Ascenseur Spatial',
    kind: 'worker',
    icon: ArrowUpFromLine,
    tagline: 'Simulateur de câble géostationnaire',
    readme: mkSimReadme(
      'Ascenseur spatial (Space Elevator)',
      `## Fonctionnement
Un câble ultra-résistant (ex. nanotubes de carbone) ancré à l'Équateur et
s'étendant jusqu'à une station géostationnaire (~36 000 km). Des cabines
grimpent le long du câble grâce à des moteurs électriques ou des
contre-poids ; l'énergie centrifuge de la rotation terrestre aide à
maintenir la structure.

## Avantages
- Accès à l'espace à faible coût énergétique (pas d'énorme fusée).
- Transport massif de charge utile.

## Inconvénients
- Matériaux extrêmes requis (tensions énormes sur le câble).
- Risques : météorites, vents, instabilités.
- Coût initial colossal.

## État
**Conceptuel**, mais des études sérieuses existent (ex. Obayashi
Corporation). Pas encore réalisable avec les matériaux actuels.`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('tension du câble + dynamique cabine/contre-poids GEO'),
    skills: ['Résistance des nanotubes', 'Mécanique orbitale GEO', 'Dynamique de câble'],
    llmBinding: { providerId: 'openai', model: 'gpt-5.2' },
    status: 'idle',
  },
  {
    id: 'sim-nuclear',
    name: 'Fusées Nucléaires',
    kind: 'worker',
    icon: Radiation,
    tagline: 'Simulateur NTP / nucléaire-électrique',
    readme: mkSimReadme(
      'Fusées nucléaires (Nuclear Rockets)',
      `## Fonctionnement
- **Nuclear Thermal Propulsion (NTP)** : un réacteur nucléaire chauffe un
  propulseur (hydrogène) expulsé à très haute température/vitesse — pas de
  combustion chimique.
- **Nuclear Electric** : le réacteur produit de l'électricité pour
  alimenter des moteurs ioniques ou plasma.

## Avantages
- ISP bien supérieure aux chimiques (800-9 000+ s).
- Efficacité pour les voyages longs (Mars en mois au lieu d'années).
- Moins de carburant embarqué.

## Inconvénients
- Complexité, radiations, régulations internationales strictes,
  développement lent.

## État
**En développement avancé** (NASA, projet DRACO…). Prometteur pour les
missions habitées vers Mars.`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('thermique réacteur → détente H2 (ISP 800-9000+ s)'),
    skills: ['Neutronique de réacteur', 'Thermo-hydraulique H2', 'Radioprotection'],
    llmBinding: { providerId: 'google', model: 'gemini-3-pro-preview' },
    status: 'idle',
  },
  {
    id: 'sim-solar-sail',
    name: 'Voiles Solaires',
    kind: 'worker',
    icon: Sun,
    tagline: 'Simulateur de pression de radiation',
    readme: mkSimReadme(
      'Voiles solaires (Solar Sails)',
      `## Fonctionnement
Grande voile réfléchissante (mylar ou matériaux avancés) qui capte la
pression de radiation des photons du Soleil (ou de lasers). Les photons
exercent une force minuscule mais continue, accélérant le vaisseau sans
carburant.

## Avantages
- Pas de propulseur ni carburant → voyages très longs possibles.
- Vitesse cumulative sur des années.

## Inconvénients
- Accélération très lente.
- Dépend de la proximité du Soleil (ou d'un laser puissant).
- Manœuvres limitées.

## État
**Démontré** (missions JAXA IKAROS, tests NASA). Progrès sur les mâts/booms
déployables. Idéal pour sondes interplanétaires ou interstellaires légères.`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('pression photonique ∝ 1/r² + orientation de voile'),
    skills: ['Pression de radiation', 'Matériaux réfléchissants', 'Trajectoires spirales'],
    llmBinding: { providerId: 'local-lmlite', model: 'llama-4-scout' },
    status: 'idle',
  },
  {
    id: 'sim-tether',
    name: 'Câbles Spatiaux',
    kind: 'worker',
    icon: Cable,
    tagline: 'Simulateur de tethers électrodynamiques',
    readme: mkSimReadme(
      'Câbles spatiaux / Tethers (Space Tethers)',
      `## Fonctionnement
Long câble en orbite qui utilise l'interaction avec le champ magnétique
terrestre (électrodynamique) ou la gravité/rotation pour générer de
l'énergie ou de la poussée. Peut « lancer » des charges utiles ou propulser
un vaisseau en échangeant du moment cinétique.

## Avantages
- Économie de carburant.
- Génération d'énergie.
- Propulsion « gratuite » via les forces orbitales.

## Inconvénients
- Déploiement et stabilité complexes.
- Risques de rupture.

## État
**Concepts avancés** et tests en orbite limités. Potentiel pour orbites
basses ou transferts.`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('force de Lorentz + échange de moment cinétique'),
    skills: ['Électrodynamique orbitale', 'Stabilité de câble', 'Transferts de moment'],
    llmBinding: { providerId: 'anthropic', model: 'claude-haiku-4-5' },
    status: 'idle',
  },
  {
    id: 'sim-warp',
    name: 'Warp Drive',
    kind: 'worker',
    icon: Orbit,
    tagline: 'Simulateur de métrique d’Alcubierre',
    readme: mkSimReadme(
      'Warp Drive (Alcubierre Drive)',
      `## Fonctionnement
Inspiré de la relativité générale : création d'une « bulle » d'espace-temps
— contraction devant le vaisseau, expansion derrière — permettant un
déplacement effectif plus rapide que la lumière sans violer localement la
vitesse de la lumière. Nécessite une énergie négative exotique (matière
exotique).

## Avantages
- Voyages interstellaires rapides (années au lieu de millénaires).

## Inconvénients
- Énergie massive requise.
- Physique non démontrée (matière exotique hypothétique).
- Problèmes de stabilité et de causalité.

## État
**Purement théorique**, mais les modèles mathématiques ont évolué
(réduction des besoins énergétiques). Très spéculatif.`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('métrique d’Alcubierre + densité d’énergie négative'),
    skills: ['Relativité générale', 'Conditions d’énergie', 'Métriques exotiques'],
    llmBinding: { providerId: 'openai', model: 'gpt-5-mini' },
    status: 'idle',
  },
  {
    id: 'sim-beam',
    name: 'Faisceaux Laser',
    kind: 'worker',
    icon: SatelliteDish,
    tagline: 'Simulateur de propulsion par faisceau',
    readme: mkSimReadme(
      'Faisceaux laser ou faisceaux d’électrons (Laser & Electron Beams)',
      `## Fonctionnement
Un faisceau puissant (laser depuis la Terre ou l'orbite, ou faisceau
relativiste d'électrons) pousse une voile ou une sonde à distance. Le
faisceau transfère du momentum sans que le vaisseau emporte de carburant.

## Avantages
- Accélération continue sans masse embarquée.
- Potentiellement des fractions de c (vitesse de la lumière).

## Inconvénients
- Précision extrême requise sur des distances énormes.
- Infrastructure gigantesque.
- Dissipation du faisceau.

## État
**Concepts en développement** (ex. Breakthrough Starshot : lasers sur
voiles). Prometteur pour sondes légères vers Alpha Centauri.`
    ),
    mermaidAlgorithm: mkSimulatorMermaid('transfert de momentum photonique + divergence du faisceau'),
    skills: ['Optique de puissance', 'Pointage longue distance', 'Dynamique relativiste'],
    llmBinding: { providerId: 'local-lmlite', model: 'qwen3-coder' },
    status: 'idle',
  },
];

/**
 * Le dossier racine « Technologies Spatiales » ne contient plus d'agents en
 * direct : il regroupe des SOUS-DOSSIERS thématiques (Propulsion,
 * Protections Anti-Radiations — voir seed_rad_protection.ts).
 */
export const spaceTechFolder: AgentFolder = {
  id: 'folder-space-tech',
  name: 'Technologies Spatiales',
  agentIds: [],
};

/** Sous-dossier « Propulsion » : les huit simulateurs de propulsion. */
export const propulsionFolder: AgentFolder = {
  id: 'folder-propulsion',
  name: 'Propulsion',
  agentIds: spaceTechAgents.map((a) => a.id),
  parentId: spaceTechFolder.id,
};
