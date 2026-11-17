import UMDatabaseWrapper from "../../data/UMDatabaseWrapper";
import { getFactorCategory } from "../../data/VeteransHelper";
import AssetLoader from "../../data/AssetLoader";

export const getCharaImageUrl = (cardId: number): string => {
    return AssetLoader.getCharaThumb(cardId) ?? "";
};

export const getCardName = (cardId: number): string => {
    const textData = UMDatabaseWrapper.getTextData(4, cardId);
    if (textData?.text && textData.category === 4) {
        return textData.text;
    }
    return `Card ${cardId}`;
};

export const formatCardName = (cardName: string): string => {
    const match = cardName.match(/^\[.*?\]\s*(.*)$/);
    return match ? match[1] : cardName;
};

const RANK_GRADE_LABELS: Record<number, string> = {
    1: "G",
    2: "F",
    3: "F+",
    4: "E",
    5: "E+",
    6: "D",
    7: "D+",
    8: "C",
    9: "C+",
    10: "B",
    11: "B+",
    12: "A",
    13: "A+",
    14: "S",
    15: "S+",
    16: "SS",
    17: "SS+",
    18: "UG",
};

export const getRankGradeLabel = (rankId: number): string => {
    if (!Number.isFinite(rankId) || rankId <= 0) return "—";
    if (rankId >= 19) return `UG${rankId - 18}`;
    return RANK_GRADE_LABELS[rankId] ?? `Rank ${rankId}`;
};

export const getFactorColor = (factorId: number, config: any): string => {
    const category = getFactorCategory(factorId);
    switch (category) {
        case 1: return config.blues.color;
        case 2: return config.aptitude.color;
        case 3: return config.uniques.color;
        case 4: return config.races.color;
        case 5: return 'white'; 
        default: return 'inherit';
    }
};