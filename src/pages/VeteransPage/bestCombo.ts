import {
    aggregateFactors,
    calculateAffinity,
    calculateGrandparentAffinity,
    calculatePairAffinity,
    calculateSparkChance,
    FactorItem,
} from "../../data/VeteransHelper";
import UMDatabaseWrapper from "../../data/UMDatabaseWrapper";
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

export const getAptitudeOption = (key: number): AptitudeOption | undefined => APTITUDE_BY_KEY.get(key);

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
};

export const DEFAULT_BEST_COMBO_SCORE_WEIGHTS: BestComboScoreWeights = {
    sTarget: 4,
    spark: 10,
    stat: 1,
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

export type BestComboConditionMetric = "stars" | "sparks";

export type BestComboCondition = {
    id: string;
    aptitudeKey: number;
    metric: BestComboConditionMetric;
    min: number;
};

export type BestComboResult = {
    parent1: Veteran;
    parent2: Veteran;
    totals: Map<number, AptitudeTotals>;
    sChances: Map<number, number>;
    combinedSChance: number;
    minSAptitudeChance: number;
    relevantStars: number;
    affinity: number;
    conditionValues: number[];
    inheritanceScore: number;
    scoreBreakdown: BestComboScoreBreakdown;
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

const getAptitudeSChance = (
    aptitudeKey: number,
    first: VeteranAptitudeData,
    second: VeteranAptitudeData,
    firstTree: Record<AptitudeSourceSlot, number>,
    secondTree: Record<AptitudeSourceSlot, number>,
): number => {
    let nonePerInheritance = 1;

    const applyEntries = (
        entries: AptitudeSparkEntry[] | undefined,
        tree: Record<AptitudeSourceSlot, number>,
    ) => {
        for (const entry of entries ?? []) {
            const chance = calculateSparkChance(2, entry.factorId, entry.level, tree[entry.sourceSlot]);
            if (chance === null) continue;
            nonePerInheritance *= Math.max(0, 1 - chance / 100);
        }
    };

    applyEntries(first.entriesByAptitude.get(aptitudeKey), firstTree);
    applyEntries(second.entriesByAptitude.get(aptitudeKey), secondTree);

    // Two mid-run inheritance events, each rolling the same lineages.
    return (1 - nonePerInheritance * nonePerInheritance) * 100;
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
    const rawStats = STAT_KEYS.reduce((total, stat) => total + statGains[stat], 0);
    const stats = rawStats * weights.stat;

    return {
        sTargets,
        sparks,
        stats,
        total: sTargets + sparks + stats,
        statGains,
        statSources,
    };
};

export const evaluateBestCombos = (
    veterans: Veteran[],
    targetCharaId: number,
    sAptitudeKeys: number[],
    conditions: BestComboCondition[],
    scoringConfig?: CustomScoringConfig,
    dataByVeteran?: Map<Veteran, VeteranAptitudeData>,
    requiredParent1CharaId?: number | null,
    requiredParent2CharaId?: number | null,
    scoreWeights: BestComboScoreWeights = DEFAULT_BEST_COMBO_SCORE_WEIGHTS,
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
    const requiredParent1 = requiredParent1CharaId ?? null;
    const requiredParent2 = requiredParent2CharaId ?? null;

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

            if (requiredParent1 !== null && requiredParent2 !== null) {
                const forwardMatch = parent1CharaId === requiredParent1 && parent2CharaId === requiredParent2;
                const reverseMatch = parent1CharaId === requiredParent2 && parent2CharaId === requiredParent1;
                if (!forwardMatch && !reverseMatch) continue;
            } else if (requiredParent1 !== null) {
                if (parent1CharaId !== requiredParent1 && parent2CharaId !== requiredParent1) continue;
            } else if (requiredParent2 !== null) {
                if (parent1CharaId !== requiredParent2 && parent2CharaId !== requiredParent2) continue;
            }

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
            let combinedSChance = 1;
            let minSAptitudeChance = 100;
            let relevantStars = 0;

            for (const aptitudeKey of sAptitudeKeys) {
                const chance = getAptitudeSChance(aptitudeKey, first, second, firstTree, secondTree);
                sChances.set(aptitudeKey, chance);
                combinedSChance *= chance / 100;
                minSAptitudeChance = Math.min(minSAptitudeChance, chance);
                relevantStars += totals.get(aptitudeKey)?.stars ?? 0;
            }

            const scoreBreakdown = scoringConfig
                ? getComboScore(
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
                combinedSChance: sAptitudeKeys.length > 0 ? combinedSChance * 100 : 0,
                minSAptitudeChance: sAptitudeKeys.length > 0 ? minSAptitudeChance : 0,
                relevantStars,
                affinity,
                conditionValues,
                inheritanceScore: scoreBreakdown.total,
                scoreBreakdown,
                firstTree,
                secondTree,
            });
        }
    }

    results.sort((a, b) =>
        b.combinedSChance - a.combinedSChance
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
