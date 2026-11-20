import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Alert, Button, ButtonGroup, Form } from "react-bootstrap";
import { CustomScoringConfig, BaseFilter, Veteran } from "./types";
import { formatCardName, getCardName, getCharaImageUrl, getFactorColor, getRankGradeLabel } from "./VeteransUIHelper";
import CustomScoringPanel from "./CustomScoringPanel";
import FilterToolbar from "./FilterToolbar";
import ActiveFiltersList from "./ActiveFiltersList";
import ParentCharacterFilter from "./ParentCharacterFilter";
import { LAST_TARGET_UMA_KEY, loadLastTargetUma } from "./targetOptions";
import TargetUmaPicker from "./TargetUmaPicker";
import type { QuickStartPreset } from "./quickStart";
import {
    APTITUDE_GROUP_LABELS,
    APTITUDE_OPTIONS,
    AptitudeGroup,
    BestComboCondition,
    BestComboConditionMetric,
    buildVeteranAptitudeData,
    combineSparkBreakdowns,
    BestComboScoreWeights,
    BestComboMode,
    DEFAULT_BEST_COMBO_SCORE_WEIGHTS,
    evaluateBestCombos,
    ExpectedSpark,
    GpSkillChance,
    getAptitudeOption,
    getSparkInheritanceBreakdown,
    getStartingAptitudeGrade,
    getTargetBaseAptitudeGrade,
    STAT_KEYS,
    STAT_LABELS,
    StatSourceBreakdown,
} from "./bestCombo";

type Props = {
    veterans: Veteran[];
    config: any;
    scoringConfig: CustomScoringConfig;
    onScoringChange: (config: CustomScoringConfig) => void;
    maxGpAffinity: number;
    maxRaceWins: number;
    moeVeterans: Veteran[];
    moeSearching: boolean;
    moeError: string;
    moeSearchIsCurrent: boolean;
    moeCanLoadMore: boolean;
    onSearchMoe: () => void;
    moeFilters: {
        blues: BaseFilter[];
        aptitude: BaseFilter[];
        uniques: BaseFilter[];
        races: BaseFilter[];
        skills: BaseFilter[];
    };
    parentCharaIds: number[];
    onParentCharaIdsChange: (characterIds: number[]) => void;
    onAddFilter: (stateKey: string, filter: BaseFilter) => void;
    onRemoveFilter: (stateKey: string, filterId: string) => void;
    onClearFilters: () => void;
    getAvailableFilterStats: (categoryId: number) => string[];
    mode?: BestComboMode;
    initialPreset?: QuickStartPreset | null;
    onInitialPresetApplied?: () => void;
};

type RankMode = "score" | "sChance";

const APTITUDE_GROUPS: AptitudeGroup[] = ["Ground", "Distance", "Strategy"];
const RESULT_PAGE_SIZE = 25;
const BEST_COMBO_SCORE_WEIGHTS_KEY = "hakuraku.veterans.bestComboScoreWeights.v2";

const normalizeScoreWeight = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;

const loadScoreWeights = (): BestComboScoreWeights => {
    if (typeof localStorage === "undefined") return { ...DEFAULT_BEST_COMBO_SCORE_WEIGHTS };

    try {
        const raw = localStorage.getItem(BEST_COMBO_SCORE_WEIGHTS_KEY);
        if (!raw) return { ...DEFAULT_BEST_COMBO_SCORE_WEIGHTS };
        const parsed = JSON.parse(raw) as Partial<BestComboScoreWeights>;
        return {
            sTarget: normalizeScoreWeight(parsed.sTarget, DEFAULT_BEST_COMBO_SCORE_WEIGHTS.sTarget),
            spark: normalizeScoreWeight(parsed.spark, DEFAULT_BEST_COMBO_SCORE_WEIGHTS.spark),
            stat: normalizeScoreWeight(parsed.stat, DEFAULT_BEST_COMBO_SCORE_WEIGHTS.stat),
            parentSkill: normalizeScoreWeight(parsed.parentSkill, DEFAULT_BEST_COMBO_SCORE_WEIGHTS.parentSkill),
            parentPink: normalizeScoreWeight(parsed.parentPink, DEFAULT_BEST_COMBO_SCORE_WEIGHTS.parentPink),
        };
    } catch {
        return { ...DEFAULT_BEST_COMBO_SCORE_WEIGHTS };
    }
};
const SPARK_CATEGORY_ORDER = [1, 2, 3, 4, 5];
const SPARK_CATEGORY_LABELS: Record<number, string> = {
    1: "Stats",
    2: "Aptitude",
    3: "Unique",
    4: "Race / Scenario",
    5: "Skills",
};

const getParentLabel = (veteran: Veteran): string =>
    formatCardName(getCardName(veteran.card_id));

const formatPercent = (value: number | null): string =>
    value === null ? "—" : `${value.toFixed(1)}%`;

const formatStatBreakdown = (sources: StatSourceBreakdown): string => [
    `Blue initial: +${sources.blueInitial.toFixed(1)}`,
    `Blue mid-run: +${sources.blueMid.toFixed(1)}`,
    `Race: +${sources.race.toFixed(1)}`,
    `Scenario: +${sources.scenario.toFixed(1)}`,
].join("\n");

const SparkBreakdownDetails = ({
    breakdown,
    config,
}: {
    breakdown: ExpectedSpark[];
    config: any;
}) => {
    const [open, setOpen] = useState(false);

    return (
        <details
            className="best-combo-details"
            onToggle={event => setOpen(event.currentTarget.open)}
        >
            <summary>Per-spark inherit % (full run)</summary>
            {open && (
                <div className="best-combo-spark-groups">
                    {SPARK_CATEGORY_ORDER.map(category => {
                        const entries = breakdown.filter(entry => entry.category === category);
                        if (entries.length === 0) return null;

                        return (
                            <div className="best-combo-spark-group" key={category}>
                                <span className="best-combo-spark-group-label">
                                    {SPARK_CATEGORY_LABELS[category]}
                                </span>
                                <div className="best-combo-spark-row">
                                    {entries.map((entry, index) => (
                                        <span
                                            className={`best-combo-spark${entry.isGold ? " gold" : ""}`}
                                            key={`${entry.factorId}-${entry.sourceSlot}-${index}`}
                                            title={`${entry.level}★ from ${entry.sourceSlot === "self" ? "parent" : entry.sourceSlot.toUpperCase()}, ${formatPercent(entry.chance)} over the full run`}
                                        >
                                            <span className="best-combo-spark-source">
                                                {entry.sourceSlot === "self" ? "P" : entry.sourceSlot.toUpperCase()}
                                            </span>
                                            <span style={{ color: getFactorColor(entry.factorId, config) }}>
                                                {entry.name}
                                            </span>
                                            <span className="best-combo-spark-stars">{entry.level}★</span>
                                            <span className="best-combo-spark-chance">
                                                {formatPercent(entry.chance)}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </details>
    );
};

const CombinedSparkDetails = ({
    breakdowns,
    config,
}: {
    breakdowns: ExpectedSpark[][];
    config: any;
}) => {
    const [open, setOpen] = useState(false);
    const combined = combineSparkBreakdowns(breakdowns);

    return (
        <details
            className="best-combo-details best-combo-combined-details"
            onToggle={event => setOpen(event.currentTarget.open)}
        >
            <summary>
                Combined spark inherit % (all copies, {combined.length} unique)
            </summary>
            {open && (
                <div className="best-combo-spark-groups">
                    {SPARK_CATEGORY_ORDER.map(category => {
                        const entries = combined.filter(entry => entry.category === category);
                        if (entries.length === 0) return null;

                        return (
                            <div className="best-combo-spark-group" key={category}>
                                <span className="best-combo-spark-group-label">
                                    {SPARK_CATEGORY_LABELS[category]}
                                </span>
                                <div className="best-combo-spark-row">
                                    {entries.map(entry => (
                                        <span
                                            className={`best-combo-spark${entry.isGold ? " gold" : ""}`}
                                            key={`${entry.category}-${entry.name}`}
                                            title={`${entry.stars}★ across ${entry.copies} spark${entry.copies === 1 ? "" : "s"}, ${formatPercent(entry.chance)} total chance over the full run`}
                                        >
                                            <span style={{ color: getFactorColor(entry.factorId, config) }}>
                                                {entry.name}
                                            </span>
                                            <span className="best-combo-spark-stars">{entry.stars}★</span>
                                            {entry.copies > 1 && (
                                                <span className="best-combo-spark-copies">×{entry.copies}</span>
                                            )}
                                            <span className="best-combo-spark-chance">
                                                {formatPercent(entry.chance)}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </details>
    );
};

const GP_PARENT_SPARK_CATEGORIES = [
    { category: 1, label: "Blue" },
    { category: 2, label: "Pink" },
    { category: 3, label: "Unique" },
];

const ParentOwnedSparkSummary = ({
    breakdown,
    config,
}: {
    breakdown: ExpectedSpark[];
    config: any;
}) => {
    const owned = breakdown.filter(entry =>
        entry.sourceSlot === "self" && entry.category >= 1 && entry.category <= 3,
    );

    return (
        <div className="best-combo-parent-owned-sparks">
            {GP_PARENT_SPARK_CATEGORIES.map(category => {
                const entries = owned.filter(entry => entry.category === category.category);

                return (
                    <div className="best-combo-parent-owned-spark-group" key={category.category}>
                        <span className="best-combo-parent-owned-spark-label">
                            {category.label}
                        </span>
                        <div className="best-combo-parent-owned-spark-chips">
                            {entries.length === 0 ? (
                                <span className="best-combo-parent-owned-spark-empty">None</span>
                            ) : entries.map((entry, index) => (
                                <span
                                    className="best-combo-parent-owned-spark"
                                    key={`${entry.factorId}-${index}`}
                                    title={`${category.label} spark, ${entry.level}★`}
                                >
                                    <span style={{ color: getFactorColor(entry.factorId, config) }}>
                                        {entry.name}
                                    </span>
                                    <span className="best-combo-parent-owned-spark-stars">
                                        {entry.level}★
                                    </span>
                                </span>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const GpSkillDetails = ({
    skills,
    config,
}: {
    skills: GpSkillChance[];
    config: any;
}) => {
    const [open, setOpen] = useState(false);

    if (skills.length === 0) {
        return (
            <div className="best-combo-gp-skills">
                <span className="best-combo-no-factors">No desired skill sparks in this lineage.</span>
            </div>
        );
    }

    return (
        <div className="best-combo-gp-skills">
            <div className="best-combo-gp-summary">
                <span className="best-combo-stat-gains-title">Skill sparks</span>
                {skills.slice(0, 3).map(skill => (
                    <span className="best-combo-gp-skill" key={skill.name}>
                        <span style={{ color: getFactorColor(skill.factorId, config) }}>{skill.name}</span>
                        <span>{skill.parentOwners}/2 parents</span>
                        <span>{skill.lineageMembers}/6 lineage</span>
                        <span>{skill.inheritChance.toFixed(1)}% inherit</span>
                        <span>{skill.spawnChance.toFixed(1)}% spawn</span>
                        <span>{skill.combinedChance.toFixed(1)}% both</span>
                    </span>
                ))}
                {skills.length > 3 && (
                    <span className="best-combo-hint">+{skills.length - 3} more</span>
                )}
            </div>
            <details
                className="best-combo-details"
                onToggle={event => setOpen(event.currentTarget.open)}
            >
                <summary>All skill spark odds ({skills.length})</summary>
                {open && (
                    <div className="best-combo-gp-skill-list">
                        {skills.map(skill => (
                            <div className="best-combo-gp-skill-row" key={skill.name}>
                                <span style={{ color: getFactorColor(skill.factorId, config) }}>
                                    {skill.name}
                                </span>
                                <span>{skill.parentOwners}/2 parents</span>
                                <span>{skill.lineageMembers}/6 lineage</span>
                                <span>{skill.inheritChance.toFixed(1)}% inherit</span>
                                <span>{skill.spawnChance.toFixed(1)}% spawn</span>
                                <span>{skill.combinedChance.toFixed(1)}% both</span>
                                <span>{skill.contribution.toFixed(1)} pts</span>
                            </div>
                        ))}
                    </div>
                )}
            </details>
        </div>
    );
};

const MoeFriendCodeButton = ({ veteran }: { veteran: Veteran }) => {
    const [copied, setCopied] = useState(false);
    const friendCode = veteran.uma_moe_account_id;

    if (!friendCode) return null;

    const copyFriendCode = async (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();

        try {
            await navigator.clipboard.writeText(friendCode);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard access can be unavailable; leave the label unchanged.
        }
    };

    return (
        <button
            type="button"
            className="vet-badge friend-code vet-friend-code-button best-combo-friend-code"
            title="Copy friend code"
            onClick={copyFriendCode}
        >
            {copied
                ? "Copied!"
                : `${veteran.uma_moe_trainer_name?.trim() || "Trainer"} - ${friendCode}`}
        </button>
    );
};

const BestComboPanel = ({
    veterans,
    config,
    scoringConfig,
    onScoringChange,
    maxGpAffinity,
    maxRaceWins,
    moeVeterans,
    moeSearching,
    moeError,
    moeSearchIsCurrent,
    moeCanLoadMore,
    onSearchMoe,
    moeFilters,
    parentCharaIds,
    onParentCharaIdsChange,
    onAddFilter,
    onRemoveFilter,
    onClearFilters,
    getAvailableFilterStats,
    mode = "target",
    initialPreset = null,
    onInitialPresetApplied,
}: Props) => {
    const isGpMode = mode === "gp";
    const [targetCardId, setTargetCardId] = useState<number | null>(loadLastTargetUma);
    const targetCharaId = targetCardId === null ? null : Math.floor(targetCardId / 100);
    const [sAptitudeKeys, setSAptitudeKeys] = useState<number[]>([]);
    const [conditions, setConditions] = useState<BestComboCondition[]>([]);
    const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);
    const [rankMode, setRankMode] = useState<RankMode>("score");
    const [requiredParent1CardIds, setRequiredParent1CardIds] = useState<number[]>([]);
    const [requiredParent2CardIds, setRequiredParent2CardIds] = useState<number[]>([]);
    const [includeMoeParents, setIncludeMoeParents] = useState(false);
    const [openMoeFilter, setOpenMoeFilter] = useState<string | null>(null);
    const [scoreWeights, setScoreWeights] = useState<BestComboScoreWeights>(loadScoreWeights);
    const nextConditionId = useRef(1);
    const appliedPresetId = useRef<number | null>(null);

    useEffect(() => {
        if (!initialPreset || appliedPresetId.current === initialPreset.id) return;

        appliedPresetId.current = initialPreset.id;
        setTargetCardId(initialPreset.targetCardId);
        setRequiredParent1CardIds(initialPreset.forcedParent1);
        setRequiredParent2CardIds(initialPreset.forcedParent2);
        setIncludeMoeParents(initialPreset.useUmaMoe);
        setSAptitudeKeys(initialPreset.sAptitudeKeys);
        setConditions(initialPreset.conditions);
        setRankMode("score");
        setVisibleCount(RESULT_PAGE_SIZE);
        onInitialPresetApplied?.();
    }, [initialPreset, onInitialPresetApplied]);

    useEffect(() => {
        try {
            localStorage.setItem(BEST_COMBO_SCORE_WEIGHTS_KEY, JSON.stringify(scoreWeights));
        } catch {
            // Storage may be unavailable; keep the in-memory weights.
        }
    }, [scoreWeights]);

    useEffect(() => {
        try {
            if (targetCardId === null) {
                localStorage.removeItem(LAST_TARGET_UMA_KEY);
            } else {
                localStorage.setItem(LAST_TARGET_UMA_KEY, String(targetCardId));
            }
        } catch {
            // Storage may be unavailable; keep the in-memory selection.
        }
    }, [targetCardId]);

    const evaluationVeterans = useMemo(
        () => includeMoeParents && moeVeterans.length > 0
            ? [...veterans, ...moeVeterans]
            : veterans,
        [includeMoeParents, veterans, moeVeterans],
    );

    const moeVeteranSet = useMemo(() => new Set(moeVeterans), [moeVeterans]);

    const aptitudeData = useMemo(() => {
        const data = new Map<Veteran, ReturnType<typeof buildVeteranAptitudeData>>();
        for (const veteran of evaluationVeterans) {
            data.set(veteran, buildVeteranAptitudeData(veteran));
        }
        return data;
    }, [evaluationVeterans]);

    const orderedSAptitudes = useMemo(
        () => APTITUDE_OPTIONS.filter(option => sAptitudeKeys.includes(option.key)),
        [sAptitudeKeys],
    );

    const conditionMinimums = useMemo(() => {
        const minimums = new Map<number, { stars?: number; sparks?: number }>();

        for (const condition of conditions) {
            const current = minimums.get(condition.aptitudeKey) ?? {};
            if (condition.metric === "stars") {
                current.stars = Math.max(current.stars ?? 0, condition.min);
            } else {
                current.sparks = Math.max(current.sparks ?? 0, condition.min);
            }
            minimums.set(condition.aptitudeKey, current);
        }

        return minimums;
    }, [conditions]);

    const starConditionSummaries = useMemo(() => {
        if (targetCardId === null) return [];

        const summaries: Array<{
            aptitudeKey: number;
            option: NonNullable<ReturnType<typeof getAptitudeOption>>;
            baseGrade: ReturnType<typeof getTargetBaseAptitudeGrade>;
            startingGrade: NonNullable<ReturnType<typeof getStartingAptitudeGrade>>;
            stars: number;
        }> = [];

        for (const [aptitudeKey, minimums] of conditionMinimums) {
            const stars = minimums.stars ?? 0;
            if (stars <= 0) continue;

            const option = getAptitudeOption(aptitudeKey);
            const baseGrade = getTargetBaseAptitudeGrade(targetCardId, aptitudeKey);
            const startingGrade = getStartingAptitudeGrade(baseGrade, stars);
            if (!option || !startingGrade) continue;

            summaries.push({ aptitudeKey, option, baseGrade, startingGrade, stars });
        }

        return summaries.sort((a, b) => a.option.label.localeCompare(b.option.label));
    }, [conditionMinimums, targetCardId]);

    const evaluation = useMemo(() => {
        if (
            targetCharaId === null
            || evaluationVeterans.length < 2
            || (!isGpMode && orderedSAptitudes.length === 0)
        ) {
            return null;
        }

        return evaluateBestCombos(
            evaluationVeterans,
            targetCharaId,
            targetCardId,
            isGpMode ? [] : orderedSAptitudes.map(option => option.key),
            isGpMode ? [] : conditions,
            scoringConfig,
            aptitudeData,
            requiredParent1CardIds,
            requiredParent2CardIds,
            scoreWeights,
            includeMoeParents
                ? (first, second) => !(moeVeteranSet.has(first) && moeVeteranSet.has(second))
                : undefined,
            mode,
        );
    }, [
        evaluationVeterans,
        targetCharaId,
        targetCardId,
        orderedSAptitudes,
        conditions,
        scoringConfig,
        aptitudeData,
        requiredParent1CardIds,
        requiredParent2CardIds,
        scoreWeights,
        includeMoeParents,
        moeVeteranSet,
        isGpMode,
        mode,
    ]);

    const rankedResults = useMemo(() => {
        if (!evaluation) return [];
        const results = [...evaluation.results];

        if (isGpMode) {
            results.sort((a, b) =>
                b.inheritanceScore - a.inheritanceScore
                || b.affinity - a.affinity,
            );
            return results;
        }

        results.sort((a, b) => {
            if (rankMode === "score" && b.inheritanceScore !== a.inheritanceScore) {
                return b.inheritanceScore - a.inheritanceScore;
            }
            if (b.combinedSChance !== a.combinedSChance) {
                return b.combinedSChance - a.combinedSChance;
            }
            if (b.inheritanceScore !== a.inheritanceScore) {
                return b.inheritanceScore - a.inheritanceScore;
            }
            if (b.relevantStars !== a.relevantStars) {
                return b.relevantStars - a.relevantStars;
            }
            return b.affinity - a.affinity;
        });

        return results;
    }, [evaluation, rankMode, isGpMode]);

    const orientedResults = useMemo(() => {
        const required1 = new Set(requiredParent1CardIds);
        const required2 = new Set(requiredParent2CardIds);
        if (required1.size === 0 && required2.size === 0) return rankedResults;

        return rankedResults.map(result => {
            const forward = (required1.size === 0 || required1.has(result.parent1.card_id))
                && (required2.size === 0 || required2.has(result.parent2.card_id));
            const reverse = (required1.size === 0 || required1.has(result.parent2.card_id))
                && (required2.size === 0 || required2.has(result.parent1.card_id));

            if (forward || !reverse) return result;

            return {
                ...result,
                parent1: result.parent2,
                parent2: result.parent1,
                firstTree: result.secondTree,
                secondTree: result.firstTree,
            };
        });
    }, [rankedResults, requiredParent1CardIds, requiredParent2CardIds]);

    useEffect(() => {
        setVisibleCount(RESULT_PAGE_SIZE);
    }, [targetCardId, sAptitudeKeys, conditions, rankMode, requiredParent1CardIds, requiredParent2CardIds, includeMoeParents, moeVeterans, mode]);

    const toggleSAptitude = (aptitudeKey: number) => {
        setSAptitudeKeys(previous =>
            previous.includes(aptitudeKey)
                ? previous.filter(key => key !== aptitudeKey)
                : [...previous, aptitudeKey],
        );
    };

    const addCondition = () => {
        const aptitudeKey = sAptitudeKeys.length > 0 ? sAptitudeKeys[0] : 12;
        const condition: BestComboCondition = {
            id: `condition-${nextConditionId.current++}`,
            aptitudeKey,
            metric: "stars",
            min: 1,
        };

        setConditions(previous => [...previous, condition]);
        setSAptitudeKeys(previous =>
            previous.includes(aptitudeKey) ? previous : [...previous, aptitudeKey],
        );
    };

    const updateCondition = (
        id: string,
        patch: Partial<Pick<BestComboCondition, "aptitudeKey" | "metric" | "min">>,
    ) => {
        setConditions(previous => previous.map(condition =>
            condition.id === id ? { ...condition, ...patch } : condition,
        ));

        if (patch.aptitudeKey !== undefined) {
            const aptitudeKey = patch.aptitudeKey;
            setSAptitudeKeys(previous =>
                previous.includes(aptitudeKey) ? previous : [...previous, aptitudeKey],
            );
        }
    };

    const removeCondition = (id: string) => {
        setConditions(previous => previous.filter(condition => condition.id !== id));
    };

    const updateScoreWeight = (key: keyof BestComboScoreWeights, rawValue: string) => {
        const value = Number(rawValue);
        setScoreWeights(previous => ({
            ...previous,
            [key]: Number.isFinite(value) ? Math.max(0, value) : 0,
        }));
    };

    const renderParent = (veteran: Veteran, slot: "p1" | "p2", breakdown: ExpectedSpark[]) => (
        <div className="best-combo-parent" key={`${slot}-${veteran.trained_chara_id}`}>
            <img
                className="best-combo-parent-img"
                src={getCharaImageUrl(veteran.card_id)}
                alt={getParentLabel(veteran)}
                onError={event => { (event.target as HTMLImageElement).style.opacity = "0"; }}
            />
            <div className="best-combo-parent-copy">
                <span className="best-combo-parent-name">{getParentLabel(veteran)}</span>
                <span className="best-combo-parent-meta">
                    Rank {getRankGradeLabel(veteran.rank)}, {veteran.rank_score.toLocaleString()} pts
                </span>
                <ParentOwnedSparkSummary breakdown={breakdown} config={config} />
                <SparkBreakdownDetails breakdown={breakdown} config={config} />
                {moeVeteranSet.has(veteran) && (
                    <div className="best-combo-parent-moe-row">
                        <span className="best-combo-moe-badge">uma.moe</span>
                        <MoeFriendCodeButton veteran={veteran} />
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <section className="vet-panel-card vet-best-combo-panel">
            <div className="vet-panel-header">
                <div>
                    <h2 className="vet-panel-title">
                        {isGpMode ? "Best GP combo" : "Best parent combo"}
                    </h2>
                    {isGpMode && (
                        <p className="vet-best-combo-description">
                            Find the pair with the best chance to inherit and spawn desired skill sparks on the
                            resulting GP. Spawn chance uses base rate × 1.1^N, where N is the number of lineage
                            members with that skill spark.
                        </p>
                    )}
                </div>
            </div>

            {veterans.length === 0 ? (
                <Alert variant="info" className="mb-0">
                    Load at least one owned veteran in the <strong>My veterans</strong> tab to build combos.
                </Alert>
            ) : (
                <>
                    <div className="best-combo-controls">
                        <div className="best-combo-field">
                            <label className="best-combo-label" htmlFor="best-combo-target">
                                {isGpMode ? "Target GP Uma" : "Target Uma"}
                            </label>
                            <TargetUmaPicker
                                id="best-combo-target"
                                selected={targetCardId}
                                onChange={setTargetCardId}
                                placeholder={`Select target ${isGpMode ? "GP " : ""}Uma...`}
                                title={`Select target ${isGpMode ? "GP " : ""}Uma`}
                            />
                        </div>

                        {!isGpMode && (
                            <div className="best-combo-field">
                                <span className="best-combo-label">Aptitudes to aim for S</span>
                                <div className="best-combo-chip-groups">
                                    {APTITUDE_GROUPS.map(group => (
                                        <div className="best-combo-chip-group" key={group}>
                                            <span className="best-combo-chip-group-label">
                                                {APTITUDE_GROUP_LABELS[group]}
                                            </span>
                                            <div className="best-combo-chip-row">
                                                {APTITUDE_OPTIONS.filter(option => option.group === group).map(option => (
                                                    <button
                                                        key={option.key}
                                                        type="button"
                                                        className={`best-combo-chip${sAptitudeKeys.includes(option.key) ? " active" : ""}`}
                                                        title={`${option.label} aptitude`}
                                                        onClick={() => toggleSAptitude(option.key)}
                                                    >
                                                        {option.shortLabel}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="best-combo-parent-requirements">
                        <div className="best-combo-parent-requirements-header">
                            <div>
                                <span className="best-combo-label">Parent requirements</span>
                            </div>
                            <Button
                                size="sm"
                                variant="outline-secondary"
                                disabled={requiredParent1CardIds.length === 0 && requiredParent2CardIds.length === 0}
                                onClick={() => {
                                    setRequiredParent1CardIds([]);
                                    setRequiredParent2CardIds([]);
                                }}
                            >
                                Clear
                            </Button>
                        </div>
                        <div className="best-combo-parent-selects">
                            <div className="best-combo-parent-select">
                                <span className="best-combo-parent-select-label">Parent 1 must be one of</span>
                                <ParentCharacterFilter
                                    veterans={evaluationVeterans}
                                    selected={requiredParent1CardIds}
                                    onChange={setRequiredParent1CardIds}
                                    includeAllCharacters
                                    selectionMode="card"
                                    label="Parent 1"
                                    title="Select Parent 1 costume"
                                    excludedIds={requiredParent2CardIds}
                                />
                            </div>
                            <div className="best-combo-parent-select">
                                <span className="best-combo-parent-select-label">Parent 2 must be one of</span>
                                <ParentCharacterFilter
                                    veterans={evaluationVeterans}
                                    selected={requiredParent2CardIds}
                                    onChange={setRequiredParent2CardIds}
                                    includeAllCharacters
                                    selectionMode="card"
                                    label="Parent 2"
                                    title="Select Parent 2 costume"
                                    excludedIds={requiredParent1CardIds}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="best-combo-moe-section">
                        <div className="best-combo-moe-header">
                            <Form.Check
                                type="switch"
                                id="best-combo-include-moe"
                                label="Include uma.moe parents"
                                checked={includeMoeParents}
                                onChange={event => setIncludeMoeParents(event.target.checked)}
                            />
                            <p className="best-combo-hint">
                                When enabled, one side of each combo can come from uma.moe. Search uses your current custom scoring and the filters
                                set in the uma.moe search tab.
                            </p>
                        </div>
                        {includeMoeParents && (
                            <div className="best-combo-moe-actions">
                                <Button
                                    size="sm"
                                    variant="outline-info"
                                    onClick={onSearchMoe}
                                    disabled={moeSearching || (moeSearchIsCurrent && !moeCanLoadMore)}
                                >
                                    {moeSearching
                                        ? (moeSearchIsCurrent ? "Loading..." : "Searching uma.moe...")
                                        : moeSearchIsCurrent
                                            ? (moeCanLoadMore ? "Load 100 more" : "All results loaded")
                                            : "Search uma.moe (100)"}
                                </Button>
                                <span className="best-combo-hint">
                                    {moeVeterans.length > 0
                                        ? `${moeVeterans.length} uma.moe candidates loaded.`
                                        : "No uma.moe candidates loaded yet."}
                                </span>
                                {moeVeterans.length > 0 && !moeSearchIsCurrent && (
                                    <span className="best-combo-moe-stale">
                                        Search settings changed — run a new search to apply them.
                                    </span>
                                )}
                            </div>
                        )}
                        {includeMoeParents && moeError && (
                            <Alert variant="danger" className="best-combo-moe-error">
                                {moeError}
                            </Alert>
                        )}
                        {includeMoeParents && (
                            <div className="best-combo-moe-settings">
                                <div className="best-combo-moe-settings-block">
                                    <span className="best-combo-label">Parent characters</span>
                                    <ParentCharacterFilter
                                        veterans={veterans}
                                        selected={parentCharaIds}
                                        onChange={onParentCharaIdsChange}
                                        includeAllCharacters
                                    />
                                </div>
                                <div className="best-combo-moe-settings-block">
                                    <span className="best-combo-label">Spark filters</span>
                                    <p className="best-combo-hint">
                                        These are the same filters used by the uma.moe search tab.
                                    </p>
                                    <div className="vet-filter-buttons">
                                        <FilterToolbar
                                            config={config}
                                            visibilityState={{
                                                blues: openMoeFilter === "blues",
                                                aptitude: openMoeFilter === "aptitude",
                                                uniques: openMoeFilter === "uniques",
                                                races: openMoeFilter === "races",
                                                skills: openMoeFilter === "skills",
                                            }}
                                            onToggle={key => setOpenMoeFilter(key)}
                                            onAddFilter={onAddFilter}
                                            getAvailableStats={getAvailableFilterStats}
                                        />
                                    </div>
                                    <ActiveFiltersList
                                        filters={{
                                            bluesFilters: moeFilters.blues,
                                            aptitudeFilters: moeFilters.aptitude,
                                            uniquesFilters: moeFilters.uniques,
                                            racesFilters: moeFilters.races,
                                            skillsFilters: moeFilters.skills,
                                        }}
                                        config={config}
                                        onRemove={onRemoveFilter}
                                        onClearAll={onClearFilters}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="best-combo-scoring-row">
                        <div>
                            <span className="best-combo-label">
                                {isGpMode ? "GP skill score" : "Inheritance score"}
                            </span>
                            <p className="best-combo-hint">
                                {isGpMode
                                    ? "Weights each desired skill spark by custom value, inherit chance, and spawn chance, with a bonus when the selected parents themselves own it. Parent-owned pink sparks also add their custom pink score."
                                    : "Blends aptitude S chance, named-spark chance, and expected stat gain. Custom blue stat multipliers are applied per stat."}
                            </p>
                        </div>
                        <CustomScoringPanel
                            config={scoringConfig}
                            onChange={onScoringChange}
                            maxGpAffinity={maxGpAffinity}
                            maxRaceWins={maxRaceWins}
                        />
                    </div>

                    <div className="best-combo-score-weights">
                        {!isGpMode && (
                            <label className="best-combo-weight">
                                <span>Aptitude S chance ×</span>
                                <Form.Control
                                    size="sm"
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    value={scoreWeights.sTarget}
                                    title="Points per 1% chance for each selected aptitude S target."
                                    onChange={event => updateScoreWeight("sTarget", event.target.value)}
                                />
                            </label>
                        )}
                        <label className="best-combo-weight">
                            <span>{isGpMode ? "Skill spark value ×" : "Spark value ×"}</span>
                            <Form.Control
                                size="sm"
                                type="number"
                                min={0}
                                step="0.1"
                                value={scoreWeights.spark}
                                title={isGpMode
                                    ? "Multiplier on custom skill value × inherit chance × spawn chance."
                                    : "Multiplier on named-spark custom values × chance to inherit."}
                                onChange={event => updateScoreWeight("spark", event.target.value)}
                            />
                        </label>
                        {isGpMode && (
                            <>
                                <label className="best-combo-weight">
                                    <span>Parent skill ×</span>
                                    <Form.Control
                                        size="sm"
                                        type="number"
                                        min={0}
                                        step="0.1"
                                        value={scoreWeights.parentSkill}
                                        title="Skill contribution multiplier becomes 1 + this × number of selected parents owning the skill."
                                        onChange={event => updateScoreWeight("parentSkill", event.target.value)}
                                    />
                                </label>
                                <label className="best-combo-weight">
                                    <span>Parent pink ×</span>
                                    <Form.Control
                                        size="sm"
                                        type="number"
                                        min={0}
                                        step="0.1"
                                        value={scoreWeights.parentPink}
                                        title="Multiplier on the custom score of pink sparks owned by the selected parents themselves."
                                        onChange={event => updateScoreWeight("parentPink", event.target.value)}
                                    />
                                </label>
                            </>
                        )}
                        {!isGpMode && (
                            <label className="best-combo-weight">
                                <span>Stat value ×</span>
                                <Form.Control
                                    size="sm"
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    value={scoreWeights.stat}
                                    title="Multiplier on expected stat gain after custom blue stat multipliers."
                                    onChange={event => updateScoreWeight("stat", event.target.value)}
                                />
                            </label>
                        )}
                        <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => setScoreWeights({ ...DEFAULT_BEST_COMBO_SCORE_WEIGHTS })}
                        >
                            Reset
                        </Button>
                    </div>

                    {!isGpMode && (
                    <div className="best-combo-conditions">
                        <div className="best-combo-conditions-header">
                            <div>
                                <span className="best-combo-label">Conditions</span>
                                {starConditionSummaries.length > 0 && (
                                    <div className="best-combo-condition-grades">
                                        {starConditionSummaries.map(summary => (
                                            <span className="best-combo-condition-grade" key={summary.aptitudeKey}>
                                                <span style={{ color: summary.option.color }}>
                                                    {summary.option.shortLabel}
                                                </span>
                                                {` ${summary.baseGrade ?? "?"} → ${summary.startingGrade}`}
                                                <span className="best-combo-condition-grade-min">
                                                    {summary.stars}★ min
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Button size="sm" variant="outline-secondary" onClick={addCondition}>
                                Add condition
                            </Button>
                        </div>

                        {conditions.length === 0 ? (
                            <p className="best-combo-empty">No conditions.</p>
                        ) : (
                            <div className="best-combo-condition-list">
                                {conditions.map(condition => (
                                    <div className="best-combo-condition-row" key={condition.id}>
                                        <Form.Select
                                            size="sm"
                                            value={condition.aptitudeKey}
                                            onChange={event => updateCondition(condition.id, {
                                                aptitudeKey: Number(event.target.value),
                                            })}
                                        >
                                            {APTITUDE_GROUPS.map(group => (
                                                <optgroup key={group} label={APTITUDE_GROUP_LABELS[group]}>
                                                    {APTITUDE_OPTIONS.filter(option => option.group === group).map(option => (
                                                        <option key={option.key} value={option.key}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </Form.Select>
                                        <Form.Select
                                            size="sm"
                                            value={condition.metric}
                                            onChange={event => updateCondition(condition.id, {
                                                metric: event.target.value as BestComboConditionMetric,
                                            })}
                                        >
                                            <option value="stars">Total stars</option>
                                            <option value="sparks">Spark count</option>
                                        </Form.Select>
                                        <Form.Control
                                            size="sm"
                                            type="number"
                                            min={0}
                                            value={condition.min}
                                            title={condition.metric === "stars"
                                                ? `Minimum total stars. At this minimum the target starts at ${getStartingAptitudeGrade(getTargetBaseAptitudeGrade(targetCardId, condition.aptitudeKey), condition.min) ?? "?"}.`
                                                : "Minimum spark count."}
                                            onChange={event => updateCondition(condition.id, {
                                                min: Math.max(0, Number(event.target.value) || 0),
                                            })}
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline-danger"
                                            title="Remove condition"
                                            onClick={() => removeCondition(condition.id)}
                                        >
                                            ×
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    )}

                    {isGpMode && (
                        <p className="best-combo-note">
                            GP score = Σ custom skill value × inherit chance × spawn chance. Spawn chance uses
                            the number of the six lineage members carrying that skill spark and assumes the GP
                            learns the skill during its run. Target innate/awakening skills use 100% inherit
                            chance.
                        </p>
                    )}

                    {targetCharaId === null && (
                        <Alert variant="info" className="best-combo-state">
                            {isGpMode
                                ? "Select a target GP Uma to calculate skill spark inherit and spawn odds."
                                : "Select a target Uma to calculate affinity and spark proc odds."}
                        </Alert>
                    )}

                    {!isGpMode && targetCharaId !== null && orderedSAptitudes.length === 0 && (
                        <Alert variant="info" className="best-combo-state">
                            Select at least one aptitude to aim for S.
                        </Alert>
                    )}

                    {targetCharaId !== null
                        && orderedSAptitudes.length > 0
                        && evaluationVeterans.length < 2 && (
                            <Alert variant="info" className="best-combo-state">
                                Add another owned veteran, or enable <strong>Include uma.moe parents</strong> and
                                search uma.moe, to build combos.
                            </Alert>
                        )}

                    {evaluation && (
                        <div className="best-combo-results">
                            <div className="best-combo-results-header">
                                <div>
                                    <h3 className="best-combo-results-title">
                                        {isGpMode ? "Best GP combos" : "Best combos"}
                                    </h3>
                                    <p className="best-combo-results-count">
                                        {evaluation.matchedCount.toLocaleString()} matching pairs out of{" "}
                                        {evaluation.evaluatedCount.toLocaleString()} evaluated.
                                    </p>
                                </div>
                                {isGpMode ? (
                                    <span className="best-combo-sort-label">Sorted by GP skill score</span>
                                ) : (
                                    <div className="best-combo-results-actions">
                                        <span className="best-combo-sort-label">Rank by</span>
                                        <ButtonGroup size="sm">
                                            <Button
                                                variant={rankMode === "score" ? "secondary" : "outline-secondary"}
                                                title="Blend of S-target chance, named-spark chance, and expected stat gain."
                                                onClick={() => setRankMode("score")}
                                            >
                                                Inheritance score
                                            </Button>
                                            <Button
                                                variant={rankMode === "sChance" ? "secondary" : "outline-secondary"}
                                                onClick={() => setRankMode("sChance")}
                                            >
                                                Aptitude S chance
                                            </Button>
                                        </ButtonGroup>
                                    </div>
                                )}
                            </div>

                            {orientedResults.length === 0 ? (
                                <Alert variant="warning" className="mb-0">
                                    No owned parent pair meets these settings.
                                </Alert>
                            ) : (
                                <>
                                    <div className="best-combo-result-list">
                                        {orientedResults.slice(0, visibleCount).map((result, index) => {
                                            const firstBreakdown = getSparkInheritanceBreakdown(result.parent1, result.firstTree);
                                            const secondBreakdown = getSparkInheritanceBreakdown(result.parent2, result.secondTree);

                                            return (
                                            <div className="best-combo-result" key={`${result.parent1.trained_chara_id}-${result.parent2.trained_chara_id}-${index}`}>
                                                <div className="best-combo-result-rank">#{index + 1}</div>

                                                <div className="best-combo-result-main">
                                                    <div className="best-combo-parents">
                                                        {renderParent(result.parent1, "p1", firstBreakdown)}
                                                        <span className="best-combo-plus">+</span>
                                                        {renderParent(result.parent2, "p2", secondBreakdown)}
                                                    </div>
                                                    <div className="best-combo-result-meta">
                                                        <span className="best-combo-affinity">
                                                            Affinity +{result.affinity}
                                                        </span>
                                                        {isGpMode ? (
                                                            <span className="best-combo-total">
                                                                {result.gpSkills.length} desired skill sparks
                                                            </span>
                                                        ) : (
                                                            <>
                                                                {orderedSAptitudes.map(option => {
                                                                    const minStars = conditionMinimums.get(option.key)?.stars;
                                                                    const stars = result.totals.get(option.key)?.stars ?? 0;
                                                                    const startingGrade = getStartingAptitudeGrade(
                                                                        getTargetBaseAptitudeGrade(targetCardId, option.key),
                                                                        stars,
                                                                    );
                                                                    return (
                                                                        <span className="best-combo-total" key={option.key}>
                                                                            {option.shortLabel} {stars}★
                                                                            {startingGrade ? ` → ${startingGrade}` : ""}
                                                                            {minStars !== undefined && (
                                                                                <span className="best-combo-condition-inline">
                                                                                    , min {minStars}★
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    );
                                                                })}
                                                                {conditions.map((condition, conditionIndex) => {
                                                                    if (condition.metric === "stars" && sAptitudeKeys.includes(condition.aptitudeKey)) {
                                                                        return null;
                                                                    }

                                                                    const option = getAptitudeOption(condition.aptitudeKey);
                                                                    const value = result.conditionValues[conditionIndex] ?? 0;
                                                                    const startingGrade = condition.metric === "stars"
                                                                        ? getStartingAptitudeGrade(
                                                                            getTargetBaseAptitudeGrade(targetCardId, condition.aptitudeKey),
                                                                            value,
                                                                        )
                                                                        : null;

                                                                    return (
                                                                        <span
                                                                            className="best-combo-condition-met"
                                                                            key={condition.id}
                                                                            title={`${option?.label ?? "Aptitude"} minimum ${condition.min}${startingGrade ? `; target starts at ${startingGrade}` : ""}`}
                                                                        >
                                                                            {option?.shortLabel ?? "Aptitude"}: {value}
                                                                            {condition.metric === "stars"
                                                                                ? `★${startingGrade ? ` → ${startingGrade}` : ""}`
                                                                                : " sparks"}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="best-combo-chances">
                                                    {isGpMode ? (
                                                        <>
                                                            <div
                                                                className="best-combo-chance-row best-combo-chance-row--score"
                                                                title="Σ skill value × inherit chance × spawn chance × parent bonus + parent pink score"
                                                            >
                                                                <span className="best-combo-chance-label">GP score</span>
                                                                <strong className="best-combo-chance-value">
                                                                    {result.inheritanceScore.toFixed(1)}
                                                                </strong>
                                                            </div>
                                                            <div className="best-combo-score-parts">
                                                                <span>Skills {result.gpSkillScore.toFixed(1)}</span>
                                                                <span>Pinks {result.gpPinkScore.toFixed(1)}</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {orderedSAptitudes.map(option => {
                                                                const detail = result.sChanceDetails.get(option.key);

                                                                return (
                                                                    <div className="best-combo-chance-group" key={option.key}>
                                                                        <div className="best-combo-chance-row">
                                                                            <span
                                                                                className="best-combo-chance-label"
                                                                                style={{ color: option.color }}
                                                                                title={detail
                                                                                    ? `${detail.stars}★ total. Needs at least ${detail.procsNeeded} proc${detail.procsNeeded === 1 ? "" : "s"} to reach S.`
                                                                                    : undefined}
                                                                            >
                                                                                {option.label}
                                                                                {detail && (
                                                                                    <span className="best-combo-chance-detail">
                                                                                        {detail.stars}★
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                            <strong className="best-combo-chance-value">
                                                                                {(detail?.chance ?? 0).toFixed(2)}%
                                                                            </strong>
                                                                        </div>
                                                                        {detail && detail.procsNeeded > 1 && (
                                                                            <div className="best-combo-proc-breakdown">
                                                                                {detail.procChances.map((chance, index) => (
                                                                                    <span className="best-combo-proc-chance" key={index}>
                                                                                        ≥{index + 1} proc{index === 0 ? "" : "s"}: {chance.toFixed(2)}%
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                            {orderedSAptitudes.length > 1 && (
                                                                <div className="best-combo-chance-row best-combo-chance-row--combined">
                                                                    <span className="best-combo-chance-label">All selected</span>
                                                                    <strong className="best-combo-chance-value">
                                                                        {result.combinedSChance.toFixed(2)}%
                                                                    </strong>
                                                                </div>
                                                            )}
                                                            <div
                                                                className="best-combo-chance-row best-combo-chance-row--score"
                                                                title={`Aptitude S ${result.scoreBreakdown.sTargets.toFixed(1)} + sparks ${result.scoreBreakdown.sparks.toFixed(1)} + stats ${result.scoreBreakdown.stats.toFixed(1)}`}
                                                            >
                                                                <span className="best-combo-chance-label">Inherit score</span>
                                                                <strong className="best-combo-chance-value">
                                                                    {result.inheritanceScore.toFixed(1)}
                                                                </strong>
                                                            </div>
                                                            <div className="best-combo-score-parts">
                                                                <span>Aptitude S {result.scoreBreakdown.sTargets.toFixed(1)}</span>
                                                                <span>Sparks {result.scoreBreakdown.sparks.toFixed(1)}</span>
                                                                <span>Stats {result.scoreBreakdown.stats.toFixed(1)}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                {isGpMode ? (
                                                    <GpSkillDetails
                                                        skills={result.gpSkills}
                                                        config={config}
                                                    />
                                                ) : (
                                                    <>
                                                        <div className="best-combo-combined">
                                                            <div className="best-combo-stat-gains">
                                                                <span className="best-combo-stat-gains-title">Expected stats</span>
                                                                {STAT_KEYS.map(stat => (
                                                                    <span
                                                                        className="best-combo-stat-chip"
                                                                        key={stat}
                                                                        title={formatStatBreakdown(result.scoreBreakdown.statSources[stat])}
                                                                    >
                                                                        <span className="best-combo-stat-name">
                                                                            {STAT_LABELS[stat]}
                                                                        </span>
                                                                        <strong className="best-combo-stat-value">
                                                                            {result.scoreBreakdown.statGains[stat].toFixed(1)}
                                                                        </strong>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <CombinedSparkDetails
                                                                breakdowns={[firstBreakdown, secondBreakdown]}
                                                                config={config}
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            );
                                        })}
                                    </div>

                                    {visibleCount < orientedResults.length && (
                                        <div className="best-combo-more">
                                            <Button
                                                size="sm"
                                                variant="outline-secondary"
                                                onClick={() => setVisibleCount(count => count + RESULT_PAGE_SIZE)}
                                            >
                                                Show {Math.min(RESULT_PAGE_SIZE, orientedResults.length - visibleCount)} more
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default BestComboPanel;
