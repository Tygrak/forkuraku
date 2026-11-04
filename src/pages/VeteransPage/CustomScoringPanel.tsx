import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Modal, Table } from "react-bootstrap";
import { CustomScoringConfig, PinkPresetKey, SkillSparkStyle, StarWeights } from "./types";
import {
    BLUE_STAT_DEFINITIONS,
    PINK_PRESETS,
    PINK_TYPE_DEFINITIONS,
    SKILL_SPARK_STYLE_DEFINITIONS,
    WHITE_SPARK_PRESETS_BY_STYLE,
    WHITE_SPARK_PRESET_BY_STYLE,
    applyStylePinkPreset,
    createDefaultCustomScoringConfig,
    createPinkPresetMultipliers,
    getWhiteSparkOptions,
} from "./customScoring";
import "./VeteransPage.css";

interface CustomScoringPanelProps {
    config: CustomScoringConfig;
    onChange: (config: CustomScoringConfig) => void;
    maxGpAffinity: number;
    maxRaceWins: number;
}

type TopLevelWeightsKey = "blueWeights" | "pinkWeights" | "uniqueWeights";

const StarWeightInputs: React.FC<{
    weights: StarWeights;
    onChange: (index: number, value: string) => void;
}> = ({ weights, onChange }) => (
    <>
        {[0, 1, 2].map(index => (
            <td key={index}>
                <Form.Control
                    type="number"
                    size="sm"
                    min={0}
                    step="any"
                    value={weights[index]}
                    onChange={e => onChange(index, e.target.value)}
                />
            </td>
        ))}
    </>
);

const parseWeight = (raw: string): number => {
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
};

const CustomScoringPanel: React.FC<CustomScoringPanelProps> = ({
    config,
    onChange,
    maxGpAffinity,
    maxRaceWins,
}) => {
    const [show, setShow] = useState(false);
    const [draft, setDraft] = useState<CustomScoringConfig>(config);
    const [skillSearch, setSkillSearch] = useState("");
    const [skillAddSearch, setSkillAddSearch] = useState("");
    const [selectedSkillKey, setSelectedSkillKey] = useState("");

    useEffect(() => {
        if (show) {
            setDraft(config);
            setSkillSearch("");
            setSkillAddSearch("");
            setSelectedSkillKey("");
        }
    }, [show, config]);

    const allWhiteSparkOptions = useMemo(
        () => (show ? getWhiteSparkOptions() : []),
        [show],
    );

    const optionLabelByKey = useMemo(
        () => new Map(allWhiteSparkOptions.map(option => [option.key, option.label])),
        [allWhiteSparkOptions],
    );

    const currentStyle = draft.skillSparkStyle;
    const currentStylePresets = WHITE_SPARK_PRESETS_BY_STYLE[currentStyle];
    const currentPresetByKey = WHITE_SPARK_PRESET_BY_STYLE[currentStyle];
    const currentStyleWeights = draft.skillSparkWeights[currentStyle] ?? {};

    const presetOrder = useMemo(
        () => new Map(currentStylePresets.map((preset, index) => [preset.key, index])),
        [currentStylePresets],
    );

    const configuredSkillKeys = useMemo(() => {
        const keys = Object.keys(currentStyleWeights)
            .map(Number)
            .filter(key => Number.isFinite(key));

        return keys.sort((a, b) => {
            const presetDelta = (presetOrder.get(a) ?? Number.MAX_SAFE_INTEGER)
                - (presetOrder.get(b) ?? Number.MAX_SAFE_INTEGER);
            if (presetDelta !== 0) return presetDelta;

            const labelA = currentPresetByKey.get(a)?.label ?? optionLabelByKey.get(a) ?? String(a);
            const labelB = currentPresetByKey.get(b)?.label ?? optionLabelByKey.get(b) ?? String(b);
            return labelA.localeCompare(labelB);
        });
    }, [currentStyleWeights, presetOrder, currentPresetByKey, optionLabelByKey]);

    const filteredSkillKeys = useMemo(() => {
        const query = skillSearch.trim().toLowerCase();
        if (!query) return configuredSkillKeys;

        return configuredSkillKeys.filter(key => {
            const label = currentPresetByKey.get(key)?.label
                ?? optionLabelByKey.get(key)
                ?? String(key);
            return label.toLowerCase().includes(query);
        });
    }, [configuredSkillKeys, currentPresetByKey, optionLabelByKey, skillSearch]);

    const availableSkillOptions = useMemo(() => {
        const query = skillAddSearch.trim().toLowerCase();
        const configured = new Set(Object.keys(currentStyleWeights));

        return allWhiteSparkOptions
            .filter(option => !configured.has(String(option.key)))
            .filter(option => !query || option.label.toLowerCase().includes(query));
    }, [allWhiteSparkOptions, currentStyleWeights, skillAddSearch]);

    const updateTopLevelWeights = (key: TopLevelWeightsKey, index: number, raw: string) => {
        setDraft(current => {
            const weights = [...current[key]] as StarWeights;
            weights[index] = parseWeight(raw);
            return { ...current, [key]: weights } as CustomScoringConfig;
        });
    };

    const updateMultiplier = (
        key: "blueMultipliers" | "pinkMultipliers",
        multiplierKey: string,
        raw: string,
    ) => {
        setDraft(current => {
            const next = {
                ...current,
                [key]: {
                    ...current[key],
                    [multiplierKey]: parseWeight(raw),
                },
            } as CustomScoringConfig;

            if (key === "pinkMultipliers") {
                next.pinkPreset = "custom";
            }
            return next;
        });
    };

    const updateSkillWeights = (presetKey: number, index: number, raw: string) => {
        setDraft(current => {
            const style = current.skillSparkStyle;
            const key = String(presetKey);
            const styleWeights = current.skillSparkWeights[style] ?? {};
            const weights = [...(styleWeights[key] ?? [0, 0, 0])] as StarWeights;
            weights[index] = parseWeight(raw);
            return {
                ...current,
                skillSparkWeights: {
                    ...current.skillSparkWeights,
                    [style]: {
                        ...styleWeights,
                        [key]: weights,
                    },
                },
            };
        });
    };

    const addSelectedSkill = () => {
        const key = Number(selectedSkillKey);
        if (!Number.isFinite(key) || currentStyleWeights[String(key)]) return;

        const presetWeights = currentPresetByKey.get(key)?.defaultWeights ?? [1, 2, 3];
        setDraft(current => {
            const style = current.skillSparkStyle;
            return {
                ...current,
                skillSparkWeights: {
                    ...current.skillSparkWeights,
                    [style]: {
                        ...(current.skillSparkWeights[style] ?? {}),
                        [String(key)]: [...presetWeights] as StarWeights,
                    },
                },
            };
        });
        setSelectedSkillKey("");
        setSkillAddSearch("");
    };

    const removeSkill = (key: string) => {
        setDraft(current => {
            const style = current.skillSparkStyle;
            const nextWeights = { ...(current.skillSparkWeights[style] ?? {}) };
            delete nextWeights[key];
            return {
                ...current,
                skillSparkWeights: {
                    ...current.skillSparkWeights,
                    [style]: nextWeights,
                },
            };
        });
    };

    const resetWhitePresets = () => {
        setDraft(current => ({
            ...current,
            skillSparkWeights: {
                ...current.skillSparkWeights,
                [current.skillSparkStyle]:
                    createDefaultCustomScoringConfig().skillSparkWeights[current.skillSparkStyle],
            },
        }));
    };

    const clearWhiteSparks = () => {
        setDraft(current => ({
            ...current,
            skillSparkWeights: {
                ...current.skillSparkWeights,
                [current.skillSparkStyle]: {},
            },
        }));
    };

    const apply = () => {
        onChange(draft);
        setShow(false);
    };

    return (
        <>
            <Button variant="outline-secondary" size="sm" onClick={() => setShow(true)}>
                Custom Scoring
            </Button>

            <Modal show={show} onHide={() => setShow(false)} size="lg" scrollable>
                <Modal.Header closeButton>
                    <Modal.Title>Custom Scoring</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="row g-3 mb-3">
                        <div className="col-md-8">
                            <Form.Label className="opt-label-bold">Lineage mode</Form.Label>
                            <Form.Select
                                size="sm"
                                value={draft.mode}
                                onChange={e => setDraft(current => ({
                                    ...current,
                                    mode: e.target.value === "grandparent" ? "grandparent" : "parent",
                                }))}
                            >
                                <option value="parent">Parent — score this veteran plus both of its GPs</option>
                                <option value="grandparent">Grandparent — score this veteran plus GGP skill sparks</option>
                            </Form.Select>
                            <Form.Text className="text-muted">
                                Parent mode includes the factors of both GPs stored in the veteran's succession data.
                                Grandparent mode uses the veteran's own factors plus each GGP skill spark at a flat
                                0.5× of that spark's 3★ value, regardless of its star count.
                            </Form.Text>
                        </div>
                        <div className="col-md-4">
                            <Form.Label className="opt-label-bold">Parent self multiplier</Form.Label>
                            <Form.Control
                                type="number"
                                size="sm"
                                min={0}
                                step="any"
                                value={draft.parentSelfMultiplier}
                                onChange={e => setDraft(current => ({
                                    ...current,
                                    parentSelfMultiplier: parseWeight(e.target.value),
                                }))}
                            />
                            <Form.Text className="text-muted">
                                Applies to this veteran's own factors in parent mode. GP factors stay at 1×.
                                Default is 1.5×.
                            </Form.Text>
                        </div>
                    </div>

                    <div className="row g-3 mb-3">
                        <div className="col-sm-6 col-md-3">
                            <Form.Label className="opt-label">Min affinity multiplier</Form.Label>
                            <Form.Control
                                type="number"
                                size="sm"
                                min={0}
                                step="any"
                                value={draft.affinityMinMultiplier}
                                onChange={e => setDraft(current => ({
                                    ...current,
                                    affinityMinMultiplier: parseWeight(e.target.value),
                                }))}
                            />
                        </div>
                        <div className="col-sm-6 col-md-3">
                            <Form.Label className="opt-label">Max affinity multiplier</Form.Label>
                            <Form.Control
                                type="number"
                                size="sm"
                                min={0}
                                step="any"
                                value={draft.affinityMaxMultiplier}
                                onChange={e => setDraft(current => ({
                                    ...current,
                                    affinityMaxMultiplier: parseWeight(e.target.value),
                                }))}
                            />
                        </div>
                        <div className="col-md-6 d-flex align-items-end">
                            <Form.Text className="text-muted">
                                {draft.mode === "parent"
                                    ? `Parent mode uses affinity with GPs: 0 → ${maxGpAffinity.toLocaleString()} GP affinity is ${draft.affinityMinMultiplier}× → ${draft.affinityMaxMultiplier}×.`
                                    : `Grandparent mode uses race wins: 0 → ${maxRaceWins.toLocaleString()} wins is ${draft.affinityMinMultiplier}× → ${draft.affinityMaxMultiplier}×.`}
                            </Form.Text>
                        </div>
                    </div>

                    <div className="custom-score-section-title">Blue sparks</div>
                    <Table size="sm" bordered className="custom-score-table">
                        <thead>
                            <tr>
                                <th>Blue star values</th>
                                <th>1★</th>
                                <th>2★</th>
                                <th>3★</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>All blue sparks</td>
                                <StarWeightInputs
                                    weights={draft.blueWeights}
                                    onChange={(index, value) => updateTopLevelWeights("blueWeights", index, value)}
                                />
                            </tr>
                        </tbody>
                    </Table>
                    <div className="custom-score-multiplier-grid">
                        {BLUE_STAT_DEFINITIONS.map(definition => (
                            <div className="custom-score-multiplier" key={definition.key}>
                                <span>{definition.label}</span>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    min={0}
                                    step="any"
                                    value={draft.blueMultipliers[definition.key] ?? 1}
                                    onChange={e => updateMultiplier("blueMultipliers", definition.key, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                    <Form.Text className="text-muted">
                        Blue multipliers let you value each stat differently. Wit defaults to 0.5×.
                    </Form.Text>

                    <div className="custom-score-section-title">Pink sparks</div>
                    <div className="row g-2 mb-2">
                        <div className="col-sm-5 col-md-4">
                            <Form.Label className="opt-label-bold">Pink preset</Form.Label>
                            <Form.Select
                                size="sm"
                                value={draft.pinkPreset}
                                onChange={e => {
                                    const presetKey = e.target.value as PinkPresetKey;
                                    setDraft(current => ({
                                        ...current,
                                        pinkPreset: presetKey,
                                        pinkMultipliers: presetKey === "custom"
                                            ? current.pinkMultipliers
                                            : createPinkPresetMultipliers(presetKey, current.skillSparkStyle),
                                    }));
                                }}
                            >
                                <option value="custom">Custom</option>
                                {PINK_PRESETS.map(preset => (
                                    <option key={preset.key} value={preset.key}>
                                        {preset.label}
                                    </option>
                                ))}
                            </Form.Select>
                        </div>
                        <div className="col-sm-7 col-md-8 d-flex align-items-end">
                            <Form.Text className="text-muted">
                                Distance/surface presets zero every pink except the selected surface and distance.
                                The active style keeps that style's pink at 0.5×.
                            </Form.Text>
                        </div>
                    </div>
                    <Table size="sm" bordered className="custom-score-table">
                        <thead>
                            <tr>
                                <th>Pink star values</th>
                                <th>1★</th>
                                <th>2★</th>
                                <th>3★</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>All pink sparks</td>
                                <StarWeightInputs
                                    weights={draft.pinkWeights}
                                    onChange={(index, value) => updateTopLevelWeights("pinkWeights", index, value)}
                                />
                            </tr>
                        </tbody>
                    </Table>
                    {(["surface", "distance", "style"] as const).map(group => (
                        <div
                            key={group}
                            className={`custom-score-multiplier-row custom-score-multiplier-row--${group}`}
                        >
                            {PINK_TYPE_DEFINITIONS.filter(definition => definition.group === group).map(definition => (
                                <div className="custom-score-multiplier" key={definition.key}>
                                    <span>{definition.label}</span>
                                    <Form.Control
                                        type="number"
                                        size="sm"
                                        min={0}
                                        step="any"
                                        value={draft.pinkMultipliers[definition.key] ?? 1}
                                        onChange={e => updateMultiplier("pinkMultipliers", definition.key, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                    <Form.Text className="text-muted">
                        Changing the white-spark preset style sets all style pinks to 0 except that style, which
                        stays at 0.5×.
                    </Form.Text>

                    <div className="custom-score-section-title">Unique and scenario sparks</div>
                    <Table size="sm" bordered className="custom-score-table">
                        <thead>
                            <tr>
                                <th>Spark type</th>
                                <th>1★</th>
                                <th>2★</th>
                                <th>3★</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Unique</td>
                                <StarWeightInputs
                                    weights={draft.uniqueWeights}
                                    onChange={(index, value) => updateTopLevelWeights("uniqueWeights", index, value)}
                                />
                            </tr>
                            <tr>
                                <td>Scenario spark (points per star)</td>
                                <td colSpan={3}>
                                    <Form.Control
                                        type="number"
                                        size="sm"
                                        min={0}
                                        step="any"
                                        value={draft.scenarioPointsPerStar}
                                        onChange={e => setDraft(current => ({
                                            ...current,
                                            scenarioPointsPerStar: parseWeight(e.target.value),
                                        }))}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </Table>

                    <div className="custom-score-section-title">White skill sparks</div>
                    <Form.Text className="text-muted d-block mb-2">
                        Presets are tiered separately for each running style from the community "Loop Skills" sheet.
                        Every style keeps its own editable white-spark weights.
                    </Form.Text>

                    <div className="row g-2 mb-2">
                        <div className="col-sm-5 col-md-4">
                            <Form.Label className="opt-label-bold">Preset style</Form.Label>
                            <Form.Select
                                size="sm"
                                value={draft.skillSparkStyle}
                                onChange={e => {
                                    const style = e.target.value as SkillSparkStyle;
                                    setDraft(current => ({
                                        ...current,
                                        skillSparkStyle: style,
                                        pinkMultipliers: applyStylePinkPreset(current.pinkMultipliers, style),
                                    }));
                                    setSkillSearch("");
                                    setSkillAddSearch("");
                                    setSelectedSkillKey("");
                                }}
                            >
                                {SKILL_SPARK_STYLE_DEFINITIONS.map(definition => (
                                    <option key={definition.key} value={definition.key}>
                                        {definition.label}
                                    </option>
                                ))}
                            </Form.Select>
                        </div>
                        <div className="col-sm-7 col-md-8 d-flex align-items-end">
                            <Form.Text className="text-muted">
                                Switching styles changes which white-spark preset list is used for scoring.
                            </Form.Text>
                        </div>
                    </div>

                    <div className="custom-score-white-toolbar">
                        <div className="custom-score-white-toolbar-item">
                            <Form.Label className="opt-label">Filter configured</Form.Label>
                            <Form.Control
                                size="sm"
                                placeholder="Search configured sparks..."
                                value={skillSearch}
                                onChange={e => setSkillSearch(e.target.value)}
                            />
                        </div>
                        <div className="custom-score-white-toolbar-item custom-score-white-toolbar-item--add">
                            <Form.Label className="opt-label">Add white spark</Form.Label>
                            <div className="custom-score-add-row">
                                <Form.Control
                                    size="sm"
                                    placeholder="Filter skills..."
                                    value={skillAddSearch}
                                    onChange={e => setSkillAddSearch(e.target.value)}
                                />
                                <Form.Select
                                    size="sm"
                                    value={selectedSkillKey}
                                    onChange={e => setSelectedSkillKey(e.target.value)}
                                >
                                    <option value="">Select a white spark...</option>
                                    {availableSkillOptions.map(option => (
                                        <option key={option.key} value={option.key}>
                                            {option.label}
                                        </option>
                                    ))}
                                </Form.Select>
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={addSelectedSkill}
                                    disabled={!selectedSkillKey}
                                >
                                    Add
                                </Button>
                            </div>
                        </div>
                        <div className="custom-score-white-actions">
                            <Button variant="outline-secondary" size="sm" onClick={resetWhitePresets}>
                                Reset Style Presets
                            </Button>
                            <Button variant="outline-danger" size="sm" onClick={clearWhiteSparks}>
                                Clear All
                            </Button>
                        </div>
                    </div>

                    <Table size="sm" bordered className="custom-score-table custom-score-skill-table">
                        <thead>
                            <tr>
                                <th>Spark</th>
                                <th>Tier</th>
                                <th>1★</th>
                                <th>2★</th>
                                <th>3★</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSkillKeys.map(key => {
                                const keyString = String(key);
                                const preset = currentPresetByKey.get(key);
                                const label = preset?.label ?? optionLabelByKey.get(key) ?? `Skill spark ${key}`;
                                const weights = currentStyleWeights[keyString] ?? [0, 0, 0];

                                return (
                                    <tr key={key}>
                                        <td>{label}</td>
                                        <td>
                                            <span className="custom-score-tier-badge">
                                                {preset?.tier ?? "Custom"}
                                            </span>
                                        </td>
                                        <StarWeightInputs
                                            weights={weights}
                                            onChange={(index, value) => updateSkillWeights(key, index, value)}
                                        />
                                        <td>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => removeSkill(keyString)}
                                            >
                                                ×
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredSkillKeys.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-muted">
                                        No white sparks selected for this style. Use “Reset Style Presets” or add one above.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        variant="outline-secondary"
                        onClick={() => setDraft(createDefaultCustomScoringConfig())}
                    >
                        Reset Defaults
                    </Button>
                    <Button variant="secondary" onClick={() => setShow(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={apply}>
                        Apply &amp; Sort
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default CustomScoringPanel;
