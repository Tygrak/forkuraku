import gametoraCharacterSkills from "./gametoraCharacterSkills.json";
import UMDatabaseWrapper from "./UMDatabaseWrapper";

const skillsByCharacter = gametoraCharacterSkills as Record<string, string[]>;
const skillSetCache = new Map<number, Set<string>>();
let playableCharaIds: Set<number> | null = null;

export const getGuaranteedCharacterSkills = (characterId: number): Set<string> => {
    const cached = skillSetCache.get(characterId);
    if (cached) return cached;

    const skills = new Set(skillsByCharacter[String(characterId)] ?? []);
    skillSetCache.set(characterId, skills);
    return skills;
};

export const isPlayableCharacter = (characterId: number): boolean => {
    if (!playableCharaIds || playableCharaIds.size === 0) {
        playableCharaIds = new Set<number>();
        for (const card of Object.values(UMDatabaseWrapper.cards)) {
            if (card.id != null) {
                playableCharaIds.add(Math.floor(card.id / 100));
            }
        }
    }

    return playableCharaIds.has(characterId);
};
