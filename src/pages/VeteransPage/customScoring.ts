import UMDatabaseWrapper from "../../data/UMDatabaseWrapper";
import { FactorItem, aggregateFactors, calculatePairAffinity, getFactorCategory } from "../../data/VeteransHelper";
import { CustomScoringConfig, CustomScoreMode, PinkPresetKey, SkillSparkStyle, StarWeights, Veteran } from "./types";

export const CUSTOM_SCORING_STORAGE_KEY = "hakuraku.veterans.customScoring.v1";
export const CUSTOM_SCORING_CONFIG_VERSION = 4;

export type BlueStatDefinition = {
    key: string;
    label: string;
};

export const BLUE_STAT_DEFINITIONS: BlueStatDefinition[] = [
    { key: "1", label: "Speed" },
    { key: "2", label: "Stamina" },
    { key: "3", label: "Power" },
    { key: "4", label: "Guts" },
    { key: "5", label: "Wit" },
];

export type PinkTypeDefinition = {
    key: string;
    label: string;
    group: "surface" | "distance" | "style";
};

export const PINK_TYPE_DEFINITIONS: PinkTypeDefinition[] = [
    { key: "11", label: "Turf", group: "surface" },
    { key: "12", label: "Dirt", group: "surface" },
    { key: "31", label: "Sprint", group: "distance" },
    { key: "32", label: "Mile", group: "distance" },
    { key: "33", label: "Medium", group: "distance" },
    { key: "34", label: "Long", group: "distance" },
    { key: "21", label: "Front Runner", group: "style" },
    { key: "22", label: "Pace Chaser", group: "style" },
    { key: "23", label: "Late Surger", group: "style" },
    { key: "24", label: "End Closer", group: "style" },
];

export type PinkPresetDefinition = {
    key: Exclude<PinkPresetKey, "custom">;
    label: string;
    surfaceKey: string;
    distanceKey: string;
};

export const PINK_PRESETS: PinkPresetDefinition[] = [
    { key: "turf-sprint", label: "Turf Sprint", surfaceKey: "11", distanceKey: "31" },
    { key: "dirt-sprint", label: "Dirt Sprint", surfaceKey: "12", distanceKey: "31" },
    { key: "turf-mile", label: "Turf Mile", surfaceKey: "11", distanceKey: "32" },
    { key: "dirt-mile", label: "Dirt Mile", surfaceKey: "12", distanceKey: "32" },
    { key: "turf-medium", label: "Turf Medium", surfaceKey: "11", distanceKey: "33" },
    { key: "dirt-medium", label: "Dirt Medium", surfaceKey: "12", distanceKey: "33" },
    { key: "turf-long", label: "Turf Long", surfaceKey: "11", distanceKey: "34" },
    { key: "dirt-long", label: "Dirt Long", surfaceKey: "12", distanceKey: "34" },
];

const PINK_PRESET_BY_KEY = new Map(PINK_PRESETS.map(preset => [preset.key, preset]));

const STYLE_PINK_KEY: Record<SkillSparkStyle, string> = {
    front: "21",
    pace: "22",
    late: "23",
    end: "24",
};

export const applyStylePinkPreset = (
    multipliers: Record<string, number>,
    style: SkillSparkStyle,
): Record<string, number> => {
    const next = { ...multipliers };

    for (const definition of PINK_TYPE_DEFINITIONS) {
        if (definition.group === "style") {
            next[definition.key] = 0;
        }
    }
    next[STYLE_PINK_KEY[style]] = 0.5;
    return next;
};

export const createPinkPresetMultipliers = (
    presetKey: PinkPresetKey,
    style: SkillSparkStyle,
): Record<string, number> => {
    const multipliers = Object.fromEntries(PINK_TYPE_DEFINITIONS.map(definition => [definition.key, 0]));
    const preset = PINK_PRESET_BY_KEY.get(presetKey as Exclude<PinkPresetKey, "custom">);
    if (preset) {
        multipliers[preset.surfaceKey] = 1;
        multipliers[preset.distanceKey] = 1;
    }
    return applyStylePinkPreset(multipliers, style);
};

export const getSearchHighlightedFactorKeys = (config: CustomScoringConfig): Set<number> => {
    const keys = new Set<number>();
    const styleWeights = config.skillSparkWeights[config.skillSparkStyle] ?? {};

    for (const [key, weights] of Object.entries(styleWeights)) {
        if ((weights[2] ?? 0) > 0) {
            const presetKey = Number(key);
            if (Number.isFinite(presetKey)) keys.add(presetKey);
        }
    }

    if (config.pinkPreset !== "custom") {
        const preset = PINK_PRESETS.find(item => item.key === config.pinkPreset);
        if (preset) {
            keys.add(Number(preset.surfaceKey));
            keys.add(Number(preset.distanceKey));
        }
    }

    return keys;
};

export type WhiteSparkPreset = {
    key: number;
    label: string;
    tier: string;
    defaultWeights: StarWeights;
};

export const SKILL_SPARK_STYLE_DEFINITIONS: Array<{ key: SkillSparkStyle; label: string }> = [
    { key: "front", label: "Front Runner" },
    { key: "pace", label: "Pace Chaser" },
    { key: "late", label: "Late Surger" },
    { key: "end", label: "End Closer" },
];

const TIER_WEIGHTS: Record<string, StarWeights> = {
    T0: [3, 5, 8],
    "Pseudo T0": [1, 3, 5],
    "T0.5": [1, 2.5, 4],
    T1: [1, 2, 3],
    "T1.5": [1, 2, 3],
    T2: [1, 2, 3],
    T3: [0.5, 1, 2],
    "T3.5": [0.5, 1, 1.5],
    T4: [0, 0.5, 1],
    T5: [0, 0.5, 1],
    HM: [0.5, 1, 2],
    Other: [0, 0, 0],
};

const ZERO_DEFAULT_HM_KEYS = new Set([20036, 20217, 20051, 20160, 20085, 20088, 20091, 20094]);

const makePreset = (
    key: number,
    label: string,
    tier: string,
    defaultWeights: StarWeights = TIER_WEIGHTS[tier],
): WhiteSparkPreset => ({
    key,
    label,
    tier,
    defaultWeights: ZERO_DEFAULT_HM_KEYS.has(key) && tier === "HM"
        ? [0, 0, 0]
        : defaultWeights,
});

// Tiered separately for each style from the community "Loop Skills" sheet:
// https://docs.google.com/spreadsheets/d/1pWBnsoH2h7NDm9Q5ZRZ-s9JuyMN-aAI5wJbIEqACCt4/edit
export const WHITE_SPARK_PRESETS_BY_STYLE: Record<SkillSparkStyle, WhiteSparkPreset[]> = {
    front: [
        makePreset(20126, "Dodging Danger", "T0"),
        makePreset(20045, "Prudent Positioning", "T0"),
        makePreset(21005, "Ignited Spirit WIT", "T0"),
        makePreset(20160, "Groundwork", "T0"),
        makePreset(21009, "Racing Spirit: Stamina", "Pseudo T0"),
        makePreset(20161, "Tail Held High", "T1"),
        makePreset(20246, "Firm Resolve", "T1"),
        makePreset(20239, "Mad Dash", "T1"),
        makePreset(20203, "Risky Business", "T1"),
        makePreset(20124, "Front Runner Straightaways ○", "T1.5"),
        makePreset(20125, "Front Runner Corners ○", "T1.5"),
        makePreset(20166, "Playtime's Over!", "T2"),
        makePreset(20054, "Fast-Paced", "T2"),
        makePreset(20127, "Leader's Pride", "T2"),
        makePreset(20053, "Early Lead", "T2"),
        makePreset(20255, "High Speed", "T3"),
        makePreset(21028, "Earth's Blessing", "T3"),
        makePreset(20165, "Slipstream", "T3"),
        makePreset(20046, "Ramp Up", "T3"),
        makePreset(20152, "Front Runner Savvy ○", "T5"),
        makePreset(20216, "Restraint", "T5"),
        makePreset(21013, "Racing Spirit: Mood", "HM"),
        makePreset(20036, "Straightaway Adept", "HM"),
        makePreset(20159, "Uma Stan", "HM"),
        makePreset(20217, "Downhill Speedster", "HM"),
        makePreset(20051, "Homestretch Haste", "HM"),
        makePreset(20085, "Hesitant Front Runners", "HM"),
        makePreset(20269, "Goin' First", "HM"),
        makePreset(21027, "Sea's Blessing", "HM"),
        makePreset(20107, "Unyielding Spirit", "Other"),
        makePreset(20108, "Speed Eater", "Other"),
        makePreset(20068, "Productive Plan", "Other"),
        makePreset(20065, "Sprinting Gear", "Other"),
        makePreset(20260, "Ignition", "Other"),
    ],
    pace: [
        makePreset(20159, "Uma Stan", "T0"),
        makePreset(20049, "Nimble Navigator", "T0"),
        makePreset(21009, "Racing Spirit: Stamina", "Pseudo T0"),
        makePreset(21010, "Racing Spirit: Power", "Pseudo T0"),
        makePreset(20161, "Tail Held High", "T1"),
        makePreset(20203, "Risky Business", "T1"),
        makePreset(20165, "Slipstream", "T1.5"),
        makePreset(20166, "Playtime's Over!", "T1.5"),
        makePreset(20132, "Pace Chaser Corners ○", "T1.5"),
        makePreset(20131, "Pace Chaser Straightaways ○", "T1.5"),
        makePreset(20190, "Head-On", "T1.5"),
        makePreset(20046, "Ramp Up", "T2"),
        makePreset(20247, "Latch On", "T2"),
        makePreset(20237, "On the Attack", "T2"),
        makePreset(20255, "High Speed", "T3"),
        makePreset(21028, "Earth's Blessing", "T3"),
        makePreset(20160, "Groundwork", "T4"),
        makePreset(20133, "Shrewd Step", "T4"),
        makePreset(20216, "Restraint", "T4"),
        makePreset(20248, "My True Strength", "HM"),
        makePreset(20036, "Straightaway Adept", "HM"),
        makePreset(20033, "Corner Adept ○", "HM"),
        makePreset(20217, "Downhill Speedster", "HM"),
        makePreset(20051, "Homestretch Haste", "HM"),
        makePreset(20045, "Prudent Positioning", "HM"),
        makePreset(21005, "Ignited Spirit WIT", "HM"),
        makePreset(20088, "Hesitant Pace Chasers", "HM"),
        makePreset(21027, "Sea's Blessing", "HM"),
        makePreset(20107, "Unyielding Spirit", "Other"),
        makePreset(20108, "Speed Eater", "Other"),
        makePreset(20068, "Productive Plan", "Other"),
        makePreset(20219, "All Set", "Other"),
        makePreset(20065, "Sprinting Gear", "Other"),
        makePreset(20260, "Ignition", "Other"),
    ],
    late: [
        makePreset(20159, "Uma Stan", "T0"),
        makePreset(20049, "Nimble Navigator", "T0"),
        makePreset(21009, "Racing Spirit: Stamina", "Pseudo T0"),
        makePreset(21010, "Racing Spirit: Power", "Pseudo T0"),
        makePreset(20245, "Pedal to the Metal", "T0.5"),
        makePreset(20261, "Unrestrained Passion", "T0.5"),
        makePreset(20161, "Tail Held High", "T1"),
        makePreset(20203, "Risky Business", "T1"),
        makePreset(20215, "Full Throttle", "T1"),
        makePreset(20165, "Slipstream", "T1.5"),
        makePreset(20166, "Playtime's Over!", "T1.5"),
        makePreset(20060, "Slick Surge", "T1.5"),
        makePreset(20139, "Late Surger Corners ○", "T1.5"),
        makePreset(20138, "Late Surger Straightaways ○", "T1.5"),
        makePreset(20141, "1,500,000 CC", "T1.5"),
        makePreset(20262, "Start the Charge", "T2"),
        makePreset(20046, "Ramp Up", "T2"),
        makePreset(20247, "Latch On", "T2"),
        makePreset(20059, "Position Pilfer", "T2"),
        makePreset(20255, "High Speed", "T3"),
        makePreset(21028, "Earth's Blessing", "T3"),
        makePreset(20212, "Fearless", "T3"),
        makePreset(20061, "Outer Swell", "T3"),
        makePreset(21026, "Sun's Blessing", "T3.5"),
        makePreset(20216, "Restraint", "T4"),
        makePreset(20242, "Scramble", "HM"),
        makePreset(20036, "Straightaway Adept", "HM"),
        makePreset(20033, "Corner Adept ○", "HM"),
        makePreset(20217, "Downhill Speedster", "HM"),
        makePreset(20051, "Homestretch Haste", "HM"),
        makePreset(20160, "Groundwork", "HM"),
        makePreset(20254, "Pressure (Late Surger)", "HM"),
        makePreset(20091, "Hesitant Late Surgers", "HM"),
        makePreset(20107, "Unyielding Spirit", "Other"),
        makePreset(20240, "Leap Forward", "Other"),
        makePreset(20207, "Free-Spirited", "Other"),
        makePreset(20065, "Sprinting Gear", "Other"),
        makePreset(20260, "Ignition", "Other"),
    ],
    end: [
        makePreset(20159, "Uma Stan", "T0"),
        makePreset(20049, "Nimble Navigator", "T0"),
        makePreset(21009, "Racing Spirit: Stamina", "Pseudo T0"),
        makePreset(21010, "Racing Spirit: Power", "Pseudo T0"),
        makePreset(20161, "Tail Held High", "T1"),
        makePreset(20203, "Risky Business", "T1"),
        makePreset(20064, "Straightaway Spurt", "T1"),
        makePreset(20165, "Slipstream", "T1.5"),
        makePreset(20166, "Playtime's Over!", "T1.5"),
        makePreset(20146, "End Closer Corners ○", "T1.5"),
        makePreset(20145, "End Closer Straightaways ○", "T1.5"),
        makePreset(20046, "Ramp Up", "T2"),
        makePreset(20063, "Masterful Gambit", "T2"),
        makePreset(20255, "High Speed", "T3"),
        makePreset(21028, "Earth's Blessing", "T3"),
        makePreset(20249, "Sharp Steps", "T3"),
        makePreset(21026, "Sun's Blessing", "T3.5"),
        makePreset(20238, "Breakin' Out", "T3.5"),
        makePreset(20202, "Early Start", "T4"),
        makePreset(20216, "Restraint", "T4"),
        makePreset(20036, "Straightaway Adept", "HM"),
        makePreset(20217, "Downhill Speedster", "HM"),
        makePreset(20051, "Homestretch Haste", "HM"),
        makePreset(20160, "Groundwork", "HM"),
        makePreset(20094, "Hesitant End Closers", "HM"),
        makePreset(20107, "Unyielding Spirit", "Other"),
        makePreset(20240, "Leap Forward", "Other"),
        makePreset(20207, "Free-Spirited", "Other"),
        makePreset(20065, "Sprinting Gear", "Other"),
        makePreset(20260, "Ignition", "Other"),
    ],
};

const toPresetMap = (presets: WhiteSparkPreset[]): Map<number, WhiteSparkPreset> =>
    new Map(presets.map(preset => [preset.key, preset]));

export const WHITE_SPARK_PRESET_BY_STYLE: Record<SkillSparkStyle, Map<number, WhiteSparkPreset>> = {
    front: toPresetMap(WHITE_SPARK_PRESETS_BY_STYLE.front),
    pace: toPresetMap(WHITE_SPARK_PRESETS_BY_STYLE.pace),
    late: toPresetMap(WHITE_SPARK_PRESETS_BY_STYLE.late),
    end: toPresetMap(WHITE_SPARK_PRESETS_BY_STYLE.end),
};

const buildStylePresetWeights = (style: SkillSparkStyle): Record<string, StarWeights> =>
    Object.fromEntries(
        WHITE_SPARK_PRESETS_BY_STYLE[style].map(preset => [
            String(preset.key),
            [...preset.defaultWeights] as StarWeights,
        ]),
    );

export const createDefaultCustomScoringConfig = (): CustomScoringConfig => ({
    configVersion: CUSTOM_SCORING_CONFIG_VERSION,
    mode: "parent",
    parentSelfMultiplier: 1.5,
    blueWeights: [0, 6, 15],
    blueMultipliers: Object.fromEntries(
        BLUE_STAT_DEFINITIONS.map(definition => [definition.key, definition.key === "5" ? 0.5 : 1]),
    ),
    pinkWeights: [0, 6, 15],
    pinkMultipliers: applyStylePinkPreset(
        Object.fromEntries(
            PINK_TYPE_DEFINITIONS.map(definition => [
                definition.key,
                definition.group === "style" ? 0 : 1,
            ]),
        ),
        "front",
    ),
    pinkPreset: "custom",
    uniqueWeights: [0, 2, 3],
    scenarioPointsPerStar: 2,
    affinityMinMultiplier: 0.25,
    affinityMaxMultiplier: 1,
    skillSparkStyle: "front",
    skillSparkWeights: {
        front: buildStylePresetWeights("front"),
        pace: buildStylePresetWeights("pace"),
        late: buildStylePresetWeights("late"),
        end: buildStylePresetWeights("end"),
    },
});

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

const normalizeStarWeights = (value: unknown, fallback: StarWeights): StarWeights => {
    if (Array.isArray(value) && value.length >= 3) {
        const [one, two, three] = value;
        if (isFiniteNumber(one) && isFiniteNumber(two) && isFiniteNumber(three)) {
            return [one, two, three];
        }
    }
    return [...fallback] as StarWeights;
};

const normalizeNumber = (value: unknown, fallback: number): number =>
    isFiniteNumber(value) ? value : fallback;

const normalizeMode = (value: unknown): CustomScoreMode =>
    value === "grandparent" ? "grandparent" : "parent";

const normalizeSkillSparkStyle = (value: unknown): SkillSparkStyle => {
    if (value === "pace" || value === "late" || value === "end") return value;
    return "front";
};

const normalizePinkPreset = (value: unknown): PinkPresetKey => {
    if (value === "custom") return "custom";
    return PINK_PRESETS.some(preset => preset.key === value)
        ? value as PinkPresetKey
        : "custom";
};

const normalizeMultiplierRecord = (
    value: unknown,
    definitions: Array<{ key: string }>,
    fallback: Record<string, number>,
): Record<string, number> => {
    const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return Object.fromEntries(
        definitions.map(definition => [
            definition.key,
            normalizeNumber(raw[definition.key], fallback[definition.key] ?? 1),
        ]),
    );
};

const normalizeSkillSparkWeights = (value: unknown): Record<string, StarWeights> | null => {
    if (!value || typeof value !== "object") return null;

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, weights]) => [
            key,
            normalizeStarWeights(weights, [0, 0, 0]),
        ]),
    );
};

const normalizeStyleSkillWeights = (
    value: unknown,
    defaults: Record<SkillSparkStyle, Record<string, StarWeights>>,
): Record<SkillSparkStyle, Record<string, StarWeights>> => {
    const rawStyles = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const result = {} as Record<SkillSparkStyle, Record<string, StarWeights>>;

    for (const definition of SKILL_SPARK_STYLE_DEFINITIONS) {
        result[definition.key] = normalizeSkillSparkWeights(rawStyles[definition.key])
            ?? defaults[definition.key];
    }
    return result;
};

type StoredCustomScoringConfig = Partial<CustomScoringConfig> & {
    // Fields from earlier versions of the custom scorer.
    parentMultiplier?: unknown;
    witBlueMultiplier?: unknown;
    namedSparkWeights?: unknown;
};

const normalizeConfig = (value: unknown): CustomScoringConfig => {
    const defaults = createDefaultCustomScoringConfig();
    if (!value || typeof value !== "object") return defaults;

    const raw = value as StoredCustomScoringConfig;
    let blueMultipliers = normalizeMultiplierRecord(
        raw.blueMultipliers,
        BLUE_STAT_DEFINITIONS,
        defaults.blueMultipliers,
    );

    if (!raw.blueMultipliers && isFiniteNumber(raw.witBlueMultiplier)) {
        blueMultipliers = { ...blueMultipliers, "5": raw.witBlueMultiplier };
    }

    const hasStyleSkillWeights = !!raw.skillSparkWeights
        && typeof raw.skillSparkWeights === "object"
        && SKILL_SPARK_STYLE_DEFINITIONS.some(definition =>
            Object.prototype.hasOwnProperty.call(raw.skillSparkWeights, definition.key)
        );
    const legacySkillWeights = hasStyleSkillWeights
        ? null
        : normalizeSkillSparkWeights(raw.skillSparkWeights)
            ?? normalizeSkillSparkWeights(raw.namedSparkWeights);
    const skillSparkWeights = hasStyleSkillWeights
        ? normalizeStyleSkillWeights(raw.skillSparkWeights, defaults.skillSparkWeights)
        : legacySkillWeights
            ? Object.fromEntries(
                SKILL_SPARK_STYLE_DEFINITIONS.map(definition => {
                    const styleDefaults = defaults.skillSparkWeights[definition.key];
                    const legacyOverrides = Object.fromEntries(
                        Object.entries(legacySkillWeights).filter(([key]) => key in styleDefaults),
                    );
                    return [definition.key, { ...styleDefaults, ...legacyOverrides }];
                }),
            ) as Record<SkillSparkStyle, Record<string, StarWeights>>
            : defaults.skillSparkWeights;

    let blueWeights = normalizeStarWeights(raw.blueWeights, defaults.blueWeights);
    let pinkWeights = normalizeStarWeights(raw.pinkWeights, defaults.pinkWeights);

    const sourceConfigVersion = isFiniteNumber(raw.configVersion) ? raw.configVersion : 0;
    if (sourceConfigVersion < 3) {
        blueWeights = [...defaults.blueWeights] as StarWeights;
        pinkWeights = [...defaults.pinkWeights] as StarWeights;

        for (const definition of SKILL_SPARK_STYLE_DEFINITIONS) {
            const styleWeights = skillSparkWeights[definition.key];

            for (const preset of WHITE_SPARK_PRESETS_BY_STYLE[definition.key]) {
                if (preset.tier === "T0" || preset.tier === "Pseudo T0") {
                    const key = String(preset.key);
                    if (styleWeights[key]) {
                        styleWeights[key] = [...preset.defaultWeights] as StarWeights;
                    }
                }
            }
        }
    }

    if (sourceConfigVersion < 4) {
        for (const definition of SKILL_SPARK_STYLE_DEFINITIONS) {
            const styleWeights = skillSparkWeights[definition.key];

            for (const preset of WHITE_SPARK_PRESETS_BY_STYLE[definition.key]) {
                const shouldZero = preset.tier === "Other"
                    || (preset.tier === "HM" && ZERO_DEFAULT_HM_KEYS.has(preset.key));

                if (shouldZero) {
                    const key = String(preset.key);
                    if (styleWeights[key]) {
                        styleWeights[key] = [...preset.defaultWeights] as StarWeights;
                    }
                }
            }
        }
    }

    const skillSparkStyle = normalizeSkillSparkStyle(raw.skillSparkStyle);
    let pinkMultipliers = normalizeMultiplierRecord(
        raw.pinkMultipliers,
        PINK_TYPE_DEFINITIONS,
        defaults.pinkMultipliers,
    );
    const pinkPreset = normalizePinkPreset(raw.pinkPreset);

    // Older configs did not have a style-linked pink preset, so normalize them to the selected style.
    if (raw.pinkPreset === undefined) {
        pinkMultipliers = applyStylePinkPreset(pinkMultipliers, skillSparkStyle);
    }

    return {
        configVersion: CUSTOM_SCORING_CONFIG_VERSION,
        mode: normalizeMode(raw.mode),
        parentSelfMultiplier: normalizeNumber(
            raw.parentSelfMultiplier,
            normalizeNumber(raw.parentMultiplier, defaults.parentSelfMultiplier),
        ),
        blueWeights,
        blueMultipliers,
        pinkWeights,
        pinkMultipliers,
        pinkPreset,
        uniqueWeights: normalizeStarWeights(raw.uniqueWeights, defaults.uniqueWeights),
        scenarioPointsPerStar: normalizeNumber(raw.scenarioPointsPerStar, defaults.scenarioPointsPerStar),
        affinityMinMultiplier: normalizeNumber(raw.affinityMinMultiplier, defaults.affinityMinMultiplier),
        affinityMaxMultiplier: normalizeNumber(raw.affinityMaxMultiplier, defaults.affinityMaxMultiplier),
        skillSparkStyle,
        skillSparkWeights,
    };
};

export const loadCustomScoringConfig = (): CustomScoringConfig => {
    if (typeof localStorage === "undefined") return createDefaultCustomScoringConfig();

    try {
        const raw = localStorage.getItem(CUSTOM_SCORING_STORAGE_KEY);
        return raw ? normalizeConfig(JSON.parse(raw)) : createDefaultCustomScoringConfig();
    } catch {
        return createDefaultCustomScoringConfig();
    }
};

export const saveCustomScoringConfig = (config: CustomScoringConfig): void => {
    if (typeof localStorage === "undefined") return;

    try {
        localStorage.setItem(CUSTOM_SCORING_STORAGE_KEY, JSON.stringify(config));
    } catch {
        // Storage may be unavailable (private browsing, quota); scoring still works for this session.
    }
};

export type CustomScoreContext = {
    maxGpAffinity?: number | null;
    maxRaceWins?: number | null;
};

export type WhiteSparkOption = {
    key: number;
    label: string;
};

export const getWhiteSparkOptions = (): WhiteSparkOption[] => {
    const textData = UMDatabaseWrapper.textData[147] ?? {};
    const byKey = new Map<number, string>();

    for (const [indexText, text] of Object.entries(textData)) {
        const factorId = Number(indexText);
        if (!Number.isFinite(factorId) || getFactorCategory(factorId) !== 5) continue;

        const key = Math.floor(factorId / 100);
        if (!byKey.has(key) && text.text) {
            byKey.set(key, text.text);
        }
    }

    return Array.from(byKey, ([key, label]) => ({ key, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
};

const calculateVeteranGpAffinity = (veteran: Veteran): number => {
    let total = 0;

    for (const successor of veteran.succession_chara_array ?? []) {
        if (successor.position_id === 10 || successor.position_id === 20) {
            total += calculatePairAffinity(veteran, successor);
        }
    }
    return total;
};

const countRaceWins = (veteran: Veteran): number =>
    veteran.win_saddle_id_array?.length ?? 0;

export const calculateCustomScoreRanges = (
    veterans: Veteran[],
): { maxGpAffinity: number; maxRaceWins: number } => {
    let maxGpAffinity = 0;
    let maxRaceWins = 0;

    for (const veteran of veterans) {
        maxGpAffinity = Math.max(maxGpAffinity, calculateVeteranGpAffinity(veteran));
        maxRaceWins = Math.max(maxRaceWins, countRaceWins(veteran));
    }

    return { maxGpAffinity, maxRaceWins };
};

const starIndex = (level: number): number => Math.min(3, Math.max(1, Math.trunc(level))) - 1;

const pointsForStars = (weights: StarWeights, level: number): number =>
    weights[starIndex(level)] ?? 0;

export const getSparkScoreValue = (
    factor: Pick<FactorItem, "category" | "factorId" | "level">,
    config: CustomScoringConfig,
): number => {
    switch (factor.category) {
        case 1:
            return pointsForStars(config.blueWeights, factor.level)
                * (config.blueMultipliers[String(Math.floor(factor.factorId / 100))] ?? 1);
        case 2:
            return pointsForStars(config.pinkWeights, factor.level)
                * (config.pinkMultipliers[String(Math.floor(factor.factorId / 100))] ?? 1);
        case 3:
            return pointsForStars(config.uniqueWeights, factor.level);
        case 4:
            return String(factor.factorId).startsWith("3")
                ? config.scenarioPointsPerStar * factor.level
                : 0;
        case 5: {
            const key = String(Math.floor(factor.factorId / 100));
            const weights = config.skillSparkWeights[config.skillSparkStyle]?.[key];
            return weights ? pointsForStars(weights, factor.level) : 0;
        }
        default:
            return 0;
    }
};

export type CustomScoreBreakdown = {
    total: number;
    base: number;
    blues: number;
    pinks: number;
    uniques: number;
    scenarios: number;
    skillSparks: number;
    parentSelfMultiplier: number;
    affinity: number;
    maxAffinity: number;
    affinityMultiplier: number;
};

export const calculateCustomScore = (
    veteran: Veteran,
    config: CustomScoringConfig,
    context?: CustomScoreContext,
): CustomScoreBreakdown => {
    let blues = 0;
    let pinks = 0;
    let uniques = 0;
    let scenarios = 0;
    let skillSparks = 0;

    for (const factor of aggregateFactors(veteran)) {
        const isSelfFactor = factor.sourceSlot === "self";
        const isGgpSkillSpark = config.mode === "grandparent"
            && !isSelfFactor
            && factor.category === 5;

        if (config.mode === "grandparent" && !isSelfFactor && !isGgpSkillSpark) continue;

        if (isGgpSkillSpark) {
            const key = String(Math.floor(factor.factorId / 100));
            const weights = config.skillSparkWeights[config.skillSparkStyle]?.[key];
            if (weights) {
                skillSparks += (weights[2] ?? 0) * 0.5;
            }
            continue;
        }

        const sourceMultiplier = config.mode === "parent" && isSelfFactor
            ? config.parentSelfMultiplier
            : 1;
        const points = getSparkScoreValue(factor, config) * sourceMultiplier;
        if (points === 0) continue;

        switch (factor.category) {
            case 1:
                blues += points;
                break;
            case 2:
                pinks += points;
                break;
            case 3:
                uniques += points;
                break;
            case 4:
                scenarios += points;
                break;
            case 5:
                skillSparks += points;
                break;
            default:
                break;
        }
    }

    const base = blues + pinks + uniques + scenarios + skillSparks;
    const isParentMode = config.mode === "parent";
    const affinity = isParentMode ? calculateVeteranGpAffinity(veteran) : countRaceWins(veteran);
    const maxAffinity = isParentMode
        ? context?.maxGpAffinity ?? 0
        : context?.maxRaceWins ?? 0;
    const affinityRatio = maxAffinity > 0
        ? Math.max(0, Math.min(1, affinity / maxAffinity))
        : 0;
    const affinityMultiplier = maxAffinity > 0
        ? config.affinityMinMultiplier
            + (config.affinityMaxMultiplier - config.affinityMinMultiplier) * affinityRatio
        : 1;

    const total = Math.round(base * affinityMultiplier * 100) / 100;

    return {
        total,
        base,
        blues,
        pinks,
        uniques,
        scenarios,
        skillSparks,
        parentSelfMultiplier: config.parentSelfMultiplier,
        affinity,
        maxAffinity,
        affinityMultiplier,
    };
};
