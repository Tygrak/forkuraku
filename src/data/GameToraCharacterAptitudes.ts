import gametoraCardAptitudes from "./gametoraCardAptitudes.json";
import gametoraCharacterAptitudes from "./gametoraCharacterAptitudes.json";

export type AptitudeGrade = "G" | "F" | "E" | "D" | "C" | "B" | "A" | "S";

// GameTora stores the ten grades in the same order as the UI:
// turf, dirt, sprint, mile, medium, long, front, pace, late, end.
const aptitudesByCard = gametoraCardAptitudes as Record<string, AptitudeGrade[]>;
const aptitudesByCharacter = gametoraCharacterAptitudes as Record<string, AptitudeGrade[]>;

export const getCharacterBaseAptitudes = (characterId: number): AptitudeGrade[] | null =>
    aptitudesByCharacter[String(characterId)] ?? null;

export const getCardBaseAptitudes = (cardId: number): AptitudeGrade[] | null =>
    aptitudesByCard[String(cardId)] ?? getCharacterBaseAptitudes(Math.floor(cardId / 100));
