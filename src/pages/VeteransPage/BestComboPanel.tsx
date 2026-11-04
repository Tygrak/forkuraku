import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, ButtonGroup, Form } from "react-bootstrap";
import AssetLoader from "../../data/AssetLoader";
import UMDatabaseWrapper from "../../data/UMDatabaseWrapper";
import { CustomScoringConfig, Veteran } from "./types";
import { formatCardName, getCardName, getCharaImageUrl, getFactorColor } from "./VeteransUIHelper";
import CustomScoringPanel from "./CustomScoringPanel";
import {
    APTITUDE_GROUP_LABELS,
    APTITUDE_OPTIONS,
    AptitudeGroup,
    BestComboCondition,
    BestComboConditionMetric,
    buildVeteranAptitudeData,
    combineSparkBreakdowns,
    BestComboScoreWeights,
    DEFAULT_BEST_COMBO_SCORE_WEIGHTS,
    evaluateBestCombos,
    ExpectedSpark,
    getAptitudeOption,
    getSparkInheritanceBreakdown,
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
    "Unique: skill hint / stat cap only",
].join("\n");

const uniqueSparks = (entries: ExpectedSpark[]): ExpectedSpark[] => {
    const seen = new Set<string>();
    return entries.filter(entry => {
        const key = `${entry.category}:${entry.name}:${entry.level}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const getParentSparkSummary = (breakdown: ExpectedSpark[]) => {
    const own = breakdown.filter(entry => entry.sourceSlot === "self");
    const blue = own.filter(entry => entry.category === 1);
    const maxBlueLevel = blue.reduce((max, entry) => Math.max(max, entry.level), 0);

    return {
        mainStats: uniqueSparks(blue.filter(entry => entry.level === maxBlueLevel)),
        aptitudes: uniqueSparks(own.filter(entry => entry.category === 2)),
    };
};

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
                                            title={`${entry.level}★ from ${entry.sourceSlot === "self" ? "parent" : entry.sourceSlot.toUpperCase()} · ${formatPercent(entry.chance)} over the full run`}
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
                Combined spark inherit % (all copies · {combined.length} unique)
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
                                            title={`${entry.stars}★ across ${entry.copies} spark${entry.copies === 1 ? "" : "s"} · ${formatPercent(entry.chance)} total chance over the full run`}
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

const BestComboPanel = ({
    veterans,
    config,
    scoringConfig,
    onScoringChange,
    maxGpAffinity,
    maxRaceWins,
}: Props) => {
    const [targetCharaId, setTargetCharaId] = useState<number | null>(null);
    const [sAptitudeKeys, setSAptitudeKeys] = useState<number[]>([]);
    const [conditions, setConditions] = useState<BestComboCondition[]>([]);
    const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);
    const [rankMode, setRankMode] = useState<RankMode>("score");
    const [requiredParent1, setRequiredParent1] = useState<number | null>(null);
    const [requiredParent2, setRequiredParent2] = useState<number | null>(null);
    const [scoreWeights, setScoreWeights] = useState<BestComboScoreWeights>(loadScoreWeights);
    const nextConditionId = useRef(1);

    useEffect(() => {
        try {
            localStorage.setItem(BEST_COMBO_SCORE_WEIGHTS_KEY, JSON.stringify(scoreWeights));
        } catch {
            // Storage may be unavailable; keep the in-memory weights.
        }
    }, [scoreWeights]);

    const charaOptions = useMemo(() => {
        return Object.values(UMDatabaseWrapper.charas)
            .filter(chara => chara.id !== undefined && !!chara.name)
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    }, []);

    const aptitudeData = useMemo(() => {
        const data = new Map<Veteran, ReturnType<typeof buildVeteranAptitudeData>>();
        for (const veteran of veterans) {
            data.set(veteran, buildVeteranAptitudeData(veteran));
        }
        return data;
    }, [veterans]);

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

    const evaluation = useMemo(() => {
        if (targetCharaId === null || orderedSAptitudes.length === 0 || veterans.length < 2) {
            return null;
        }

        return evaluateBestCombos(
            veterans,
            targetCharaId,
            orderedSAptitudes.map(option => option.key),
            conditions,
            scoringConfig,
            aptitudeData,
            requiredParent1,
            requiredParent2,
            scoreWeights,
        );
    }, [
        veterans,
        targetCharaId,
        orderedSAptitudes,
        conditions,
        scoringConfig,
        aptitudeData,
        requiredParent1,
        requiredParent2,
        scoreWeights,
    ]);

    const rankedResults = useMemo(() => {
        if (!evaluation) return [];
        const results = [...evaluation.results];

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
    }, [evaluation, rankMode]);

    const orientedResults = useMemo(() => {
        if (requiredParent1 === null && requiredParent2 === null) return rankedResults;

        return rankedResults.map(result => {
            const firstCharaId = Math.floor(result.parent1.card_id / 100);
            const secondCharaId = Math.floor(result.parent2.card_id / 100);
            const shouldSwap = requiredParent1 !== null
                ? firstCharaId !== requiredParent1
                : secondCharaId !== requiredParent2;

            if (!shouldSwap) return result;

            return {
                ...result,
                parent1: result.parent2,
                parent2: result.parent1,
                firstTree: result.secondTree,
                secondTree: result.firstTree,
            };
        });
    }, [rankedResults, requiredParent1, requiredParent2]);

    useEffect(() => {
        setVisibleCount(RESULT_PAGE_SIZE);
    }, [targetCharaId, sAptitudeKeys, conditions, rankMode, requiredParent1, requiredParent2]);

    const updateParentRequirement = (side: 1 | 2, rawValue: string) => {
        const charaId = rawValue ? Number(rawValue) : null;

        if (side === 1) {
            setRequiredParent1(charaId);
            if (charaId !== null && requiredParent2 === charaId) {
                setRequiredParent2(null);
            }
        } else {
            setRequiredParent2(charaId);
            if (charaId !== null && requiredParent1 === charaId) {
                setRequiredParent1(null);
            }
        }
    };

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

    const renderParent = (veteran: Veteran, slot: "p1" | "p2") => (
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
                    Rank {veteran.rank} · {veteran.rank_score.toLocaleString()} pts
                </span>
            </div>
        </div>
    );

    const renderParentBreakdown = (
        veteran: Veteran,
        breakdown: ExpectedSpark[],
        label: string,
    ) => {
        const { mainStats, aptitudes } = getParentSparkSummary(breakdown);

        const formatSparkSummary = (spark: ExpectedSpark) =>
            `${spark.name} ${spark.level}★ (${formatPercent(spark.chance)})`;

        return (
            <div className="best-combo-breakdown-block" key={label}>
                <div className="best-combo-breakdown-title">
                    <span className="best-combo-breakdown-slot">{label}</span>
                    {getParentLabel(veteran)}
                </div>
                <div className="best-combo-parent-summary">
                    <span className="best-combo-summary-item">
                        <span className="best-combo-summary-label">Main stat</span>{" "}
                        {mainStats.length > 0 ? mainStats.map(formatSparkSummary).join(", ") : "None"}
                    </span>
                    <span className="best-combo-summary-item">
                        <span className="best-combo-summary-label">Aptitude</span>{" "}
                        {aptitudes.length > 0 ? aptitudes.map(formatSparkSummary).join(", ") : "None"}
                    </span>
                </div>
                <SparkBreakdownDetails breakdown={breakdown} config={config} />
            </div>
        );
    };

    return (
        <section className="vet-panel-card vet-best-combo-panel">
            <div className="vet-panel-header">
                <div>
                    <h2 className="vet-panel-title">Best parent combo</h2>
                    <p className="vet-best-combo-description">
                        Find the strongest pair from your owned veterans for a target Uma. Conditions use the
                        total red sparks across both parents and their four grandparents. Pairs with the same
                        Uma name are skipped.
                    </p>
                </div>
            </div>

            {veterans.length < 2 ? (
                <Alert variant="info" className="mb-0">
                    Load at least two owned veterans in the <strong>My veterans</strong> tab to search for a
                    parent pair.
                </Alert>
            ) : (
                <>
                    <div className="best-combo-controls">
                        <div className="best-combo-field">
                            <label className="best-combo-label" htmlFor="best-combo-target">Target Uma</label>
                            <Form.Select
                                id="best-combo-target"
                                size="sm"
                                value={targetCharaId ?? ""}
                                onChange={event => setTargetCharaId(event.target.value ? Number(event.target.value) : null)}
                            >
                                <option value="">Select target Uma...</option>
                                {charaOptions.map(chara => (
                                    <option key={chara.id} value={chara.id}>{chara.name}</option>
                                ))}
                            </Form.Select>
                            {targetCharaId !== null && (
                                <div className="best-combo-target">
                                    <img
                                        className="best-combo-target-img"
                                        src={AssetLoader.getCharaIcon(targetCharaId)}
                                        alt={UMDatabaseWrapper.charas[targetCharaId]?.name ?? "Target Uma"}
                                        onError={event => { (event.target as HTMLImageElement).style.opacity = "0"; }}
                                    />
                                    <span>{UMDatabaseWrapper.charas[targetCharaId]?.name ?? `Chara ${targetCharaId}`}</span>
                                </div>
                            )}
                        </div>

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
                    </div>

                    <div className="best-combo-parent-requirements">
                        <div className="best-combo-parent-requirements-header">
                            <div>
                                <span className="best-combo-label">Parent requirements</span>
                                <p className="best-combo-hint">
                                    Optional. Lock one or both sides to a specific Uma. If only one side is
                                    set, any pair containing that Uma is considered and shown on that side.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline-secondary"
                                disabled={requiredParent1 === null && requiredParent2 === null}
                                onClick={() => {
                                    setRequiredParent1(null);
                                    setRequiredParent2(null);
                                }}
                            >
                                Clear
                            </Button>
                        </div>
                        <div className="best-combo-parent-selects">
                            <div className="best-combo-parent-select">
                                <span className="best-combo-parent-select-label">Parent 1 must be</span>
                                <Form.Select
                                    size="sm"
                                    value={requiredParent1 ?? ""}
                                    onChange={event => updateParentRequirement(1, event.target.value)}
                                >
                                    <option value="">Any Uma</option>
                                    {charaOptions.map(chara => (
                                        <option
                                            key={chara.id}
                                            value={chara.id}
                                            disabled={chara.id === requiredParent2}
                                        >
                                            {chara.name}
                                        </option>
                                    ))}
                                </Form.Select>
                            </div>
                            <div className="best-combo-parent-select">
                                <span className="best-combo-parent-select-label">Parent 2 must be</span>
                                <Form.Select
                                    size="sm"
                                    value={requiredParent2 ?? ""}
                                    onChange={event => updateParentRequirement(2, event.target.value)}
                                >
                                    <option value="">Any Uma</option>
                                    {charaOptions.map(chara => (
                                        <option
                                            key={chara.id}
                                            value={chara.id}
                                            disabled={chara.id === requiredParent1}
                                        >
                                            {chara.name}
                                        </option>
                                    ))}
                                </Form.Select>
                            </div>
                        </div>
                    </div>

                    <div className="best-combo-scoring-row">
                        <div>
                            <span className="best-combo-label">Inheritance score</span>
                            <p className="best-combo-hint">
                                Blends aptitude S chance, named-spark chance, and expected stat gain.
                                Stat gains use the guide averages: blue initial 5/12/21, blue mid-run
                                1–10/1–16/1–28, race 3/6/9, scenario 2×10/20/30.
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
                        <label className="best-combo-weight">
                            <span>Spark value ×</span>
                            <Form.Control
                                size="sm"
                                type="number"
                                min={0}
                                step="0.1"
                                value={scoreWeights.spark}
                                title="Multiplier on named-spark custom values × chance to inherit."
                                onChange={event => updateScoreWeight("spark", event.target.value)}
                            />
                        </label>
                        <label className="best-combo-weight">
                            <span>Stat value ×</span>
                            <Form.Control
                                size="sm"
                                type="number"
                                min={0}
                                step="0.1"
                                value={scoreWeights.stat}
                                title="Multiplier on expected stat gain from blue, race, and scenario sparks."
                                onChange={event => updateScoreWeight("stat", event.target.value)}
                            />
                        </label>
                        <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => setScoreWeights({ ...DEFAULT_BEST_COMBO_SCORE_WEIGHTS })}
                        >
                            Reset
                        </Button>
                    </div>

                    <div className="best-combo-conditions">
                        <div className="best-combo-conditions-header">
                            <div>
                                <span className="best-combo-label">Conditions</span>
                                <p className="best-combo-hint">
                                    Optional. “Stars” counts total red-spark stars; “sparks” counts the number of
                                    red-spark copies.
                                </p>
                            </div>
                            <Button size="sm" variant="outline-secondary" onClick={addCondition}>
                                Add condition
                            </Button>
                        </div>

                        {conditions.length === 0 ? (
                            <p className="best-combo-empty">No conditions — every owned pair will be ranked.</p>
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

                    <p className="best-combo-note">
                        Aptitude S chance counts at least one matching red-spark proc across the two mid-run inheritance
                        turns (base 1/3/5% × individual affinity). It assumes the target aptitude is A, so a
                        single proc reaches S.
                    </p>

                    {targetCharaId === null && (
                        <Alert variant="info" className="best-combo-state">
                            Select a target Uma to calculate affinity and spark proc odds.
                        </Alert>
                    )}

                    {targetCharaId !== null && orderedSAptitudes.length === 0 && (
                        <Alert variant="info" className="best-combo-state">
                            Select at least one aptitude to aim for S.
                        </Alert>
                    )}

                    {evaluation && (
                        <div className="best-combo-results">
                            <div className="best-combo-results-header">
                                <div>
                                    <h3 className="best-combo-results-title">Best combos</h3>
                                    <p className="best-combo-results-count">
                                        {evaluation.matchedCount.toLocaleString()} matching pairs out of{" "}
                                        {evaluation.evaluatedCount.toLocaleString()} evaluated.
                                    </p>
                                </div>
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
                            </div>

                            {orientedResults.length === 0 ? (
                                <Alert variant="warning" className="mb-0">
                                    No owned parent pair meets these conditions. Try lowering the minimums.
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
                                                        {renderParent(result.parent1, "p1")}
                                                        <span className="best-combo-plus">+</span>
                                                        {renderParent(result.parent2, "p2")}
                                                    </div>
                                                    <div className="best-combo-result-meta">
                                                        <span className="best-combo-affinity">
                                                            Affinity +{result.affinity}
                                                        </span>
                                                        {orderedSAptitudes.map(option => {
                                                            const minStars = conditionMinimums.get(option.key)?.stars;
                                                            return (
                                                                <span className="best-combo-total" key={option.key}>
                                                                    {option.shortLabel} {result.totals.get(option.key)?.stars ?? 0}★
                                                                    {minStars !== undefined && (
                                                                        <span className="best-combo-condition-inline">
                                                                            {" "}· min {minStars}★
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
                                                            return (
                                                                <span
                                                                    className="best-combo-condition-met"
                                                                    key={condition.id}
                                                                    title={`${option?.label ?? "Aptitude"} minimum ${condition.min}`}
                                                                >
                                                                    {option?.shortLabel ?? "Aptitude"}: {value}
                                                                    {condition.metric === "stars" ? "★" : " sparks"}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="best-combo-chances">
                                                    {orderedSAptitudes.map(option => (
                                                        <div className="best-combo-chance-row" key={option.key}>
                                                            <span
                                                                className="best-combo-chance-label"
                                                                style={{ color: option.color }}
                                                            >
                                                                {option.label}
                                                            </span>
                                                            <strong className="best-combo-chance-value">
                                                                {(result.sChances.get(option.key) ?? 0).toFixed(2)}%
                                                            </strong>
                                                        </div>
                                                    ))}
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
                                                </div>

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
                                                        <span className="best-combo-stat-note">
                                                            Unique sparks: hints / stat caps only
                                                        </span>
                                                    </div>
                                                    <CombinedSparkDetails
                                                        breakdowns={[firstBreakdown, secondBreakdown]}
                                                        config={config}
                                                    />
                                                </div>

                                                <div className="best-combo-breakdown">
                                                    {renderParentBreakdown(result.parent1, firstBreakdown, "P1")}
                                                    {renderParentBreakdown(result.parent2, secondBreakdown, "P2")}
                                                </div>
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
