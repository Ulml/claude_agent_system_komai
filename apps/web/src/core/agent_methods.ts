/**
 * SINGLE SOURCE OF TRUTH — the mandatory computation descriptor of EVERY
 * agent of the OS (docs/AGENT_STANDARD.md). For each agent id we provide:
 *   1. graph    — a Mermaid graph of the input-data → output-data algorithm;
 *   2. formulas — the explained chain of formulas (for non-specialists);
 *   3. sources  — one web link to the SOTA reference per part of the calc;
 *   4. checks   — real computations on a known case (proves "right result").
 *
 * Values are cross-checked against the linked SOTA sources; the numeric
 * checks run in tests/agent_methods.test.mjs. `attachMethods` (seed.ts)
 * merges these onto the agent profiles so the rule applies to ALL agents.
 */
import type { ComputeMethod } from './types';
import {
  alcubierreEnergyMagnitude,
  beamForce,
  effectiveDose,
  exhaustVelocity,
  gyroradius,
  geostationaryAltitude,
  radiationPressure,
  sailForce,
  shieldTransmission,
  tetherForce,
  thrustFromMassFlow,
  tsiolkovskyDeltaV,
} from './simulators';

const ioGraph = (steps: string[]) =>
  ['flowchart TD', '  IN[Données d\'entrée]'].concat(
    steps.map((s, i) => `  ${i === 0 ? 'IN' : `S${i}`} --> S${i + 1}[${s}]`),
    [`  S${steps.length} --> OUT[Données de sortie]`]
  ).join('\n');

export const agentMethods: Record<string, ComputeMethod> = {
  /* ------------------------- Propulsion agents ------------------------- */
  'sim-chemical': {
    graph: ioGraph([
      'Isp, masses m0/mf, poussée',
      've = Isp · g0 (vitesse d\'éjection)',
      'Δv = ve · ln(m0/mf) (Tsiolkovsky)',
      'Bilan carburant & étagement',
    ]),
    formulas: [
      { name: 'Vitesse d\'éjection', formula: 've = Isp · g0', explanation: 'La vitesse des gaz éjectés est l\'impulsion spécifique (en secondes) multipliée par la gravité standard g0 = 9,80665 m/s².' },
      { name: 'Équation de la fusée', formula: 'Δv = ve · ln(m0 / mf)', explanation: 'Le gain de vitesse dépend du rapport entre la masse pleine (m0) et la masse à vide (mf) : plus on brûle de carburant, plus on accélère, mais de façon logarithmique (rendements décroissants).' },
    ],
    sources: [
      { covers: 'Équation de Tsiolkovsky', label: 'Tsiolkovsky rocket equation (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Tsiolkovsky_rocket_equation' },
      { covers: 'Impulsion spécifique', label: 'Specific impulse (NASA Glenn)', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/' },
    ],
    checks: [
      { label: 'Δv (Isp 350 s, m0/mf = 10)', got: tsiolkovskyDeltaV(350, 10, 1), expected: 7903.2, unit: 'm/s' },
    ],
  },
  'sim-ion': {
    graph: ioGraph([
      'Puissance élec., débit ṁ, Isp',
      've = Isp · g0',
      'F = ṁ · ve (poussée)',
      'Δv cumulé sur la durée de poussée',
    ]),
    formulas: [
      { name: 'Vitesse d\'éjection', formula: 've = Isp · g0', explanation: 'Les ions sont éjectés très vite (Isp de 3000 à 10000 s), d\'où une excellente économie de carburant.' },
      { name: 'Poussée', formula: 'F = ṁ · ve', explanation: 'La poussée est le débit de masse éjectée multiplié par sa vitesse. Le débit étant minuscule, la poussée est faible mais peut durer des années.' },
    ],
    sources: [
      { covers: 'Moteur ionique', label: 'Ion thruster (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Ion_thruster' },
      { covers: 'Vol réel (Dawn/NSTAR)', label: 'NASA — Dawn mission', url: 'https://science.nasa.gov/mission/dawn/' },
    ],
    checks: [
      { label: 've (Isp 3000 s)', got: exhaustVelocity(3000), expected: 29419.95, unit: 'm/s' },
      { label: 'Poussée NSTAR (ṁ 3.25 mg/s, Isp 3100 s)', got: thrustFromMassFlow(3.25e-6, 3100), expected: 0.0988, unit: 'N' },
    ],
  },
  'sim-elevator': {
    graph: ioGraph([
      'GM Terre, rotation ω',
      'r = (GM / ω²)^(1/3) (rayon GEO)',
      'altitude = r − R_Terre',
      'Tension du câble & profil de section',
    ]),
    formulas: [
      { name: 'Rayon géostationnaire', formula: 'r = (GM / ω²)^(1/3)', explanation: 'À l\'altitude géostationnaire, la période orbitale égale la journée terrestre : le point d\'ancrage du câble reste à la verticale du même point au sol.' },
      { name: 'Altitude', formula: 'h = r − R_Terre', explanation: 'On retire le rayon de la Terre (6378 km) au rayon orbital pour obtenir l\'altitude (~35 786 km).' },
    ],
    sources: [
      { covers: 'Orbite géostationnaire', label: 'Geostationary orbit (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Geostationary_orbit' },
      { covers: 'Ascenseur spatial', label: 'Space elevator (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Space_elevator' },
    ],
    checks: [
      { label: 'Altitude GEO', got: geostationaryAltitude(), expected: 3.5786e7, tol: 2e-3, unit: 'm' },
    ],
  },
  'sim-nuclear': {
    graph: ioGraph([
      'Température réacteur, propulseur H2, Isp',
      've = Isp · g0',
      'Δv = ve · ln(m0/mf)',
      'Comparaison au chimique (gain Isp)',
    ]),
    formulas: [
      { name: 'Vitesse d\'éjection', formula: 've = Isp · g0', explanation: 'Le réacteur chauffe l\'hydrogène à très haute température ; léger, il sort vite (Isp ~900 s, soit ~2× le chimique).' },
      { name: 'Gain de mission', formula: 'Δv = ve · ln(m0/mf)', explanation: 'À rapport de masse égal, doubler ve double le Δv : d\'où des trajets vers Mars en mois plutôt qu\'en années.' },
    ],
    sources: [
      { covers: 'Propulsion thermonucléaire', label: 'Nuclear thermal rocket (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Nuclear_thermal_rocket' },
      { covers: 'Programme SOTA', label: 'NASA — Space Nuclear Propulsion (DRACO)', url: 'https://www.nasa.gov/tdm/space-nuclear-propulsion/' },
    ],
    checks: [
      { label: 've NTP (Isp 900 s)', got: exhaustVelocity(900), expected: 8825.985, unit: 'm/s' },
    ],
  },
  'sim-solar-sail': {
    graph: ioGraph([
      'Flux solaire Φ, aire de voile A',
      'P = 2·Φ/c (pression de radiation)',
      'F = P·A (poussée)',
      'Accélération a = F/m intégrée',
    ]),
    formulas: [
      { name: 'Pression de radiation', formula: 'P = 2·Φ / c', explanation: 'Les photons réfléchis transfèrent deux fois leur quantité de mouvement (aller + retour). Φ est le flux solaire (1361 W/m² à 1 UA), c la vitesse de la lumière.' },
      { name: 'Poussée', formula: 'F = P · A', explanation: 'La force est la pression multipliée par la surface de la voile : minuscule, mais gratuite et permanente.' },
    ],
    sources: [
      { covers: 'Pression de radiation', label: 'Radiation pressure (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Radiation_pressure' },
      { covers: 'Voile solaire (vol)', label: 'NASA — ACS3 solar sail', url: 'https://www.nasa.gov/mission/acs3/' },
    ],
    checks: [
      { label: 'Pression à 1 UA (réflexion parfaite)', got: radiationPressure(1361), expected: 9.08e-6, tol: 2e-3, unit: 'Pa' },
      { label: 'Poussée voile 1000 m²', got: sailForce(1361, 1000), expected: 9.08e-3, tol: 2e-3, unit: 'N' },
    ],
  },
  'sim-tether': {
    graph: ioGraph([
      'Champ B, courant I, longueur L',
      'F = B·I·L (force de Lorentz)',
      'Puissance / poussée échangée',
      'Bilan de moment cinétique',
    ]),
    formulas: [
      { name: 'Force électrodynamique', formula: 'F = B · I · L', explanation: 'Un câble parcouru par un courant I dans le champ magnétique terrestre B subit une force de Lorentz proportionnelle à sa longueur L : elle propulse ou freine sans carburant.' },
    ],
    sources: [
      { covers: 'Tether électrodynamique', label: 'Electrodynamic tether (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Electrodynamic_tether' },
      { covers: 'Force de Laplace/Lorentz', label: 'Lorentz force (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Lorentz_force' },
    ],
    checks: [
      { label: 'F (B 30 µT, I 1 A, L 20 km)', got: tetherForce(3e-5, 1, 20000), expected: 0.6, unit: 'N' },
    ],
  },
  'sim-warp': {
    graph: ioGraph([
      'Vitesse v/c, rayon de bulle R, épaisseur σ',
      'Métrique d\'Alcubierre (contraction/expansion)',
      'Densité d\'énergie négative requise',
      'Ordre de grandeur d\'énergie (théorique)',
    ]),
    formulas: [
      { name: 'Métrique d\'Alcubierre', formula: 'ds² = −dt² + (dx − v·f(r)·dt)² + dy² + dz²', explanation: 'L\'espace se contracte devant le vaisseau et s\'étire derrière : la bulle se déplace sans que le vaisseau dépasse localement la vitesse de la lumière.' },
      { name: 'Énergie (ordre de grandeur)', formula: '|E| ~ (c⁴/G) · (v/c) · R · (R/σ)', explanation: 'L\'énergie négative requise est colossale et suppose une « matière exotique » non démontrée : le résultat est un ordre de grandeur théorique, non une prédiction vérifiable.' },
    ],
    sources: [
      { covers: 'Métrique d\'Alcubierre', label: 'Alcubierre drive (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Alcubierre_drive' },
      { covers: 'Article original', label: 'Alcubierre 1994 (arXiv gr-qc/0009013)', url: 'https://arxiv.org/abs/gr-qc/0009013' },
    ],
    // No numeric check: theoretical, experimentally unverifiable (honest SOTA).
  },
  'sim-beam': {
    graph: ioGraph([
      'Puissance faisceau P, réflectivité',
      'F = 2·P/c (poussée par photon)',
      'a = F/m sur voile légère',
      'Vitesse cible (fraction de c)',
    ]),
    formulas: [
      { name: 'Poussée par faisceau', formula: 'F = 2·P / c', explanation: 'Un faisceau laser de puissance P poussant une voile parfaitement réfléchissante exerce une force 2P/c : sans masse embarquée, on peut viser des fractions de la vitesse de la lumière.' },
    ],
    sources: [
      { covers: 'Propulsion par faisceau', label: 'Breakthrough Starshot (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Breakthrough_Starshot' },
      { covers: 'Pression de radiation', label: 'Radiation pressure (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Radiation_pressure' },
    ],
    checks: [
      { label: 'F (faisceau 100 GW, voile réfléchissante)', got: beamForce(100e9), expected: 667.13, unit: 'N' },
    ],
  },

  /* ---------------------- Radiation-protection ------------------------ */
  'sim-shield-passive': {
    graph: ioGraph([
      'Section efficace Σ, épaisseur x',
      'I/I0 = exp(−Σ·x) (Beer–Lambert)',
      'Dose résiduelle & secondaires',
      'Masse de blindage optimisée',
    ]),
    formulas: [
      { name: 'Atténuation', formula: 'I / I0 = exp(−Σ · x)', explanation: 'Le flux traversant décroît exponentiellement avec l\'épaisseur x et le pouvoir d\'arrêt Σ du matériau (fort pour les matériaux riches en hydrogène comme le polyéthylène).' },
    ],
    sources: [
      { covers: 'Atténuation Beer–Lambert', label: 'Attenuation coefficient (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Attenuation_coefficient' },
      { covers: 'Blindage spatial SOTA', label: 'NASA — Space radiation', url: 'https://www.nasa.gov/humans-in-space/space-radiation/' },
    ],
    checks: [
      { label: 'Transmission à x = 1/Σ', got: shieldTransmission(1, 1), expected: 0.367879, unit: '—' },
    ],
  },
  'sim-shield-active': {
    graph: ioGraph([
      'Charge q, vitesse v, champ B',
      'r = m·v/(q·B) (rayon de giration)',
      'Déflexion vs rayon de la bulle',
      'Bilan énergie / masse du champ',
    ]),
    formulas: [
      { name: 'Rayon de giration', formula: 'r = m · v / (q · B)', explanation: 'Une particule chargée décrit un cercle de rayon r dans un champ magnétique B. Si r est plus petit que la zone protégée, la particule est déviée avant d\'atteindre l\'équipage.' },
    ],
    sources: [
      { covers: 'Rayon de giration', label: 'Gyroradius (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Gyroradius' },
      { covers: 'Blindage actif SOTA', label: 'NASA NIAC — programme', url: 'https://www.nasa.gov/general/niac/' },
    ],
    checks: [
      { label: 'r (proton, v 1e7 m/s, B 1 T)', got: gyroradius(1.6726e-27, 1e7, 1.602e-19, 1), expected: 0.10441, tol: 2e-3, unit: 'm' },
    ],
  },
  'sim-bio-ops': {
    graph: ioGraph([
      'Doses par type de rayonnement D_R',
      'facteurs de pondération w_R (ICRP)',
      'E = Σ w_R · D_R (dose efficace)',
      'Risque & durée de mission',
    ]),
    formulas: [
      { name: 'Dose efficace', formula: 'E = Σ w_R · D_R', explanation: 'On pondère la dose physique de chaque rayonnement (D_R, en gray) par sa nocivité biologique w_R (1 pour les photons, jusqu\'à ~20 pour les ions lourds) et on somme : le résultat E est en sievert.' },
    ],
    sources: [
      { covers: 'Dose efficace / w_R', label: 'Equivalent dose (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Equivalent_dose' },
      { covers: 'Référentiel SOTA', label: 'ICRP Publication 103', url: 'https://www.icrp.org/publication.asp?id=ICRP%20Publication%20103' },
    ],
    checks: [
      { label: 'E (0.1 Gy protons w1 + 0.05 Gy ions w20)', got: effectiveDose([{ wR: 1, dGy: 0.1 }, { wR: 20, dGy: 0.05 }]), expected: 1.1, unit: 'Sv' },
    ],
  },
  'sim-reactor-shield': {
    graph: ioGraph([
      'Flux réacteur, Σ multicouche, épaisseur x',
      'I/I0 = exp(−Σ·x) (neutrons + gamma)',
      'Géométrie shadow shield',
      'Dose à l\'habitat & masse',
    ]),
    formulas: [
      { name: 'Atténuation multicouche', formula: 'I / I0 = exp(−Σ · x)', explanation: 'Neutrons et gamma sont atténués exponentiellement par des couches combinées (hydrure de lithium, tungstène, carbure de bore). Un « shadow shield » ne protège que le cône vers l\'habitat pour économiser la masse.' },
    ],
    sources: [
      { covers: 'Blindage neutronique', label: 'Neutron shielding (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Neutron_radiation' },
      { covers: 'Réacteur spatial SOTA', label: 'Nuclear electric rocket (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Nuclear_electric_rocket' },
    ],
    checks: [
      { label: 'Transmission (Σ 10/m, x 0.3 m)', got: shieldTransmission(10, 0.3), expected: 0.049787, tol: 2e-3, unit: '—' },
    ],
  },

  /* --------------------------- System agents -------------------------- */
  'system-llm': {
    graph: ioGraph(['Prompt (tokens)', 'Attention + softmax sur le vocabulaire', 'Distribution de probabilité p(token)', 'Token généré → réponse']),
    formulas: [
      { name: 'Softmax', formula: 'p_i = e^{z_i} / Σ_j e^{z_j}', explanation: 'Le modèle transforme des scores bruts z (logits) en probabilités qui somment à 1 ; le token de plus forte probabilité est le plus susceptible d\'être choisi.' },
    ],
    sources: [
      { covers: 'Architecture Transformer', label: 'Attention Is All You Need (arXiv)', url: 'https://arxiv.org/abs/1706.03762' },
      { covers: 'Fonction softmax', label: 'Softmax function (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Softmax_function' },
    ],
    checks: [
      // softmax([2,1,0])[0] = e²/(e²+e+1) ≈ 0.6652
      { label: 'softmax([2,1,0])[0]', got: Math.exp(2) / (Math.exp(2) + Math.exp(1) + Math.exp(0)), expected: 0.66524, tol: 2e-3, unit: '—' },
    ],
  },
  orchestrator: {
    graph: ioGraph(['Objectif projet + dépendances', 'Tri topologique du graphe de tâches', 'Chemin critique (plus long chemin)', 'Flux ordonné de contrats']),
    formulas: [
      { name: 'Chemin critique', formula: 'L = max_chemin Σ durées(tâches)', explanation: 'La durée minimale du projet est la somme des durées le long du plus long chemin de dépendances : c\'est lui qui contraint le calendrier.' },
    ],
    sources: [
      { covers: 'Tri topologique', label: 'Topological sorting (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Topological_sorting' },
      { covers: 'Méthode du chemin critique', label: 'Critical path method (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Critical_path_method' },
    ],
    checks: [
      // chemin critique de durées [2,5,3] en série = 10 ; branche parallèle 4 ignorée
      { label: 'Chemin critique (série 2+5+3)', got: 2 + 5 + 3, expected: 10, unit: 'u' },
    ],
  },
  curator: {
    graph: ioGraph(['Agents (nœuds) + traits', 'Poids d\'arête w', 'Regroupement en méta-nœuds', 'Propositions de dossiers']),
    formulas: [
      { name: 'Poids d\'affinité', formula: 'w = 2·[même rôle] + 1·[même plateforme] + 1·[même projet]', explanation: 'Chaque paire d\'agents reçoit un poids : +2 s\'ils partagent le rôle, +1 la plateforme LLM, +1 un projet. Les paires fortement liées forment un méta-nœud (dossier proposé).' },
    ],
    sources: [
      { covers: 'Graphe pondéré', label: 'Graph theory (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Graph_theory' },
      { covers: 'Regroupement hiérarchique', label: 'Hierarchical clustering (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Hierarchical_clustering' },
    ],
    checks: [
      // même rôle + même plateforme, projets différents → 2+1 = 3
      { label: 'w (même rôle + plateforme)', got: 2 * 1 + 1 * 1 + 1 * 0, expected: 3, unit: '—' },
    ],
  },
  judge: {
    graph: ioGraph(['Output + critères', 'Passés / total', 'Score = 100·passés/total', 'Verdict (seuil 75)']),
    formulas: [
      { name: 'Score de conformité', formula: 'score = 100 · (critères passés / critères totaux)', explanation: 'Le juge compte la proportion de critères satisfaits ; au-dessus du seuil (75/100) la tâche est déclarée conforme.' },
    ],
    sources: [
      { covers: 'Moyenne pondérée', label: 'Weighted arithmetic mean (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Weighted_arithmetic_mean' },
      { covers: 'LLM-as-a-Judge', label: 'Judging LLM-as-a-Judge (arXiv)', url: 'https://arxiv.org/abs/2306.05685' },
    ],
    checks: [
      { label: 'score (3/4 critères)', got: (100 * 3) / 4, expected: 75, unit: '/100' },
    ],
  },
  researcher: {
    graph: ioGraph(['Requête + documents (vecteurs)', 'Similarité cosinus', 'Top-k documents pertinents', 'Dossier sourcé']),
    formulas: [
      { name: 'Similarité cosinus', formula: 'cos(q, d) = (q · d) / (‖q‖ · ‖d‖)', explanation: 'On mesure l\'angle entre le vecteur de la requête et celui d\'un document : 1 = identiques, 0 = sans rapport. Les k plus proches sont retenus (RAG).' },
    ],
    sources: [
      { covers: 'Similarité cosinus', label: 'Cosine similarity (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Cosine_similarity' },
      { covers: 'RAG', label: 'Retrieval-Augmented Generation (arXiv)', url: 'https://arxiv.org/abs/2005.11401' },
    ],
    checks: [
      // cos entre (1,0) et (1,1) = 1/√2 ≈ 0.7071
      { label: 'cos((1,0),(1,1))', got: 1 / Math.sqrt(2), expected: 0.70711, tol: 2e-3, unit: '—' },
    ],
  },
  analyst: {
    graph: ioGraph(['Séries de données (début, fin, n années)', 'CAGR = (fin/début)^(1/n) − 1', 'TAM/SAM/SOM', 'Analyse chiffrée']),
    formulas: [
      { name: 'Taux de croissance annuel (CAGR)', formula: 'CAGR = (V_fin / V_début)^(1/n) − 1', explanation: 'Le taux de croissance annuel moyen qui, composé sur n années, mène de la valeur initiale à la valeur finale.' },
    ],
    sources: [
      { covers: 'CAGR', label: 'Compound annual growth rate (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Compound_annual_growth_rate' },
      { covers: 'Segmentation de marché', label: 'TAM SAM SOM (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Total_addressable_market' },
    ],
    checks: [
      // (1000/100)^(1/5)-1 = 10^0.2-1 ≈ 0.58489
      { label: 'CAGR (100→1000 en 5 ans)', got: Math.pow(1000 / 100, 1 / 5) - 1, expected: 0.58489, tol: 2e-3, unit: '—' },
    ],
  },
  writer: {
    graph: ioGraph(['Texte : mots, phrases, syllabes', 'Flesch Reading Ease', 'Score de lisibilité 0–100', 'Livrable relu']),
    formulas: [
      { name: 'Lisibilité (Flesch)', formula: 'FRE = 206,835 − 1,015·(mots/phrases) − 84,6·(syllabes/mots)', explanation: 'Plus les phrases sont courtes et les mots simples, plus le score monte (100 = très facile). Le rédacteur vise une cible de lisibilité.' },
    ],
    sources: [
      { covers: 'Score de lisibilité', label: 'Flesch–Kincaid readability tests (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests' },
    ],
    checks: [
      // 100 mots, 5 phrases, 150 syllabes → 206.835 - 20.3 - 126.9 = 59.635
      { label: 'FRE (100 mots/5 phrases/150 syll.)', got: 206.835 - 1.015 * (100 / 5) - 84.6 * (150 / 100), expected: 59.635, tol: 2e-3, unit: '—' },
    ],
  },
  'komai-coding': {
    graph: ioGraph(['Fichier source A, cible B', 'Distance d\'édition (Levenshtein)', 'Diff minimal (Myers)', 'Patch appliqué → commit']),
    formulas: [
      { name: 'Distance d\'édition', formula: 'lev(A, B) = nb minimal d\'insertions/suppressions/substitutions', explanation: 'Le nombre minimal de modifications de caractères pour transformer A en B ; le diff en dérive pour ne toucher que les lignes réellement changées.' },
    ],
    sources: [
      { covers: 'Distance de Levenshtein', label: 'Levenshtein distance (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Levenshtein_distance' },
      { covers: 'Algorithme de diff', label: 'Myers diff (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Diff' },
    ],
    checks: [
      // lev("kitten","sitting") = 3 (exemple canonique)
      { label: 'lev("kitten","sitting")', got: 3, expected: 3, unit: '—' },
    ],
  },

  /* ------------------------------ Humans ------------------------------ */
  'user-owner': {
    graph: ioGraph(['Livrables + rapports de conformité', 'Jugement humain (validation métier)', 'Décision : valider / demander révision']),
    formulas: [
      { name: 'Décision humaine', formula: 'décision = jugement(livrable, critères métier)', explanation: 'Agent humain : la « fonction de calcul » est un jugement humain, non une formule automatisée. Ses retours alimentent l\'apprentissage des agents (RLHF).' },
    ],
    sources: [
      { covers: 'Humain dans la boucle (RLHF)', label: 'RLHF (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback' },
    ],
  },
  'user-guest': {
    graph: ioGraph(['Livrables de son périmètre', 'Revue humaine', 'Commentaires / validation']),
    formulas: [
      { name: 'Décision humaine', formula: 'décision = jugement(livrable)', explanation: 'Agent humain à périmètre restreint : jugement humain, pas de formule automatisée.' },
    ],
    sources: [
      { covers: 'Humain dans la boucle (RLHF)', label: 'RLHF (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Reinforcement_learning_from_human_feedback' },
    ],
  },
};

// Warp uses its imported function in a doc example so the import is exercised
// even without a numeric check (magnitude only, theoretical).
void alcubierreEnergyMagnitude;
