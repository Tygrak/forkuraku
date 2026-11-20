import type { BestComboCondition } from "./bestCombo";
import type { BaseFilter, CustomScoringConfig, PinkPresetKey, SkillSparkStyle } from "./types";

let nextPresetId = 1;

export const nextQuickStartPresetId = (): number => nextPresetId++;

export type QuickStartMode = "parent" | "gp";

export type QuickStartPreset = {
    id: number;
    mode: QuickStartMode;
    targetCardId: number;
    useUmaMoe: boolean;
    /** Card (costume) IDs. */
    forcedParent1: number[];
    /** Card (costume) IDs. */
    forcedParent2: number[];
    sAptitudeKeys: number[];
    conditions: BestComboCondition[];
    pinkPreset: PinkPresetKey;
    skillSparkStyle: SkillSparkStyle;
};

export type QuickStartRequest = {
    preset: QuickStartPreset;
    scoring: CustomScoringConfig;
    moeAptitudeFilters: BaseFilter[];
};
