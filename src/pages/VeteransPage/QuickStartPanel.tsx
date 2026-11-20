import { useMemo, useState } from "react";
import { Alert, Button, ButtonGroup, Form } from "react-bootstrap";
import { getAptitudeOption } from "./bestCombo";
import {
    PINK_PRESETS,
    SKILL_SPARK_STYLE_DEFINITIONS,
    createPinkPresetMultipliers,
} from "./customScoring";
import ParentCharacterFilter from "./ParentCharacterFilter";
import { buildQuickStartPlan } from "./quickStartPlan";
import {
    nextQuickStartPresetId,
    QuickStartMode,
    QuickStartRequest,
} from "./quickStart";
import { getTargetCardOptions, loadLastTargetUma } from "./targetOptions";
import { CustomScoringConfig, PinkPresetKey, SkillSparkStyle, Veteran } from "./types";
import "./VeteransPage.css";

type Props = {
    veterans: Veteran[];
    veteransLoading: boolean;
    customScoringConfig: CustomScoringConfig;
    umaMoeApiKey: string;
    onSearch: (request: QuickStartRequest) => void;
    onOpenSettings: () => void;
    onOpenVeterans: () => void;
};

const QuickStartPanel = ({
    veterans,
    veteransLoading,
    customScoringConfig,
    umaMoeApiKey,
    onSearch,
    onOpenSettings,
    onOpenVeterans,
}: Props) => {
    const [mode, setMode] = useState<QuickStartMode>("parent");
    const [useUmaMoe, setUseUmaMoe] = useState(false);
    const [targetCardId, setTargetCardId] = useState<number | null>(loadLastTargetUma);
    const [forcedParent1, setForcedParent1] = useState<number[]>([]);
    const [forcedParent2, setForcedParent2] = useState<number[]>([]);
    const [pinkPreset, setPinkPreset] = useState<PinkPresetKey>(
        customScoringConfig.pinkPreset === "custom" ? "turf-medium" : customScoringConfig.pinkPreset,
    );
    const [skillSparkStyle, setSkillSparkStyle] = useState<SkillSparkStyle>(
        customScoringConfig.skillSparkStyle,
    );

    const targetCardOptions = useMemo(() => getTargetCardOptions(), []);
    const selectedTarget = targetCardOptions.find(option => option.id === targetCardId);
    const plan = useMemo(
        () => buildQuickStartPlan(targetCardId, pinkPreset, skillSparkStyle),
        [targetCardId, pinkPreset, skillSparkStyle],
    );

    const handleSearch = () => {
        if (!plan || targetCardId === null) return;

        const scoring: CustomScoringConfig = {
            ...customScoringConfig,
            pinkPreset,
            pinkMultipliers: createPinkPresetMultipliers(pinkPreset, skillSparkStyle),
            skillSparkStyle,
        };

        onSearch({
            preset: {
                id: nextQuickStartPresetId(),
                mode,
                targetCardId,
                useUmaMoe,
                forcedParent1,
                forcedParent2,
                sAptitudeKeys: plan.aptitudeKeys,
                conditions: plan.conditions,
                pinkPreset,
                skillSparkStyle,
            },
            scoring,
            moeAptitudeFilters: plan.moeAptitudeFilters,
        });
    };

    const conditionText = plan?.conditions
        .map(condition => {
            const option = getAptitudeOption(condition.aptitudeKey);
            return `${option?.shortLabel ?? "Aptitude"} ${condition.min}★`;
        })
        .join(" · ");

    return (
        <section className="vet-panel-card vet-quick-start">
            <div className="vet-panel-header">
                <div>
                    <h2 className="vet-panel-title">Quick start</h2>
                    <p className="vet-best-combo-description">
                        Pick a target and track, then open the combo search with the build already configured.
                    </p>
                </div>
            </div>

            {veterans.length === 0 && (
                <Alert variant="info">
                    {veteransLoading
                        ? "Loading stored veterans..."
                        : "Load a veterans file before searching."}
                    {!veteransLoading && (
                        <div className="quick-start-actions">
                            <Button size="sm" variant="outline-info" onClick={onOpenSettings}>
                                Open Settings
                            </Button>
                            <Button size="sm" variant="outline-secondary" onClick={onOpenVeterans}>
                                Open My veterans
                            </Button>
                        </div>
                    )}
                </Alert>
            )}

            <div className="quick-start-grid">
                <div className="quick-start-field">
                    <span className="best-combo-label">Searching for</span>
                    <ButtonGroup size="sm">
                        <Button
                            variant={mode === "parent" ? "primary" : "outline-secondary"}
                            onClick={() => setMode("parent")}
                        >
                            Parent
                        </Button>
                        <Button
                            variant={mode === "gp" ? "primary" : "outline-secondary"}
                            onClick={() => setMode("gp")}
                        >
                            GP
                        </Button>
                    </ButtonGroup>
                    <p className="best-combo-hint">
                        Parent searches Best combo. GP searches Best GP combo.
                    </p>
                </div>

                <div className="quick-start-field">
                    <label className="best-combo-label" htmlFor="quick-start-target">
                        Target Uma
                    </label>
                    <Form.Select
                        id="quick-start-target"
                        size="sm"
                        value={targetCardId ?? ""}
                        onChange={event => setTargetCardId(event.target.value ? Number(event.target.value) : null)}
                    >
                        <option value="">Select target Uma...</option>
                        {targetCardOptions.map(option => (
                            <option key={option.id} value={option.id}>
                                {option.charaName} — {option.cardName}
                            </option>
                        ))}
                    </Form.Select>
                    {selectedTarget && (
                        <p className="best-combo-hint">
                            {selectedTarget.charaName} {selectedTarget.cardName}
                        </p>
                    )}
                </div>

                <div className="quick-start-field">
                    <label className="best-combo-label" htmlFor="quick-start-track">
                        Track type
                    </label>
                    <Form.Select
                        id="quick-start-track"
                        size="sm"
                        value={pinkPreset}
                        onChange={event => setPinkPreset(event.target.value as PinkPresetKey)}
                    >
                        {PINK_PRESETS.map(preset => (
                            <option key={preset.key} value={preset.key}>
                                {preset.label}
                            </option>
                        ))}
                    </Form.Select>
                </div>

                <div className="quick-start-field">
                    <label className="best-combo-label" htmlFor="quick-start-style">
                        Skill preset
                    </label>
                    <Form.Select
                        id="quick-start-style"
                        size="sm"
                        value={skillSparkStyle}
                        onChange={event => setSkillSparkStyle(event.target.value as SkillSparkStyle)}
                    >
                        {SKILL_SPARK_STYLE_DEFINITIONS.map(style => (
                            <option key={style.key} value={style.key}>
                                {style.label}
                            </option>
                        ))}
                    </Form.Select>
                </div>
            </div>

            <div className="quick-start-forced-parents">
                <div className="quick-start-field">
                    <span className="best-combo-label">Parent 1 must be one of</span>
                    <ParentCharacterFilter
                        veterans={veterans}
                        selected={forcedParent1}
                        onChange={setForcedParent1}
                        includeAllCharacters
                        selectionMode="card"
                        label="Parent 1"
                        title="Select Parent 1 costume"
                        excludedIds={forcedParent2}
                    />
                </div>
                <div className="quick-start-field">
                    <span className="best-combo-label">Parent 2 must be one of</span>
                    <ParentCharacterFilter
                        veterans={veterans}
                        selected={forcedParent2}
                        onChange={setForcedParent2}
                        includeAllCharacters
                        selectionMode="card"
                        label="Parent 2"
                        title="Select Parent 2 costume"
                        excludedIds={forcedParent1}
                    />
                </div>
            </div>

            <div className="quick-start-uma-moe">
                <Form.Check
                    type="switch"
                    id="quick-start-use-uma-moe"
                    label="Use uma.moe searches"
                    checked={useUmaMoe}
                    onChange={event => setUseUmaMoe(event.target.checked)}
                />
                <p className="best-combo-hint">
                    Automatically loads up to 3 pages of uma.moe parents. Requires an API key.
                </p>
                {useUmaMoe && !umaMoeApiKey.trim() && (
                    <p className="quick-start-warning">
                        Add a uma.moe API key in Settings.
                    </p>
                )}
            </div>

            {plan ? (
                <div className="quick-start-plan">
                    <div className="quick-start-plan-row">
                        <span>{plan.surface.option.label}</span>
                        <span className="quick-start-plan-value">
                            {plan.surface.baseGrade ?? "?"} → {plan.surface.startingGrade ?? "?"}
                            {plan.surface.conditionStars > 0 ? ` · ${plan.surface.conditionStars}★` : ""}
                        </span>
                    </div>
                    <div className="quick-start-plan-row">
                        <span>{plan.distance.option.label}</span>
                        <span className="quick-start-plan-value">
                            {plan.distance.baseGrade ?? "?"} → {plan.distance.startingGrade ?? "?"}
                            {plan.distance.conditionStars > 0 ? ` · ${plan.distance.conditionStars}★` : ""}
                        </span>
                    </div>
                    {plan.style && (
                        <div className="quick-start-plan-row">
                            <span>{plan.style.option.label}</span>
                            <span className="quick-start-plan-value">
                                {plan.style.baseGrade ?? "?"} → {plan.style.startingGrade ?? "?"}
                                {plan.style.conditionStars > 0 ? ` · ${plan.style.conditionStars}★` : ""}
                            </span>
                        </div>
                    )}
                    <div className="quick-start-plan-row">
                        <span>Lineage factor slots</span>
                        <span className="quick-start-plan-value">{plan.totalFactorSlots}/6</span>
                    </div>
                    {conditionText && (
                        <div className="quick-start-plan-row">
                            <span>Conditions</span>
                            <span className="quick-start-plan-value">{conditionText}</span>
                        </div>
                    )}
                    {!plan.surface.canReachAAtStart && (
                        <p className="quick-start-warning">
                            {plan.surface.option.label} can only reach {plan.surface.maxStartingGrade} at start.
                        </p>
                    )}
                    {!plan.distance.canReachAAtStart && (
                        <p className="quick-start-warning">
                            {plan.distance.option.label} can only reach {plan.distance.maxStartingGrade} at start.
                        </p>
                    )}
                    {plan.style && !plan.style.canReachAAtStart && (
                        <p className="quick-start-warning">
                            {plan.style.option.label} can only reach {plan.style.maxStartingGrade} at start.
                        </p>
                    )}
                    {plan.bestEffort && (
                        <p className="quick-start-warning">
                            Best fit: requirements were reduced to stay within the 6 lineage factor slots.
                        </p>
                    )}
                    <p className="best-combo-hint">
                        These aptitudes will be selected as the S targets.
                    </p>
                </div>
            ) : (
                <p className="best-combo-hint">
                    Select a target Uma to calculate its starting aptitudes.
                </p>
            )}

            <div className="quick-start-actions">
                <Button
                    variant="primary"
                    onClick={handleSearch}
                    disabled={!plan || veterans.length === 0}
                >
                    Search {mode === "gp" ? "Best GP combo" : "Best combo"}
                </Button>
                {useUmaMoe && (
                    <span className="best-combo-hint">
                        uma.moe will load up to 3 pages automatically.
                    </span>
                )}
            </div>
        </section>
    );
};

export default QuickStartPanel;
