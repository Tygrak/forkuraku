import { AptitudeGrade, getCardBaseAptitudes } from "../../data/GameToraCharacterAptitudes";
import {
    APTITUDE_OPTIONS,
    AptitudeOption,
    BestComboCondition,
    getAptitudeGradeIndex,
    getAptitudeOption,
    getStartingAptitudeGrade,
} from "./bestCombo";
import { PINK_PRESETS } from "./customScoring";
import { BaseFilter, PinkPresetKey, SkillSparkStyle } from "./types";

const GRADE_UP_STARS = [0, 1, 4, 7, 10] as const;
const MAX_FACTOR_SLOTS = 6;
const A_GRADE_INDEX = 6;
const APTITUDE_INDEX_BY_KEY = new Map(APTITUDE_OPTIONS.map((option, index) => [option.key, index]));
const STYLE_APTITUDE_KEY: Record<SkillSparkStyle, number> = {
    front: 21,
    pace: 22,
    late: 23,
    end: 24,
};

const factorSlotsForStars = (stars: number): number =>
    stars <= 0 ? 0 : Math.min(4, Math.ceil(stars / 3));

export type QuickStartAptitudePlan = {
    aptitudeKey: number;
    option: AptitudeOption;
    baseGrade: AptitudeGrade | null;
    maxGradeUps: number;
    maxStars: number;
    maxStartingGrade: AptitudeGrade | null;
    chosenGradeUps: number;
    stars: number;
    conditionStars: number;
    startingGrade: AptitudeGrade | null;
    reachesA: boolean;
    canReachAAtStart: boolean;
    bestEffort: boolean;
};

export type QuickStartPlan = {
    surface: QuickStartAptitudePlan;
    distance: QuickStartAptitudePlan;
    style: QuickStartAptitudePlan | null;
    conditions: BestComboCondition[];
    aptitudeKeys: number[];
    totalFactorSlots: number;
    moeAptitudeFilters: BaseFilter[];
    summary: string;
    bestEffort: boolean;
};

type AptitudeBase = {
    aptitudeKey: number;
    option: AptitudeOption;
    baseGrade: AptitudeGrade | null;
    baseIndex: number;
    maxGradeUps: number;
    maxGradeIndex: number;
};

const getAptitudeBase = (targetCardId: number, aptitudeKey: number): AptitudeBase | null => {
    const option = getAptitudeOption(aptitudeKey);
    const index = APTITUDE_INDEX_BY_KEY.get(aptitudeKey);
    if (!option || index === undefined) return null;

    const baseGrade = getCardBaseAptitudes(targetCardId)?.[index] ?? null;
    const baseIndex = getAptitudeGradeIndex(baseGrade) ?? 0;
    const maxGradeUps = Math.min(4, Math.max(0, A_GRADE_INDEX - baseIndex));
    const maxGradeIndex = Math.max(baseIndex, Math.min(A_GRADE_INDEX, baseIndex + maxGradeUps));

    return { aptitudeKey, option, baseGrade, baseIndex, maxGradeUps, maxGradeIndex };
};

const buildAptitudePlan = (
    base: AptitudeBase,
    chosenGradeUps: number,
): QuickStartAptitudePlan => {
    const stars = GRADE_UP_STARS[chosenGradeUps];
    const maxStars = GRADE_UP_STARS[base.maxGradeUps];
    const startingGrade = getStartingAptitudeGrade(base.baseGrade, stars);
    const maxStartingGrade = getStartingAptitudeGrade(base.baseGrade, maxStars);

    return {
        aptitudeKey: base.aptitudeKey,
        option: base.option,
        baseGrade: base.baseGrade,
        maxGradeUps: base.maxGradeUps,
        maxStars,
        maxStartingGrade,
        chosenGradeUps,
        stars,
        // A and S aptitudes already start at their maximum, so they need no
        // spark condition at all.
        conditionStars: stars,
        startingGrade,
        reachesA: startingGrade === "A" || startingGrade === "S",
        canReachAAtStart: maxStartingGrade === "A" || maxStartingGrade === "S",
        bestEffort: chosenGradeUps < base.maxGradeUps,
    };
};

export const buildQuickStartPlan = (
    targetCardId: number | null,
    pinkPreset: PinkPresetKey,
    skillSparkStyle: SkillSparkStyle,
): QuickStartPlan | null => {
    if (targetCardId === null) return null;

    const preset = PINK_PRESETS.find(item => item.key === pinkPreset);
    if (!preset) return null;

    const surfaceKey = Number(preset.surfaceKey);
    const distanceKey = Number(preset.distanceKey);
    const styleKey = STYLE_APTITUDE_KEY[skillSparkStyle];
    const surfaceBase = getAptitudeBase(targetCardId, surfaceKey);
    const distanceBase = getAptitudeBase(targetCardId, distanceKey);
    const styleBase = getAptitudeBase(targetCardId, styleKey);
    if (!surfaceBase || !distanceBase) return null;

    // Add the chosen running style only when it starts below A.
    const includeStyle = !!styleBase && styleBase.maxGradeUps > 0;
    const aptitudes: AptitudeBase[] = includeStyle
        ? [surfaceBase, distanceBase, styleBase]
        : [surfaceBase, distanceBase];

    let bestChosen = aptitudes.map(() => 0);
    let bestScore = -Infinity;
    const chosen: number[] = [];

    const search = (index: number, slotsLeft: number) => {
        if (index === aptitudes.length) {
            const grades = aptitudes.map((base, aptitudeIndex) => {
                const gradeUps = chosen[aptitudeIndex];
                return Math.max(base.baseIndex, Math.min(A_GRADE_INDEX, base.baseIndex + gradeUps));
            });
            const totalShortfall = aptitudes.reduce(
                (sum, base, aptitudeIndex) => sum + (base.maxGradeIndex - grades[aptitudeIndex]),
                0,
            );
            const minimumGrade = Math.min(...grades);
            const totalGrade = grades.reduce((sum, grade) => sum + grade, 0);
            const priority = grades.reduce(
                (sum, grade, aptitudeIndex) => sum + grade * (aptitudes.length - aptitudeIndex),
                0,
            );

            // Minimize the shortfall from each aptitude's maximum starting grade,
            // then balance the grades, then favor surface > distance > style.
            const score = -totalShortfall * 1_000_000
                + minimumGrade * 10_000
                + totalGrade * 10
                + priority;
            if (score > bestScore) {
                bestScore = score;
                bestChosen = [...chosen];
            }
            return;
        }

        const base = aptitudes[index];
        for (let gradeUps = 0; gradeUps <= base.maxGradeUps && gradeUps <= slotsLeft; gradeUps++) {
            chosen.push(gradeUps);
            search(index + 1, slotsLeft - gradeUps);
            chosen.pop();
        }
    };

    search(0, MAX_FACTOR_SLOTS);

    const surface = buildAptitudePlan(surfaceBase, bestChosen[0]);
    const distance = buildAptitudePlan(distanceBase, bestChosen[1]);
    const style = includeStyle ? buildAptitudePlan(styleBase!, bestChosen[2]) : null;

    const entries = [
        { plan: surface, aptitudeKey: surfaceKey, id: "quick-surface" },
        { plan: distance, aptitudeKey: distanceKey, id: "quick-distance" },
        ...(style ? [{ plan: style, aptitudeKey: styleKey, id: "quick-style" }] : []),
    ];

    const conditions: BestComboCondition[] = entries
        .filter(entry => entry.plan.conditionStars > 0)
        .map(entry => ({
            id: entry.id,
            aptitudeKey: entry.aptitudeKey,
            metric: "stars",
            min: entry.plan.conditionStars,
        }));

    const moeAptitudeFilters: BaseFilter[] = entries
        .filter(entry => entry.plan.conditionStars > 0)
        .map(entry => ({
            id: entry.id,
            type: "Total",
            stat: entry.plan.option.label,
            stars: 1,
        }));

    const describe = (plan: QuickStartAptitudePlan) => {
        const stars = plan.conditionStars > 0 ? ` (${plan.conditionStars}★)` : "";
        return `${plan.option.shortLabel} ${plan.baseGrade ?? "?"} → ${plan.startingGrade ?? "?"}${stars}`;
    };

    return {
        surface,
        distance,
        style,
        conditions,
        aptitudeKeys: entries.map(entry => entry.aptitudeKey),
        totalFactorSlots: entries.reduce(
            (sum, entry) => sum + factorSlotsForStars(entry.plan.conditionStars),
            0,
        ),
        moeAptitudeFilters,
        summary: entries.map(entry => describe(entry.plan)).join(" · "),
        bestEffort: entries.some(entry => entry.plan.bestEffort),
    };
};
