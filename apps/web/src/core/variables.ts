/**
 * ESPACE DE VARIABLES — le « TENSEUR NOMMÉ » du flux fonctionnel,
 * DE BOUT EN BOUT : des environnants jusqu'aux CRITÈRES DE CONFORT DE
 * L'UTILISATEUR HUMAIN.
 *
 * SSOT de la représentation bout-en-bout des variables : chaque variable de
 * chaque agent du flux (et du flux lui-même) est une entrée NOMMÉE d'un
 * tenseur à deux axes lisibles :
 *
 *      axe 1 : la VARIABLE (avec son rôle)   axe 2 : le SCÉNARIO
 *      T_ext, HR_ext, e, λ, R, q, T_op…      saison × jour/nuit
 *
 * Les 5 RÔLES (taxonomie actée avec l'utilisateur) :
 *  - 'environnant'  : SUBIE — profil temporel issu de la recherche sourcée
 *                     des environnants (fluctuation saisonnière et jour/nuit).
 *  - 'compromis'    : LIBRE — résolue par l'OPTIMISEUR (e, λ, m″…) : une seule
 *                     valeur doit satisfaire TOUS les scénarios à la fois ;
 *                     c'est là qu'est le compromis.
 *  - 'etat'         : INTERMÉDIAIRE — calculée par les formules physiques.
 *  - 'performance'  : DÉLIVRÉE par le système — ce sont des exigences
 *                     DÉDUITES des critères de confort humain, pas les
 *                     critères eux-mêmes.
 *  - 'confort'      : LE CRITÈRE HUMAIN — la variable que l'occupant ressent
 *                     réellement (température opérative, humidité intérieure,
 *                     calme, sécurité), JUGÉE dans SA zone de conformité.
 *                     C'est le bout de la chaîne : le tenseur va jusqu'à lui.
 *
 * AUCUNE BOÎTE NOIRE : chaque variable calculée porte sa formule symbolique
 * ET sa substitution numérique par scénario (`calc`), pour afficher la chaîne
 * de calcul pas à pas jusqu'au critère humain — l'utilisateur de l'appli doit
 * pouvoir ré-expliquer lui-même comment on arrive au résultat, et quel
 * compromis l'optimiseur devra arbitrer (`levers`).
 *
 * Ce fichier ne rend rien : il CONSTRUIT le tenseur (fonction pure) à partir
 * du modèle MBSE (environnants sourcés) et des formules de simulators.ts.
 * La traduction UI (vues A graphe porté, calcul pas à pas, B jauges bullet,
 * C matrice, D conclusions pour l'optimiseur) vit dans
 * components/system/VariablesView.tsx — principe de réduction de la dette de
 * compréhension.
 */
import type { ConformityRange, SystemComponent } from './types';
import {
  heatFlux,
  moistureBuffered,
  normalStress,
  safetyFactor,
  thermalDiffusivity,
  thermalResistance,
} from './simulators';

/* ------------------------------------------------------------------ */
/* Axes of the named tensor                                            */
/* ------------------------------------------------------------------ */

export type ScenarioId = 'hiver-jour' | 'hiver-nuit' | 'ete-jour' | 'ete-nuit';

export interface Scenario {
  id: ScenarioId;
  /** i18n key of the scenario label. */
  labelKey: string;
}

export const SCENARIOS: Scenario[] = [
  { id: 'hiver-jour', labelKey: 'scHiverJour' },
  { id: 'hiver-nuit', labelKey: 'scHiverNuit' },
  { id: 'ete-jour', labelKey: 'scEteJour' },
  { id: 'ete-nuit', labelKey: 'scEteNuit' },
];

export type VariableRole = 'environnant' | 'compromis' | 'etat' | 'performance' | 'confort';

export const ROLE_ORDER: VariableRole[] = ['environnant', 'compromis', 'etat', 'performance', 'confort'];

/** Role colors — categorical palette VALIDATED (six checks, light & dark:
 *  lightness band, chroma floor, CVD ΔE≥8, normal-vision ΔE≥15, contrast).
 *  The role NAME is always written next to the chip: never color alone. */
export const ROLE_COLORS: Record<VariableRole, { light: string; dark: string }> = {
  environnant: { light: '#0284c7', dark: '#0284c7' },
  compromis: { light: '#7c3aed', dark: '#8b5cf6' },
  etat: { light: '#0d9488', dark: '#0d9488' },
  performance: { light: '#c2410c', dark: '#ea580c' },
  confort: { light: '#a21caf', dark: '#db2777' },
};

export const ROLE_LABEL_KEYS: Record<VariableRole, string> = {
  environnant: 'roleEnvironnant',
  compromis: 'roleCompromis',
  etat: 'roleEtat',
  performance: 'rolePerformance',
  confort: 'roleConfort',
};

/** One named entry of the tensor: a variable with one value PER SCENARIO. */
export interface NamedVariable {
  id: string;
  name: string;
  symbol: string;
  unit: string;
  role: VariableRole;
  /** value along the scenario axis (compromis vars are constant by design). */
  values: Record<ScenarioId, number>;
  /** ids of the variables this one is computed FROM (edges of view A). */
  dependsOn: string[];
  /** performance/confort vars: the conformity range it is judged against
   *  (confort = the HUMAN criterion; performance = the deduced requirement). */
  requirement?: ConformityRange;
  /** the formula that produces it (computed vars). */
  formula?: string;
  /** NO BLACK BOX: the numeric substitution of the formula for one scenario,
   *  e.g. « q = 0.500 × |19 − 2| / 0.300 = 28.3 W/m² ». */
  calc?: (s: ScenarioId) => string;
  /** confort vars: which compromis levers the optimizer can act on, and how. */
  levers?: string;
}

export interface VariableSpace {
  scenarios: Scenario[];
  variables: NamedVariable[];
}

/* ------------------------------------------------------------------ */
/* Construction — pure function over the MBSE model                    */
/* ------------------------------------------------------------------ */

/** Compromis reference values (raw-earth brick) — the optimizer's free
 *  variables. ONE value must hold across every scenario: the compromise. */
const COMPROMIS = {
  e: 0.3, // wall thickness (m)
  lambda: 0.5, // thermal conductivity (W/m·K)
  mpp: 510, // surface mass (kg/m²) — acoustic mass law
};

/** Fixed material/context constants used by the formulas (not optimised). */
const CTX = {
  rho: 1700, // density (kg/m³)
  c: 1000, // heat capacity (J/kg·K)
  A: 0.09, // brick section (m²)
  sigmaR: 2e6, // compressive strength (Pa)
  MBV: 2, // moisture buffer value (g/m²·%RH)
  wallArea: 12, // buffering wall area (m²)
  freq: 500, // acoustic reference frequency (Hz)
  tIntWinter: 19, // heating setpoint winter (°C) — the AIR temperature
  tIntSummer: 26, // setpoint summer (°C)
  rSi: 0.13, // internal surface resistance (m²K/W, EN ISO 6946)
  gPerRH: 52, // g of vapour per %RH in the dwelling air (~300 m³ at 20 °C)
};

/** HUMAN comfort zones — the criteria the OCCUPANT actually feels (ASHRAE 55
 *  operative temperature, hygrometric comfort band, WHO night noise,
 *  Eurocode safety). The tensor chain ENDS on these. */
const COMFORT_ZONES = {
  tOp: { name: 'Température opérative ressentie', min: 19, max: 27, unit: '°C' },
  hrInt: { name: 'Humidité relative intérieure', min: 40, max: 60, unit: '%' },
  calme: { name: 'Calme perçu (télétravail)', min: 0, max: 35, unit: 'dB(A)' },
  securite: { name: 'Sécurité structurelle des occupants', min: 2, max: 100, unit: '—' },
};

const all = (v: number): Record<ScenarioId, number> => ({
  'hiver-jour': v,
  'hiver-nuit': v,
  'ete-jour': v,
  'ete-nuit': v,
});

const per = (hj: number, hn: number, ej: number, en: number): Record<ScenarioId, number> => ({
  'hiver-jour': hj,
  'hiver-nuit': hn,
  'ete-jour': ej,
  'ete-nuit': en,
});

const mapValues = (
  src: Record<ScenarioId, number>,
  f: (v: number, s: ScenarioId) => number
): Record<ScenarioId, number> => ({
  'hiver-jour': f(src['hiver-jour'], 'hiver-jour'),
  'hiver-nuit': f(src['hiver-nuit'], 'hiver-nuit'),
  'ete-jour': f(src['ete-jour'], 'ete-jour'),
  'ete-nuit': f(src['ete-nuit'], 'ete-nuit'),
});

const isWinter = (s: ScenarioId) => s.startsWith('hiver');

/**
 * Builds the named tensor from the designed system's environnants.
 * Returns null when no system has been designed yet.
 */
export function buildVariableSpace(components: SystemComponent[]): VariableSpace | null {
  const envs = components.filter((c) => c.kind === 'environment');
  const user = components.find((c) => c.kind === 'user');
  if (envs.length === 0 || !user) return null;

  const q = (re: RegExp, fallback: number): number => {
    for (const env of envs) {
      const found = env.quantities?.find((x) => re.test(x.name) || re.test(x.symbol));
      if (found) return found.value;
    }
    return fallback;
  };
  // Same lookup, USER environnant included (the human is characterised there:
  // famille de 4, production de vapeur m_vap…).
  const q2 = (re: RegExp, fallback: number): number => {
    for (const c of [...envs, user]) {
      const found = c.quantities?.find((x) => re.test(x.name) || re.test(x.symbol));
      if (found) return found.value;
    }
    return fallback;
  };
  const req = (re: RegExp): ConformityRange | undefined => user.requirements?.find((r) => re.test(r.name));

  // ENVIRONNANT variables — seasonal & day/night profiles anchored on the
  // SOURCED extremes researched by the environnant agents (T_ext base winter
  // night, T_max summer day peak; the day/night amplitude reflects the sourced
  // « amplitude thermique jour/nuit marquée en été »).
  const tBase = q(/T_ext/, -7); // winter design temperature (night)
  const tMax = q(/T_max/, 32); // summer peak (day)
  const hrExt = q(/HR_ext/, 85);
  const fLoad = q(/^F$|Descente/, 45); // kN
  const lExt = q(/L_ext|Bruit/, 65); // dB(A)

  const tExt: NamedVariable = {
    id: 'T_ext',
    name: 'Température extérieure',
    symbol: 'T_ext',
    unit: '°C',
    role: 'environnant',
    values: per(tBase + 9, tBase, tMax, tMax - 14),
    dependsOn: [],
  };
  const hr: NamedVariable = {
    id: 'HR_ext',
    name: 'Humidité relative extérieure',
    symbol: 'HR_ext',
    unit: '%',
    role: 'environnant',
    values: per(hrExt, hrExt, 55, 70),
    dependsOn: [],
  };
  const F: NamedVariable = {
    id: 'F',
    name: 'Descente de charges',
    symbol: 'F',
    unit: 'kN',
    role: 'environnant',
    values: all(fLoad),
    dependsOn: [],
  };
  const lext: NamedVariable = {
    id: 'L_ext',
    name: 'Bruit routier en façade',
    symbol: 'L_ext',
    unit: 'dB(A)',
    role: 'environnant',
    values: per(lExt, lExt - 7, lExt, lExt - 7),
    dependsOn: [],
  };

  // COMPROMIS variables — constant across scenarios BY CONSTRUCTION: the
  // optimizer must find the single value that satisfies every scenario.
  const e: NamedVariable = {
    id: 'e',
    name: 'Épaisseur du mur',
    symbol: 'e',
    unit: 'm',
    role: 'compromis',
    values: all(COMPROMIS.e),
    dependsOn: [],
  };
  const lambda: NamedVariable = {
    id: 'lambda',
    name: 'Conductivité du matériau',
    symbol: 'λ',
    unit: 'W/m·K',
    role: 'compromis',
    values: all(COMPROMIS.lambda),
    dependsOn: [],
  };
  const mpp: NamedVariable = {
    id: 'mpp',
    name: 'Masse surfacique',
    symbol: 'm″',
    unit: 'kg/m²',
    role: 'compromis',
    values: all(COMPROMIS.mpp),
    dependsOn: [],
  };

  // ÉTAT variables — computed by the real physics of simulators.ts.
  const rVal = thermalResistance(COMPROMIS.e, COMPROMIS.lambda);
  const R: NamedVariable = {
    id: 'R',
    name: 'Résistance thermique',
    symbol: 'R',
    unit: 'm²K/W',
    role: 'etat',
    values: all(rVal),
    dependsOn: ['e', 'lambda'],
    formula: 'R = e / λ',
    calc: () => `R = ${COMPROMIS.e.toFixed(3)} / ${COMPROMIS.lambda.toFixed(3)} = ${fmtValue(rVal)} m²K/W`,
  };
  const alphaVal = thermalDiffusivity(COMPROMIS.lambda, CTX.rho, CTX.c);
  const alpha: NamedVariable = {
    id: 'alpha',
    name: 'Diffusivité thermique',
    symbol: 'α',
    unit: 'm²/s',
    role: 'etat',
    values: all(alphaVal),
    dependsOn: ['lambda'],
    formula: 'α = λ / (ρ·c)',
    calc: () => `α = ${COMPROMIS.lambda.toFixed(3)} / (${CTX.rho} × ${CTX.c}) = ${fmtValue(alphaVal)} m²/s`,
  };
  const sigma: NamedVariable = {
    id: 'sigma',
    name: 'Contrainte dans la brique',
    symbol: 'σ',
    unit: 'MPa',
    role: 'etat',
    values: mapValues(F.values, (f) => normalStress(f * 1000, CTX.A) / 1e6),
    dependsOn: ['F'],
    formula: 'σ = F / A',
    calc: (s) =>
      `σ = ${fmtValue(F.values[s])} kN / ${CTX.A} m² = ${fmtValue(normalStress(F.values[s] * 1000, CTX.A) / 1e6)} MPa`,
  };
  const rAcVal = 20 * Math.log10(COMPROMIS.mpp * CTX.freq) - 47;
  const rAc: NamedVariable = {
    id: 'R_ac',
    name: 'Affaiblissement acoustique',
    symbol: 'R_ac',
    unit: 'dB',
    role: 'etat',
    values: all(rAcVal),
    dependsOn: ['mpp'],
    formula: 'R_ac = 20·log₁₀(m″·f) − 47',
    calc: () => `R_ac = 20·log₁₀(${COMPROMIS.mpp} × ${CTX.freq}) − 47 = ${fmtValue(rAcVal)} dB`,
  };
  // Inner-surface temperature: the wall the occupant FEELS (radiant comfort).
  // Resistance-ratio form of the steady-state conduction chain (EN ISO 6946):
  // the indoor AIR is held at the setpoint by the heating; the SURFACE drifts
  // towards the outside as insulation R gets weaker.
  const rSe = 0.04; // external surface resistance (m²K/W)
  const tIntOf = (s: ScenarioId) => (isWinter(s) ? CTX.tIntWinter : CTX.tIntSummer);
  const tSiOf = (s: ScenarioId) => {
    const tInt = tIntOf(s);
    return tInt + ((tExt.values[s] - tInt) * CTX.rSi) / (CTX.rSi + rVal + rSe);
  };
  const tSi: NamedVariable = {
    id: 'T_si',
    name: 'Température de surface intérieure du mur',
    symbol: 'T_si',
    unit: '°C',
    role: 'etat',
    values: mapValues(tExt.values, (_, s) => tSiOf(s)),
    dependsOn: ['T_ext', 'R'],
    formula: 'T_si = T_air + (T_ext − T_air)·R_si / (R_si + R + R_se)',
    calc: (s) =>
      `T_si = ${tIntOf(s)} + (${fmtValue(tExt.values[s])} − ${tIntOf(s)}) × ${CTX.rSi} / (${CTX.rSi} + ${fmtValue(
        rVal
      )} + ${rSe}) = ${fmtValue(tSiOf(s))} °C  (T_air = consigne ${tIntOf(s)} °C)`,
  };

  // PERFORMANCE variables — what the system DELIVERS. Their ranges are
  // requirements DEDUCED from the human comfort criteria (not the criteria
  // themselves): the chain continues below, down to the occupant.
  const dT = (t: number, s: ScenarioId) => Math.abs(tIntOf(s) - t);
  const qWall: NamedVariable = {
    id: 'q',
    name: 'Flux de chaleur traversant',
    symbol: 'q',
    unit: 'W/m²',
    role: 'performance',
    values: mapValues(tExt.values, (t, s) => heatFlux(COMPROMIS.lambda, dT(t, s), COMPROMIS.e)),
    dependsOn: ['T_ext', 'R'],
    formula: 'q = λ·ΔT / e',
    requirement: req(/Flux de chaleur/),
    calc: (s) =>
      `q = ${COMPROMIS.lambda.toFixed(3)} × |${tIntOf(s)} − ${fmtValue(tExt.values[s])}| / ${COMPROMIS.e.toFixed(
        3
      )} = ${fmtValue(heatFlux(COMPROMIS.lambda, dT(tExt.values[s], s), COMPROMIS.e))} W/m²`,
  };
  const bufferOf = (s: ScenarioId) => moistureBuffered(CTX.MBV, Math.abs(hr.values[s] - 50), CTX.wallArea);
  const buffer: NamedVariable = {
    id: 'm_tampon',
    name: 'Capacité tampon d’humidité',
    symbol: 'm',
    unit: 'g/j',
    role: 'performance',
    values: mapValues(hr.values, (_, s) => bufferOf(s)),
    dependsOn: ['HR_ext'],
    formula: 'm = MBV·ΔHR·A',
    requirement: req(/tampon/i),
    calc: (s) =>
      `m = ${CTX.MBV} × |${fmtValue(hr.values[s])} − 50| × ${CTX.wallArea} = ${fmtValue(bufferOf(s))} g/j`,
    levers:
      'Augmenter la surface de terre crue apparente (A tampon) ou un enduit à MBV plus élevé. Exigence déduite de m_vap : vérifier le critère humain HR_int — s’il reste en zone, l’exigence déduite était conservative.',
  };
  const SF: NamedVariable = {
    id: 'SF',
    name: 'Facteur de sécurité structurel',
    symbol: 'SF',
    unit: '—',
    role: 'performance',
    values: mapValues(sigma.values, (s) => safetyFactor(CTX.sigmaR, s * 1e6)),
    dependsOn: ['sigma'],
    formula: 'SF = σ_rupture / σ',
    requirement: req(/sécurité/i),
    calc: (s) => `SF = ${CTX.sigmaR / 1e6} MPa / ${fmtValue(sigma.values[s])} MPa = ${fmtValue(safetyFactor(CTX.sigmaR, sigma.values[s] * 1e6))}`,
  };
  const lIntOf = (s: ScenarioId) => Math.max(0, lext.values[s] - rAcVal);
  const lInt: NamedVariable = {
    id: 'L_int',
    name: 'Bruit résiduel intérieur',
    symbol: 'L_int',
    unit: 'dB(A)',
    role: 'performance',
    values: mapValues(lext.values, (_, s) => lIntOf(s)),
    dependsOn: ['L_ext', 'R_ac'],
    formula: 'L_int = max(0, L_ext − R_ac)',
    requirement: req(/[Bb]ruit/),
    calc: (s) => `L_int = max(0, ${fmtValue(lext.values[s])} − ${fmtValue(rAcVal)}) = ${fmtValue(lIntOf(s))} dB(A)`,
  };

  // CONFORT variables — THE HUMAN CRITERIA. The end of the tensor chain:
  // what the occupant actually feels, judged in ITS conformity zone. The
  // habitant environnant characterises the human (famille de 4, télétravail,
  // production de vapeur) ; ces critères en découlent.
  const tOpOf = (s: ScenarioId) => (tIntOf(s) + tSiOf(s)) / 2;
  const tOp: NamedVariable = {
    id: 'T_op',
    name: 'Température opérative ressentie',
    symbol: 'T_op',
    unit: '°C',
    role: 'confort',
    values: mapValues(tExt.values, (_, s) => tOpOf(s)),
    dependsOn: ['T_si'],
    formula: 'T_op = (T_air + T_si) / 2  (ASHRAE 55)',
    requirement: COMFORT_ZONES.tOp,
    calc: (s) => `T_op = (${tIntOf(s)} + ${fmtValue(tSiOf(s))}) / 2 = ${fmtValue(tOpOf(s))} °C`,
    levers:
      'Monter e (mur plus épais) et/ou baisser λ (matériau plus isolant, ou couche isolante rapportée) pour remonter T_si en hiver — au prix de plus de matière (σ, coût).',
  };
  const mVap = q2(/m_vap|vapeur/i, 600);
  const hrIntOf = (s: ScenarioId) => 50 + Math.max(0, mVap - bufferOf(s)) / CTX.gPerRH;
  const hrInt: NamedVariable = {
    id: 'HR_int',
    name: 'Humidité relative intérieure',
    symbol: 'HR_int',
    unit: '%',
    role: 'confort',
    values: mapValues(hr.values, (_, s) => hrIntOf(s)),
    dependsOn: ['m_tampon'],
    formula: 'HR_int = 50 + max(0, m_vap − m) / g%',
    requirement: COMFORT_ZONES.hrInt,
    calc: (s) =>
      `HR_int = 50 + max(0, ${mVap} − ${fmtValue(bufferOf(s))}) / ${CTX.gPerRH} = ${fmtValue(hrIntOf(s))} %  (m_vap = ${mVap} g/j produits par la famille)`,
    levers: 'Augmenter la surface de terre crue apparente (A tampon) — le MBV du matériau est le levier ; la peinture étanche le tue.',
  };
  const lPercu: NamedVariable = {
    id: 'L_percu',
    name: 'Calme perçu (télétravail)',
    symbol: 'L_p',
    unit: 'dB(A)',
    role: 'confort',
    values: mapValues(lext.values, (_, s) => lIntOf(s)),
    dependsOn: ['L_int'],
    formula: 'L_p = L_int  (au poste de télétravail)',
    requirement: COMFORT_ZONES.calme,
    calc: (s) => `L_p = L_int = ${fmtValue(lIntOf(s))} dB(A)`,
    levers: 'Monter m″ (masse surfacique) : chaque doublement gagne ≈ 6 dB — mais alourdit la structure (σ monte).',
  };
  const sfHab: NamedVariable = {
    id: 'SF_hab',
    name: 'Sécurité structurelle des occupants',
    symbol: 'SF_h',
    unit: '—',
    role: 'confort',
    values: mapValues(sigma.values, (s) => safetyFactor(CTX.sigmaR, s * 1e6)),
    dependsOn: ['SF'],
    formula: 'SF_h = SF  (marge avant rupture du mur porteur)',
    requirement: COMFORT_ZONES.securite,
    calc: (s) => `SF_h = SF = ${fmtValue(safetyFactor(CTX.sigmaR, sigma.values[s] * 1e6))}`,
    levers: 'Augmenter la section A ou la résistance σ_rupture — attention : épaissir/alourdir le mur (e, m″) charge aussi F.',
  };

  return {
    scenarios: SCENARIOS,
    variables: [tExt, hr, F, lext, e, lambda, mpp, R, alpha, sigma, rAc, tSi, qWall, buffer, SF, lInt, tOp, hrInt, lPercu, sfHab],
  };
}

/** Is this performance value inside its conformity range? */
export const isConform = (v: NamedVariable, s: ScenarioId): boolean | undefined =>
  v.requirement ? v.values[s] >= v.requirement.min && v.values[s] <= v.requirement.max : undefined;

/** Human formatting of a physical value (shared by every quantitative view). */
export const fmtValue = (v: number): string =>
  Number.isInteger(v)
    ? v.toString()
    : Math.abs(v) >= 100
    ? v.toFixed(0)
    : Math.abs(v) >= 1
    ? v.toFixed(1)
    : v.toPrecision(3);
