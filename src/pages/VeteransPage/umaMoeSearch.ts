import { UMA_MOE_API_BASE } from "../../config/umaMoe";
import UMDatabaseWrapper from "../../data/UMDatabaseWrapper";
import { getFactorCategory } from "../../data/VeteransHelper";
import { PINK_PRESETS } from "./customScoring";
import { BaseFilter, CustomScoringConfig, Veteran, getFilterStats, getFilterStarOptions } from "./types";

type UmaMoeInheritance = {
    inheritance_id: number;
    scenario_id?: number | null;
    main_parent_id: number;
    parent_left_id?: number | null;
    parent_right_id?: number | null;
    parent_rank?: number | null;
    parent_rarity?: number | null;
    main_blue_factors?: number | null;
    main_pink_factors?: number | null;
    main_green_factors?: number | null;
    main_white_factors?: number[] | null;
    left_blue_factors?: number | null;
    left_pink_factors?: number | null;
    left_green_factors?: number | null;
    left_white_factors?: number[] | null;
    right_blue_factors?: number | null;
    right_pink_factors?: number | null;
    right_green_factors?: number | null;
    right_white_factors?: number[] | null;
    main_win_saddles?: number[] | null;
    left_win_saddles?: number[] | null;
    right_win_saddles?: number[] | null;
    win_count?: number | null;
};

type UmaMoeSearchItem = {
    account_id: string;
    trainer_name: string;
    last_updated?: string | null;
    inheritance: UmaMoeInheritance;
};

type UmaMoeSearchResponse = {
    items: UmaMoeSearchItem[];
    total: string;
    page: number;
    limit: number;
    total_pages: number;
};

export type UmaMoeSearchResult = {
    veterans: Veteran[];
    total: string;
    page: number;
    limit: number;
    totalPages: number;
};

const numberOrZero = (value: number | null | undefined): number =>
    Number.isFinite(value) ? Number(value) : 0;

const factorIds = (values: Array<number | null | undefined>): number[] =>
    values.filter((value): value is number => Number.isFinite(value) && Number(value) > 0)
        .map(value => Number(value));

const factorInfoArray = (ids: number[]) =>
    ids.map(factor_id => ({ factor_id, level: factor_id % 100 }));

const makeSuccessionEntry = (
    positionId: 10 | 20,
    cardId: number | null | undefined,
    factors: number[],
    winSaddles: number[],
) => ({
    position_id: positionId,
    card_id: numberOrZero(cardId),
    rank: 0,
    rarity: 0,
    talent_level: 0,
    factor_id_array: factors,
    factor_info_array: factorInfoArray(factors),
    win_saddle_id_array: winSaddles,
    owner_viewer_id: 0,
    user_info_summary: null,
});

const mapSearchItem = (item: UmaMoeSearchItem): Veteran => {
    const inheritance = item.inheritance;
    const mainFactors = factorIds([
        inheritance.main_blue_factors,
        inheritance.main_pink_factors,
        inheritance.main_green_factors,
        ...(inheritance.main_white_factors ?? []),
    ]);
    const leftFactors = factorIds([
        inheritance.left_blue_factors,
        inheritance.left_pink_factors,
        inheritance.left_green_factors,
        ...(inheritance.left_white_factors ?? []),
    ]);
    const rightFactors = factorIds([
        inheritance.right_blue_factors,
        inheritance.right_pink_factors,
        inheritance.right_green_factors,
        ...(inheritance.right_white_factors ?? []),
    ]);

    return {
        trained_chara_id: inheritance.inheritance_id,
        use_type: 0,
        card_id: inheritance.main_parent_id,
        name: null,
        fans: 0,
        rank_score: numberOrZero(inheritance.parent_rank),
        rank: numberOrZero(inheritance.parent_rarity),
        succession_num: 0,
        is_locked: 0,
        rarity: numberOrZero(inheritance.parent_rarity),
        talent_level: 0,
        chara_grade: 0,
        running_style: 0,
        nickname_id: 0,
        wins: numberOrZero(inheritance.win_count),
        speed: 0,
        stamina: 0,
        power: 0,
        guts: 0,
        wiz: 0,
        proper_distance_short: 0,
        proper_distance_mile: 0,
        proper_distance_middle: 0,
        proper_distance_long: 0,
        proper_ground_turf: 0,
        proper_ground_dirt: 0,
        proper_running_style_nige: 0,
        proper_running_style_senko: 0,
        proper_running_style_sashi: 0,
        proper_running_style_oikomi: 0,
        skill_array: [],
        support_card_list: [],
        is_saved: 0,
        race_result_list: [],
        win_saddle_id_array: inheritance.main_win_saddles ?? [],
        nickname_id_array: [],
        factor_id_array: mainFactors,
        factor_info_array: factorInfoArray(mainFactors),
        succession_chara_array: [
            makeSuccessionEntry(10, inheritance.parent_left_id, leftFactors, inheritance.left_win_saddles ?? []),
            makeSuccessionEntry(20, inheritance.parent_right_id, rightFactors, inheritance.right_win_saddles ?? []),
        ],
        succession_history_array: [],
        scenario_id: numberOrZero(inheritance.scenario_id),
        create_time: item.last_updated ?? "",
        uma_moe_account_id: item.account_id,
        uma_moe_trainer_name: item.trainer_name,
    };
};

export type UmaMoeSearchFilters = {
    blues: BaseFilter[];
    aptitude: BaseFilter[];
    uniques: BaseFilter[];
    races: BaseFilter[];
    skills: BaseFilter[];
};

const getFactorPresetKey = (category: number, name: string): number | null => {
    const textData = UMDatabaseWrapper.textData[147] ?? {};
    let bestKey: number | null = null;

    for (const [indexText, text] of Object.entries(textData)) {
        const factorId = Number(indexText);
        if (!Number.isFinite(factorId) || getFactorCategory(factorId) !== category || text.text !== name) {
            continue;
        }

        const key = Math.floor(factorId / 100);
        if (bestKey === null || key < bestKey) bestKey = key;
    }

    return bestKey;
};

const buildFilterFactorIds = (category: number, filters: BaseFilter[]): string[] => {
    if (filters.length === 0) return [];

    const maxStars = category === 1 ? 3 : 9;
    const ids: string[] = [];

    for (const filter of filters) {
        const starOptions = getFilterStarOptions(filter);
        const stars = starOptions.length > 1
            ? starOptions
            : starOptions.length === 1
                ? Array.from({ length: Math.max(0, maxStars - starOptions[0] + 1) }, (_, index) => starOptions[0] + index)
                : Array.from({ length: maxStars }, (_, index) => index + 1);

        for (const stat of getFilterStats(filter)) {
            const presetKey = getFactorPresetKey(category, stat);
            if (presetKey === null) continue;

            for (const star of stars) {
                if (star >= 1 && star <= maxStars) {
                    ids.push(String(presetKey * 100 + star));
                }
            }
        }
    }

    return ids;
};

const appendFilterParams = (
    params: URLSearchParams,
    filters: BaseFilter[],
    category: number,
    totalParam: string,
    mainParentParam: string,
) => {
    for (const filter of filters) {
        const ids = buildFilterFactorIds(category, [filter]);
        if (ids.length === 0) continue;

        params.append(filter.type === "Legacy" ? mainParentParam : totalParam, ids.join(","));
    }
};

const getPreferredWhiteSparks = (
    config: CustomScoringConfig,
): Array<{ presetKey: number; priority: number }> => {
    const styleWeights = config.skillSparkWeights[config.skillSparkStyle] ?? {};

    return Object.entries(styleWeights)
        .map(([key, weights]) => ({
            presetKey: Number(key),
            priority: Math.max(0, Math.round(weights[2] ?? 0)),
        }))
        .filter(entry => Number.isFinite(entry.presetKey) && entry.presetKey > 0 && entry.priority > 0)
        .sort((a, b) => b.priority - a.priority);
};

const getParentCardIds = (characterIds: number[]): number[] => {
    if (characterIds.length === 0) return [];

    const selectedCharacters = new Set(characterIds);
    return Object.values(UMDatabaseWrapper.cards)
        .map(card => card.id)
        .filter((cardId): cardId is number =>
            Number.isFinite(cardId) && selectedCharacters.has(Math.floor(Number(cardId) / 100))
        );
};

const getPresetDistancePinkSparks = (config: CustomScoringConfig): number[] => {
    if (config.pinkPreset === "custom") return [];

    const preset = PINK_PRESETS.find(item => item.key === config.pinkPreset);
    if (!preset) return [];

    const distanceKey = Number(preset.distanceKey);
    if (!Number.isFinite(distanceKey)) return [];

    return Array.from({ length: 9 }, (_, index) => distanceKey * 100 + index + 1);
};

export const buildUmaMoeSearchParams = (
    config: CustomScoringConfig,
    parentCharaIds: number[],
    filters: UmaMoeSearchFilters,
    page = 0,
): URLSearchParams => {
    const params = new URLSearchParams();
    params.set("search_type", "inheritance");
    params.set("page", String(page));
    params.set("limit", "100");
    params.set("max_follower_num", "999");

    const parentCardIds = getParentCardIds(parentCharaIds);
    if (parentCardIds.length > 0) {
        params.set("main_parent_id", parentCardIds.join(","));
    }

    const preferredWhiteSparks = getPreferredWhiteSparks(config);
    if (preferredWhiteSparks.length > 0) {
        params.set("lineage_white", preferredWhiteSparks.map(entry => entry.presetKey).join(","));
        params.set(
            "lineage_white_priorities",
            preferredWhiteSparks.map(entry => `${entry.presetKey}:${entry.priority}`).join(","),
        );
    }

    const distantPinkSparks = getPresetDistancePinkSparks(config);
    if (distantPinkSparks.length > 0) {
        params.set("pink_sparks", distantPinkSparks.join(","));
    }

    appendFilterParams(params, filters.blues, 1, "blue_sparks", "main_parent_blue_sparks");
    appendFilterParams(params, filters.aptitude, 2, "pink_sparks", "main_parent_pink_sparks");
    appendFilterParams(params, filters.uniques, 3, "green_sparks", "main_parent_green_sparks");
    appendFilterParams(params, filters.races, 4, "white_sparks", "main_parent_white_sparks");
    appendFilterParams(params, filters.skills, 5, "white_sparks", "main_parent_white_sparks");

    return params;
};

export const searchUmaMoeVeterans = async (
    config: CustomScoringConfig,
    parentCharaIds: number[],
    filters: UmaMoeSearchFilters,
    page = 0,
    apiKey = "",
): Promise<UmaMoeSearchResult> => {
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
        throw new Error("Missing uma.moe API key. Add it in the Settings tab.");
    }

    const params = buildUmaMoeSearchParams(config, parentCharaIds, filters, page);
    const response = await fetch(`${UMA_MOE_API_BASE}/api/v3/search?${params.toString()}`, {
        headers: {
            "X-API-Key": trimmedApiKey,
        },
    });

    if (!response.ok) {
        throw new Error(`uma.moe search failed (${response.status} ${response.statusText}).`);
    }

    const payload = await response.json() as UmaMoeSearchResponse;
    return {
        veterans: (payload.items ?? []).map(mapSearchItem),
        total: payload.total,
        page: payload.page,
        limit: payload.limit,
        totalPages: payload.total_pages,
    };
};
