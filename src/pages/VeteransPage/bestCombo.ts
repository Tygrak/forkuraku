import {
    aggregateFactors,
    calculateAffinity,
    calculateGrandparentAffinity,
    calculatePairAffinity,
    calculateSparkChance,
    FactorItem,
    getFactorCategory,
} from "../../data/VeteransHelper";
import UMDatabaseWrapper from "../../data/UMDatabaseWrapper";
import { getGuaranteedCardSkills, getGuaranteedCharacterSkills } from "../../data/GameToraCharacterSkills";
import { AptitudeGrade, getCardBaseAptitudes, getCharacterBaseAptitudes } from "../../data/GameToraCharacterAptitudes";
import { getSparkScoreValue } from "./customScoring";
import { CustomScoringConfig, Veteran } from "./types";

export type AptitudeGroup = "Ground" | "Distance" | "Strategy";

export type AptitudeOption = {
    key: number;
    label: string;
    shortLabel: string;
    group: AptitudeGroup;
    color: string;
};

export const APTITUDE_OPTIONS: AptitudeOption[] = [
    { key: 11, label: "Turf", shortLabel: "Turf", group: "Ground", color: "#9ccc65" },
    { key: 12, label: "Dirt", shortLabel: "Dirt", group: "Ground", color: "#c49a6c" },
    { key: 31, label: "Sprint", shortLabel: "Sprint", group: "Distance", color: "#4fc3f7" },
    { key: 32, label: "Mile", shortLabel: "Mile", group: "Distance", color: "#4dd0e1" },
    { key: 33, label: "Medium", shortLabel: "Medium", group: "Distance", color: "#7986cb" },
    { key: 34, label: "Long", shortLabel: "Long", group: "Distance", color: "#9575cd" },
    { key: 21, label: "Front Runner", shortLabel: "Front", group: "Strategy", color: "#ffd54f" },
    { key: 22, label: "Pace Chaser", shortLabel: "Pace", group: "Strategy", color: "#ffb74d" },
    { key: 23, label: "Late Surger", shortLabel: "Late", group: "Strategy", color: "#ff8a65" },
    { key: 24, label: "End Closer", shortLabel: "End", group: "Strategy", color: "#e57373" },
];

export const APTITUDE_GROUP_LABELS: Record<AptitudeGroup, string> = {
    Ground: "Ground",
    Distance: "Distance",
    Strategy: "Strategy",
};

const APTITUDE_BY_KEY = new Map(APTITUDE_OPTIONS.map(option => [option.key, option]));
const APTITUDE_INDEX_BY_KEY = new Map(APTITUDE_OPTIONS.map((option, index) => [option.key, index]));

export const getAptitudeOption = (key: number): AptitudeOption | undefined => APTITUDE_BY_KEY.get(key);

export const APTITUDE_GRADE_ORDER: AptitudeGrade[] = ["G", "F", "E", "D", "C", "B", "A", "S"];

const APTITUDE_GRADE_INDEX = new Map<AptitudeGrade, number>(
    APTITUDE_GRADE_ORDER.map((grade, index) => [grade, index]),
);
const APTITUDE_A_GRADE_INDEX = APTITUDE_GRADE_INDEX.get("A")!;
const APTITUDE_S_GRADE_INDEX = APTITUDE_GRADE_INDEX.get("S")!;

export const getAptitudeGradeIndex = (grade: AptitudeGrade | null | undefined): number | null =>
    grade ? APTITUDE_GRADE_INDEX.get(grade) ?? null : null;

// Initial inheritance: the first rank costs 1★, then each further rank costs 3★.
// A total of 10★ gives four ranks, which is the maximum.
export const getStarGradeUps = (stars: number): number =>
    stars <= 0 ? 0 : Math.min(4, Math.ceil(stars / 3));

// Initial inheritance can raise an aptitude to A, but never to S. S only comes
// from the two mid-run spark proc inheritance events.
export const getStartingAptitudeGrade = (
    baseGrade: AptitudeGrade | null | undefined,
    stars: number,
): AptitudeGrade | null => {
    const baseIndex = getAptitudeGradeIndex(baseGrade);
    if (baseIndex === null) return null;

    const index = baseIndex >= APTITUDE_A_GRADE_INDEX
        ? baseIndex
        : Math.min(APTITUDE_A_GRADE_INDEX, baseIndex + getStarGradeUps(stars));
    return APTITUDE_GRADE_ORDER[index];
};

export const getProcsNeededForS = (startingGrade: AptitudeGrade | null | undefined): number => {
    const index = getAptitudeGradeIndex(startingGrade);
    if (index === null) return 1;
    return Math.max(0, APTITUDE_S_GRADE_INDEX - index);
};

export const getTargetBaseAptitudeGrade = (
    targetCardId: number | null,
    aptitudeKey: number,
): AptitudeGrade | null => {
    if (targetCardId === null) return null;

    const index = APTITUDE_INDEX_BY_KEY.get(aptitudeKey);
    if (index === undefined) return null;

    return getCardBaseAptitudes(targetCardId)?.[index] ?? null;
};

export type AptitudeSourceSlot = "self" | "gp1" | "gp2";

export type AptitudeSparkEntry = {
    aptitudeKey: number;
    factorId: number;
    level: number;
    sourceSlot: AptitudeSourceSlot;
};

export type AptitudeTotals = {
    stars: number;
    sparks: number;
};

export type VeteranAptitudeData = {
    totals: Map<number, AptitudeTotals>;
    entriesByAptitude: Map<number, AptitudeSparkEntry[]>;
    allFactors: FactorItem[];
};

export type ExpectedSpark = {
    name: string;
    category: number;
    factorId: number;
    level: number;
    sourceSlot: AptitudeSourceSlot;
    isGold: boolean;
    chance: number | null;
    perEventChance: number | null;
};

export type CombinedSpark = {
    name: string;
    category: number;
    factorId: number;
    isGold: boolean;
    stars: number;
    copies: number;
    chance: number;
};

export type BestComboScoreWeights = {
    sTarget: number;
    spark: number;
    stat: number;
    parentSkill: number;
    parentPink: number;
};

export const DEFAULT_BEST_COMBO_SCORE_WEIGHTS: BestComboScoreWeights = {
    sTarget: 4,
    spark: 10,
    stat: 1,
    parentSkill: 0.5,
    parentPink: 1,
};

export type StatKey = "speed" | "stamina" | "power" | "guts" | "wit";

export const STAT_KEYS: StatKey[] = ["speed", "stamina", "power", "guts", "wit"];

export const STAT_LABELS: Record<StatKey, string> = {
    speed: "Speed",
    stamina: "Stamina",
    power: "Power",
    guts: "Guts",
    wit: "Wit",
};

export type StatGainSource = "blueInitial" | "blueMid" | "race" | "scenario";

export type StatSourceBreakdown = Record<StatGainSource, number>;

export type StatGainBreakdown = Record<StatKey, number>;

export type StatSourceBreakdownMap = Record<StatKey, StatSourceBreakdown>;

export type BestComboScoreBreakdown = {
    sTargets: number;
    sparks: number;
    stats: number;
    total: number;
    statGains: StatGainBreakdown;
    statSources: StatSourceBreakdownMap;
};

export type BestComboMode = "target" | "gp";

export type GpSkillChance = {
    name: string;
    factorId: number;
    parentOwners: number;
    lineageMembers: number;
    inheritChance: number;
    spawnChance: number;
    combinedChance: number;
    value: number;
    contribution: number;
};

export type BestComboConditionMetric = "stars" | "sparks";

export type BestComboCondition = {
    id: string;
    aptitudeKey: number;
    metric: BestComboConditionMetric;
    min: number;
};

export type AptitudeSChanceDetail = {
    aptitudeKey: number;
    baseGrade: AptitudeGrade | null;
    startingGrade: AptitudeGrade;
    stars: number;
    gradeUps: number;
    procsNeeded: number;
    procChances: number[];
    chance: number;
};

export type BestComboResult = {
    parent1: Veteran;
    parent2: Veteran;
    totals: Map<number, AptitudeTotals>;
    sChances: Map<number, number>;
    sChanceDetails: Map<number, AptitudeSChanceDetail>;
    combinedSChance: number;
    minSAptitudeChance: number;
    relevantStars: number;
    affinity: number;
    conditionValues: number[];
    inheritanceScore: number;
    scoreBreakdown: BestComboScoreBreakdown;
    gpSkills: GpSkillChance[];
    gpSkillScore: number;
    gpPinkScore: number;
    firstTree: Record<AptitudeSourceSlot, number>;
    secondTree: Record<AptitudeSourceSlot, number>;
};

export type BestComboEvaluation = {
    results: BestComboResult[];
    evaluatedCount: number;
    matchedCount: number;
};

export const buildVeteranAptitudeData = (veteran: Veteran): VeteranAptitudeData => {
    const totals = new Map<number, AptitudeTotals>();
    const entriesByAptitude = new Map<number, AptitudeSparkEntry[]>();
    const allFactors = aggregateFactors(veteran);

    for (const factor of allFactors) {
        if (factor.category !== 2) continue;

        const aptitudeKey = Math.floor(factor.factorId / 100);
        if (!APTITUDE_BY_KEY.has(aptitudeKey)) continue;

        const entry: AptitudeSparkEntry = {
            aptitudeKey,
            factorId: factor.factorId,
            level: factor.level,
            sourceSlot: factor.sourceSlot,
        };

        const aptitudeEntries = entriesByAptitude.get(aptitudeKey) ?? [];
        aptitudeEntries.push(entry);
        entriesByAptitude.set(aptitudeKey, aptitudeEntries);

        const total = totals.get(aptitudeKey) ?? { stars: 0, sparks: 0 };
        total.stars += factor.level;
        total.sparks += 1;
        totals.set(aptitudeKey, total);
    }

    return { totals, entriesByAptitude, allFactors };
};

export const getSparkInheritanceBreakdown = (
    veteran: Veteran,
    tree: Record<AptitudeSourceSlot, number>,
): ExpectedSpark[] => {
    return aggregateFactors(veteran).map(factor => {
        const perInheritance = calculateSparkChance(
            factor.category,
            factor.factorId,
            factor.level,
            tree[factor.sourceSlot],
        );

        return {
            name: factor.name,
            category: factor.category,
            factorId: factor.factorId,
            level: factor.level,
            sourceSlot: factor.sourceSlot,
            isGold: factor.isGold,
            chance: perInheritance === null
                ? null
                : (1 - (1 - perInheritance / 100) ** 2) * 100,
            perEventChance: perInheritance,
        };
    });
};

export const combineSparkBreakdowns = (
    breakdowns: ExpectedSpark[][],
): CombinedSpark[] => {
    const groups = new Map<string, ExpectedSpark[]>();

    for (const breakdown of breakdowns) {
        for (const entry of breakdown) {
            const key = `${entry.category}:${entry.name}`;
            const group = groups.get(key) ?? [];
            group.push(entry);
            groups.set(key, group);
        }
    }

    return Array.from(groups.values()).map(entries => {
        let nonePerInheritance = 1;
        for (const entry of entries) {
            if (entry.perEventChance !== null) {
                nonePerInheritance *= Math.max(0, 1 - entry.perEventChance / 100);
            }
        }

        const first = entries[0];
        return {
            name: first.name,
            category: first.category,
            factorId: first.factorId,
            isGold: entries.some(entry => entry.isGold),
            stars: entries.reduce((sum, entry) => sum + entry.level, 0),
            copies: entries.length,
            chance: (1 - nonePerInheritance * nonePerInheritance) * 100,
        };
    }).sort((a, b) =>
        a.category - b.category
        || b.chance - a.chance
        || a.name.localeCompare(b.name),
    );
};

const combineTotals = (
    first: Map<number, AptitudeTotals>,
    second: Map<number, AptitudeTotals>,
): Map<number, AptitudeTotals> => {
    const combined = new Map<number, AptitudeTotals>();
    for (const [key, total] of first) {
        combined.set(key, { ...total });
    }
    for (const [key, total] of second) {
        const current = combined.get(key) ?? { stars: 0, sparks: 0 };
        current.stars += total.stars;
        current.sparks += total.sparks;
        combined.set(key, current);
    }
    return combined;
};

const getAptitudeProcDistribution = (
    aptitudeKey: number,
    first: VeteranAptitudeData,
    second: VeteranAptitudeData,
    firstTree: Record<AptitudeSourceSlot, number>,
    secondTree: Record<AptitudeSourceSlot, number>,
): number[] => {
    let singleEvent = [1];

    const applyEntries = (
        entries: AptitudeSparkEntry[] | undefined,
        tree: Record<AptitudeSourceSlot, number>,
    ) => {
        for (const entry of entries ?? []) {
            const chance = calculateSparkChance(2, entry.factorId, entry.level, tree[entry.sourceSlot]);
            if (chance === null) continue;

            const probability = Math.max(0, Math.min(1, chance / 100));
            const next = new Array(singleEvent.length + 1).fill(0);
            for (let procs = 0; procs < singleEvent.length; procs++) {
                next[procs] += singleEvent[procs] * (1 - probability);
                next[procs + 1] += singleEvent[procs] * probability;
            }
            singleEvent = next;
        }
    };

    applyEntries(first.entriesByAptitude.get(aptitudeKey), firstTree);
    applyEntries(second.entriesByAptitude.get(aptitudeKey), secondTree);

    // Two mid-run inheritance events, each rolling the same lineages.
    const total = new Array(singleEvent.length * 2 - 1).fill(0);
    for (let firstProcs = 0; firstProcs < singleEvent.length; firstProcs++) {
        for (let secondProcs = 0; secondProcs < singleEvent.length; secondProcs++) {
            total[firstProcs + secondProcs] += singleEvent[firstProcs] * singleEvent[secondProcs];
        }
    }
    return total;
};

const getAptitudeProcChances = (distribution: number[], maxProcs: number): number[] => {
    const chances: number[] = [];

    for (let needed = 1; needed <= maxProcs; needed++) {
        let chance = 0;
        for (let procs = needed; procs < distribution.length; procs++) {
            chance += distribution[procs];
        }
        chances.push(chance * 100);
    }

    return chances;
};

const getGrandparent = (veteran: Veteran, positionId: 10 | 20) =>
    veteran.succession_chara_array.find(parent => parent.position_id === positionId);

// Guide inheritance stat table:
// - Blue initial +5/+12/+21, mid-run 1-10 / 1-16 / 1-28.
// - G1 race sparks roll 3/6/9.
// - Scenario sparks roll 10/20/30 for two stats.
const BLUE_INITIAL_STATS = [5, 12, 21];
const BLUE_MID_RUN_STATS = [5.5, 8.5, 14.5];
const RACE_MID_RUN_STATS = 6;
const SCENARIO_MID_RUN_STATS = 40;

const BLUE_STAT_BY_KEY: Record<number, StatKey> = {
    1: "speed",
    2: "stamina",
    3: "power",
    4: "guts",
    5: "wit",
};

const BLUE_MULTIPLIER_KEY_BY_STAT: Record<StatKey, string> = {
    speed: "1",
    stamina: "2",
    power: "3",
    guts: "4",
    wit: "5",
};

// G1 race factor stats from GameTora's G1 race spark list.
const RACE_STAT_BY_KEY: Record<number, StatKey[]> = {
    10001: ["power"], // February Stakes
    10002: ["speed"], // Takamatsunomiya Kinen
    10003: ["guts"], // Osaka Hai
    10004: ["guts"], // Oka Sho
    10005: ["power"], // Satsuki Sho
    10006: ["stamina"], // Tenno Sho (Spring)
    10007: ["speed", "power"], // NHK Mile Cup
    10008: ["speed", "power"], // Victoria Mile
    10009: ["stamina"], // Japanese Oaks
    10010: ["guts"], // Tokyo Yushun (Japanese Derby)
    10011: ["speed"], // Yasuda Kinen
    10012: ["guts"], // Takarazuka Kinen
    10013: ["speed"], // Sprinters Stakes
    10014: ["wit"], // Shuka Sho
    10015: ["stamina"], // Kikuka Sho
    10016: ["speed"], // Tenno Sho (Autumn)
    10017: ["stamina"], // Queen Elizabeth II Cup
    10018: ["speed"], // Mile Championship
    10019: ["stamina"], // Japan Cup
    10020: ["power"], // Champions Cup
    10021: ["speed", "power"], // Hanshin Juvenile Fillies
    10022: ["speed", "guts"], // Asahi Hai Futurity Stakes
    10023: ["guts"], // Arima Kinen
    10024: ["speed", "stamina"], // Hopeful Stakes
    10025: ["power"], // Teio Sho
    10026: ["power"], // Japan Dirt Derby
    10027: ["speed", "guts"], // JBC Ladies' Classic
    10028: ["power", "guts"], // JBC Sprint
    10029: ["stamina", "guts"], // JBC Classic
    10030: ["power"], // Tokyo Daishoten
    10031: ["wit"], // M.C. Nambu Hai
    10032: ["speed"], // Kashiwa Kinen
    10033: ["power"], // Zen-Nippon Junior Yushun
    10034: ["wit"], // Kawasaki Kinen
};

// Scenario factor stat pairs from the same GameTora data.
const SCENARIO_STAT_BY_KEY: Record<number, StatKey[]> = {
    30001: ["speed", "stamina"], // URA Finale
    30002: ["power", "wit"], // Unity Cup
    30003: ["stamina", "guts"], // TS Climax / Trackblazer
    30004: ["speed", "guts"], // Our Grand Concert
    30005: ["speed", "power"], // Grand Masters
};

const starIndex = (level: number): number =>
    Math.min(3, Math.max(1, Math.trunc(level))) - 1;

const createStatGains = (): StatGainBreakdown => ({
    speed: 0,
    stamina: 0,
    power: 0,
    guts: 0,
    wit: 0,
});

const createStatSources = (): StatSourceBreakdownMap => Object.fromEntries(
    STAT_KEYS.map(stat => [
        stat,
        { blueInitial: 0, blueMid: 0, race: 0, scenario: 0 },
    ]),
) as StatSourceBreakdownMap;

const getComboScore = (
    first: VeteranAptitudeData,
    second: VeteranAptitudeData,
    firstTree: Record<AptitudeSourceSlot, number>,
    secondTree: Record<AptitudeSourceSlot, number>,
    sAptitudeKeys: number[],
    sChances: Map<number, number>,
    customConfig: CustomScoringConfig,
    weights: BestComboScoreWeights,
): BestComboScoreBreakdown => {
    const statGains = createStatGains();
    const statSources = createStatSources();

    const addStat = (stat: StatKey, source: StatGainSource, amount: number) => {
        if (!Number.isFinite(amount) || amount === 0) return;
        statGains[stat] += amount;
        statSources[stat][source] += amount;
    };

    const namedSparks = new Map<string, { nonePerInheritance: number; maxValue: number }>();

    const addFactors = (
        factors: FactorItem[],
        tree: Record<AptitudeSourceSlot, number>,
    ) => {
        for (const factor of factors) {
            const perInheritance = calculateSparkChance(
                factor.category,
                factor.factorId,
                factor.level,
                tree[factor.sourceSlot],
            );
            if (perInheritance === null) continue;

            const runChance = 1 - (1 - perInheritance / 100) ** 2;

            if (factor.category === 1) {
                const aptitudeKey = Math.floor(factor.factorId / 100);
                const stat = BLUE_STAT_BY_KEY[aptitudeKey];
                if (stat) {
                    const index = starIndex(factor.level);
                    addStat(stat, "blueInitial", BLUE_INITIAL_STATS[index] ?? 0);
                    addStat(stat, "blueMid", runChance * (BLUE_MID_RUN_STATS[index] ?? 0));
                }
                continue;
            }

            if (factor.category === 4) {
                const factorKey = Math.floor(factor.factorId / 100);
                if (String(factor.factorId).startsWith("3")) {
                    const mappedStats = SCENARIO_STAT_BY_KEY[factorKey];
                    const stats = mappedStats ?? STAT_KEYS;
                    const perStat = mappedStats
                        ? SCENARIO_MID_RUN_STATS / mappedStats.length
                        : SCENARIO_MID_RUN_STATS / STAT_KEYS.length;
                    for (const stat of stats) {
                        addStat(stat, "scenario", runChance * perStat);
                    }
                } else {
                    const mappedStats = RACE_STAT_BY_KEY[factorKey];
                    const stats = mappedStats ?? STAT_KEYS;
                    const perStat = mappedStats
                        ? RACE_MID_RUN_STATS
                        : RACE_MID_RUN_STATS / STAT_KEYS.length;
                    for (const stat of stats) {
                        addStat(stat, "race", runChance * perStat);
                    }
                }
                continue;
            }

            if (factor.category !== 3 && factor.category !== 5) continue;

            const value = getSparkScoreValue(factor, customConfig);
            if (value <= 0) continue;

            const key = `${factor.category}:${factor.name}`;
            const group = namedSparks.get(key) ?? {
                nonePerInheritance: 1,
                maxValue: 0,
            };
            group.nonePerInheritance *= Math.max(0, 1 - perInheritance / 100);
            group.maxValue = Math.max(group.maxValue, value);
            namedSparks.set(key, group);
        }
    };

    addFactors(first.allFactors, firstTree);
    addFactors(second.allFactors, secondTree);

    let sparkScore = 0;
    for (const group of namedSparks.values()) {
        sparkScore += group.maxValue * (1 - group.nonePerInheritance * group.nonePerInheritance);
    }

    const sTargets = sAptitudeKeys.reduce(
        (total, key) => total + (sChances.get(key) ?? 0) * weights.sTarget,
        0,
    );
    const sparks = sparkScore * weights.spark;
    const statScore = STAT_KEYS.reduce((total, stat) => {
        const multiplier = customConfig.blueMultipliers[BLUE_MULTIPLIER_KEY_BY_STAT[stat]] ?? 1;
        return total + statGains[stat] * multiplier;
    }, 0);
    const stats = statScore * weights.stat;

    return {
        sTargets,
        sparks,
        stats,
        total: sTargets + sparks + stats,
        statGains,
        statSources,
    };
};

let skillRarityByName: Map<string, number> | null = null;

const getSkillSpawnBaseChance = (skillName: string): number => {
    if (!skillRarityByName) {
        skillRarityByName = new Map();
        for (const skill of Object.values(UMDatabaseWrapper.skills)) {
            if (!skill.name) continue;
            skillRarityByName.set(
                skill.name,
                Math.max(skillRarityByName.get(skill.name) ?? 0, skill.rarity ?? 0),
            );
        }
    }

    if ((skillRarityByName.get(skillName) ?? 0) >= 2) return 40;
    if (/[○◎]/.test(skillName)) return 25;
    return 20;
};

let whiteSkillKeyByName: Map<string, number> | null = null;

const getWhiteSkillValueByName = (
    skillName: string,
    config: CustomScoringConfig,
): { value: number; factorId: number } | null => {
    if (!whiteSkillKeyByName) {
        whiteSkillKeyByName = new Map();
        const textData = UMDatabaseWrapper.textData[147] ?? {};

        for (const [indexText, text] of Object.entries(textData)) {
            const factorId = Number(indexText);
            if (!Number.isFinite(factorId) || getFactorCategory(factorId) !== 5 || !text.text) {
                continue;
            }
            if (!whiteSkillKeyByName.has(text.text)) {
                whiteSkillKeyByName.set(text.text, Math.floor(factorId / 100));
            }
        }
    }

    const factorKey = whiteSkillKeyByName.get(skillName);
    if (factorKey === undefined) return null;

    const factorId = factorKey * 100 + 3;
    let value = 0;

    // Target-guaranteed skills should still appear when they are not in the active style preset.
    for (const styleWeights of Object.values(config.skillSparkWeights)) {
        const weights = styleWeights?.[String(factorKey)];
        if (weights) {
            value = Math.max(value, weights[2] ?? 0);
        }
    }

    return value > 0 ? { value, factorId } : null;
};

const getGpSkillScore = (
    first: VeteranAptitudeData,
    second: VeteranAptitudeData,
    firstTree: Record<AptitudeSourceSlot, number>,
    secondTree: Record<AptitudeSourceSlot, number>,
    customConfig: CustomScoringConfig,
    weights: BestComboScoreWeights,
    guaranteedTargetSkills: Set<string>,
): { score: number; skillScore: number; pinkScore: number; skills: GpSkillChance[] } => {
    const groups = new Map<string, {
        nonePerInheritance: number;
        value: number;
        factorId: number;
        lineageMembers: Set<string>;
        parentOwners: Set<number>;
    }>();

    const addFactors = (
        factors: FactorItem[],
        tree: Record<AptitudeSourceSlot, number>,
        parentIndex: number,
    ) => {
        for (const factor of factors) {
            if (factor.category !== 5) continue;

            const perInheritance = calculateSparkChance(
                factor.category,
                factor.factorId,
                factor.level,
                tree[factor.sourceSlot],
            );
            if (perInheritance === null) continue;

            const group = groups.get(factor.name) ?? {
                nonePerInheritance: 1,
                value: 0,
                factorId: factor.factorId,
                lineageMembers: new Set<string>(),
                parentOwners: new Set<number>(),
            };

            group.nonePerInheritance *= Math.max(0, 1 - perInheritance / 100);
            group.value = Math.max(group.value, getSparkScoreValue(factor, customConfig));
            group.lineageMembers.add(`${parentIndex}:${factor.sourceSlot}`);
            if (factor.sourceSlot === "self") {
                group.parentOwners.add(parentIndex);
            }
            groups.set(factor.name, group);
        }
    };

    addFactors(first.allFactors, firstTree, 1);
    addFactors(second.allFactors, secondTree, 2);

    for (const skillName of guaranteedTargetSkills) {
        const preset = getWhiteSkillValueByName(skillName, customConfig);
        if (!preset) continue;

        const group = groups.get(skillName) ?? {
            nonePerInheritance: 1,
            value: 0,
            factorId: preset.factorId,
            lineageMembers: new Set<string>(),
            parentOwners: new Set<number>(),
        };
        group.value = Math.max(group.value, preset.value);
        groups.set(skillName, group);
    }

    const skills: GpSkillChance[] = [];
    let skillScore = 0;

    for (const [name, group] of groups) {
        if (group.value <= 0) continue;

        const lineageMembers = group.lineageMembers.size;
        const parentOwners = group.parentOwners.size;
        const inheritChance = guaranteedTargetSkills.has(name)
            ? 100
            : (1 - group.nonePerInheritance * group.nonePerInheritance) * 100;
        const spawnChance = Math.min(100, getSkillSpawnBaseChance(name) * Math.pow(1.1, lineageMembers));
        const combinedChance = inheritChance * spawnChance / 100;
        const parentMultiplier = 1 + weights.parentSkill * parentOwners;
        const contribution = group.value * (combinedChance / 100) * weights.spark * parentMultiplier;

        skills.push({
            name,
            factorId: group.factorId,
            parentOwners,
            lineageMembers,
            inheritChance,
            spawnChance,
            combinedChance,
            value: group.value,
            contribution,
        });
        skillScore += contribution;
    }

    skills.sort((a, b) =>
        b.contribution - a.contribution
        || b.combinedChance - a.combinedChance
        || a.name.localeCompare(b.name),
    );

    let pinkScore = 0;
    for (const factor of [...first.allFactors, ...second.allFactors]) {
        if (factor.category === 2 && factor.sourceSlot === "self") {
            pinkScore += getSparkScoreValue(factor, customConfig);
        }
    }
    pinkScore *= weights.parentPink;

    return {
        score: skillScore + pinkScore,
        skillScore,
        pinkScore,
        skills,
    };
};

export const evaluateBestCombos = (
    veterans: Veteran[],
    targetCharaId: number,
    targetCardId: number | null,
    sAptitudeKeys: number[],
    conditions: BestComboCondition[],
    scoringConfig?: CustomScoringConfig,
    dataByVeteran?: Map<Veteran, VeteranAptitudeData>,
    requiredParent1CardIds?: number[] | null,
    requiredParent2CardIds?: number[] | null,
    scoreWeights: BestComboScoreWeights = DEFAULT_BEST_COMBO_SCORE_WEIGHTS,
    pairFilter?: (first: Veteran, second: Veteran) => boolean,
    mode: BestComboMode = "target",
): BestComboEvaluation => {
    const dataMap = dataByVeteran ?? new Map(veterans.map(veteran => [veteran, buildVeteranAptitudeData(veteran)]));
    const soloAffinity = new Map<Veteran, number>();
    const grandparentAffinity = new Map<Veteran, { gp1: number; gp2: number }>();
    for (const veteran of veterans) {
        soloAffinity.set(veteran, calculateAffinity(veteran, targetCharaId));
        grandparentAffinity.set(veteran, {
            gp1: calculateGrandparentAffinity(getGrandparent(veteran, 10), veteran, targetCharaId),
            gp2: calculateGrandparentAffinity(getGrandparent(veteran, 20), veteran, targetCharaId),
        });
    }

    const results: BestComboResult[] = [];
    let evaluatedCount = 0;
    const requiredParent1 = new Set(requiredParent1CardIds ?? []);
    const requiredParent2 = new Set(requiredParent2CardIds ?? []);
    const targetName = UMDatabaseWrapper.charas[targetCharaId]?.name;
    const targetBaseAptitudes = targetCardId !== null
        ? getCardBaseAptitudes(targetCardId)
        : getCharacterBaseAptitudes(targetCharaId);
    const guaranteedTargetSkills = mode === "gp"
        ? targetCardId !== null
            ? getGuaranteedCardSkills(targetCardId)
            : getGuaranteedCharacterSkills(targetCharaId)
        : new Set<string>();

    for (let i = 0; i < veterans.length; i++) {
        const parent1 = veterans[i];
        const first = dataMap.get(parent1);
        if (!first) continue;
        const parent1CharaId = Math.floor(parent1.card_id / 100);
        const parent1Name = UMDatabaseWrapper.charas[parent1CharaId]?.name;

        for (let j = i + 1; j < veterans.length; j++) {
            const parent2 = veterans[j];
            const second = dataMap.get(parent2);
            if (!second) continue;

            // Two costumes of the same Uma are still the same parent name, so skip them.
            const parent2CharaId = Math.floor(parent2.card_id / 100);
            const parent2Name = UMDatabaseWrapper.charas[parent2CharaId]?.name;
            if (parent1CharaId === parent2CharaId || (!!parent1Name && parent1Name === parent2Name)) {
                continue;
            }

            // An Uma cannot be its own parent.
            if (
                parent1CharaId === targetCharaId
                || parent2CharaId === targetCharaId
                || (!!targetName && (parent1Name === targetName || parent2Name === targetName))
            ) {
                continue;
            }

            if (pairFilter && !pairFilter(parent1, parent2)) continue;

            const forwardMatch = (requiredParent1.size === 0 || requiredParent1.has(parent1.card_id))
                && (requiredParent2.size === 0 || requiredParent2.has(parent2.card_id));
            const reverseMatch = (requiredParent1.size === 0 || requiredParent1.has(parent2.card_id))
                && (requiredParent2.size === 0 || requiredParent2.has(parent1.card_id));
            if (!forwardMatch && !reverseMatch) continue;

            evaluatedCount++;

            const conditionValues: number[] = [];
            let matchesConditions = true;

            for (const condition of conditions) {
                const firstTotals = first.totals.get(condition.aptitudeKey);
                const secondTotals = second.totals.get(condition.aptitudeKey);
                const value = condition.metric === "stars"
                    ? (firstTotals?.stars ?? 0) + (secondTotals?.stars ?? 0)
                    : (firstTotals?.sparks ?? 0) + (secondTotals?.sparks ?? 0);

                conditionValues.push(value);
                if (value < Math.max(0, condition.min)) {
                    matchesConditions = false;
                    break;
                }
            }

            if (!matchesConditions) continue;

            const firstAffinity = soloAffinity.get(parent1) ?? 0;
            const secondAffinity = soloAffinity.get(parent2) ?? 0;
            const pairAffinity = calculatePairAffinity(parent1, parent2);
            const affinity = firstAffinity + secondAffinity + pairAffinity;

            const firstTree: Record<AptitudeSourceSlot, number> = {
                self: firstAffinity + pairAffinity,
                gp1: grandparentAffinity.get(parent1)?.gp1 ?? 0,
                gp2: grandparentAffinity.get(parent1)?.gp2 ?? 0,
            };
            const secondTree: Record<AptitudeSourceSlot, number> = {
                self: secondAffinity + pairAffinity,
                gp1: grandparentAffinity.get(parent2)?.gp1 ?? 0,
                gp2: grandparentAffinity.get(parent2)?.gp2 ?? 0,
            };

            const totals = combineTotals(first.totals, second.totals);
            const sChances = new Map<number, number>();
            const sChanceDetails = new Map<number, AptitudeSChanceDetail>();
            let combinedSChance = 1;
            let minSAptitudeChance = 100;
            let relevantStars = 0;

            for (const aptitudeKey of sAptitudeKeys) {
                const stars = totals.get(aptitudeKey)?.stars ?? 0;
                const baseGrade = targetBaseAptitudes?.[APTITUDE_INDEX_BY_KEY.get(aptitudeKey) ?? -1] ?? null;
                const startingGrade = getStartingAptitudeGrade(baseGrade, stars) ?? "A";
                const procsNeeded = getProcsNeededForS(startingGrade);
                const procChances = getAptitudeProcChances(
                    getAptitudeProcDistribution(aptitudeKey, first, second, firstTree, secondTree),
                    procsNeeded,
                );
                const chance = procsNeeded <= 0 ? 100 : procChances[procsNeeded - 1] ?? 0;

                sChances.set(aptitudeKey, chance);
                sChanceDetails.set(aptitudeKey, {
                    aptitudeKey,
                    baseGrade,
                    startingGrade,
                    stars,
                    gradeUps: getStarGradeUps(stars),
                    procsNeeded,
                    procChances,
                    chance,
                });
                combinedSChance *= chance / 100;
                minSAptitudeChance = Math.min(minSAptitudeChance, chance);
                relevantStars += stars;
            }

            let gpSkills: GpSkillChance[] = [];
            let gpSkillScore = 0;
            let gpPinkScore = 0;
            const scoreBreakdown = scoringConfig
                ? mode === "gp"
                    ? (() => {
                        const gpScore = getGpSkillScore(
                            first,
                            second,
                            firstTree,
                            secondTree,
                            scoringConfig,
                            scoreWeights,
                            guaranteedTargetSkills,
                        );
                        gpSkills = gpScore.skills;
                        gpSkillScore = gpScore.skillScore;
                        gpPinkScore = gpScore.pinkScore;
                        return {
                            sTargets: 0,
                            sparks: gpScore.skillScore + gpScore.pinkScore,
                            stats: 0,
                            total: gpScore.score,
                            statGains: createStatGains(),
                            statSources: createStatSources(),
                        };
                    })()
                    : getComboScore(
                        first,
                        second,
                        firstTree,
                        secondTree,
                        sAptitudeKeys,
                        sChances,
                        scoringConfig,
                        scoreWeights,
                    )
                : {
                    sTargets: 0,
                    sparks: 0,
                    stats: 0,
                    total: 0,
                    statGains: createStatGains(),
                    statSources: createStatSources(),
                };

            results.push({
                parent1,
                parent2,
                totals,
                sChances,
                sChanceDetails,
                combinedSChance: sAptitudeKeys.length > 0 ? combinedSChance * 100 : 0,
                minSAptitudeChance: sAptitudeKeys.length > 0 ? minSAptitudeChance : 0,
                relevantStars,
                affinity,
                conditionValues,
                inheritanceScore: scoreBreakdown.total,
                scoreBreakdown,
                gpSkills,
                gpSkillScore,
                gpPinkScore,
                firstTree,
                secondTree,
            });
        }
    }

    results.sort((a, b) =>
        b.inheritanceScore - a.inheritanceScore
        || b.combinedSChance - a.combinedSChance
        || b.minSAptitudeChance - a.minSAptitudeChance
        || b.relevantStars - a.relevantStars
        || b.affinity - a.affinity,
    );

    return {
        results,
        evaluatedCount,
        matchedCount: results.length,
    };
};
