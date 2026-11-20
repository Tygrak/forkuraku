import UMDatabaseWrapper from "../../data/UMDatabaseWrapper";
import { isPlayableCharacter } from "../../data/GameToraCharacterSkills";

export const LAST_TARGET_UMA_KEY = "forkuraku.veterans.lastTargetUma";

export type TargetCardOption = {
    id: number;
    charaId: number;
    charaName: string;
    cardName: string;
};

export const loadLastTargetUma = (): number | null => {
    if (typeof localStorage === "undefined") return null;

    try {
        const raw = localStorage.getItem(LAST_TARGET_UMA_KEY);
        if (!raw) return null;

        const storedId = Number(raw);
        if (!Number.isInteger(storedId) || storedId <= 0) return null;

        // New format: a card (costume) ID.
        const storedCharaId = Math.floor(storedId / 100);
        if (
            UMDatabaseWrapper.cards[storedId]
            && UMDatabaseWrapper.charas[storedCharaId]?.name
            && isPlayableCharacter(storedCharaId)
        ) {
            return storedId;
        }

        // Old format: a character ID. Select that character's first costume.
        if (!UMDatabaseWrapper.charas[storedId]?.name) return null;
        const card = Object.values(UMDatabaseWrapper.cards)
            .filter(candidate => candidate.id !== undefined && Math.floor(candidate.id / 100) === storedId)
            .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))[0];

        return card?.id ?? null;
    } catch {
        return null;
    }
};

export const getTargetCardOptions = (): TargetCardOption[] => {
    return Object.values(UMDatabaseWrapper.cards)
        .filter(card => card.id !== undefined && !!card.name)
        .map(card => {
            const charaId = Math.floor(card.id! / 100);
            const chara = UMDatabaseWrapper.charas[charaId];
            if (!chara?.name || !isPlayableCharacter(charaId)) return null;

            return {
                id: card.id!,
                charaId,
                charaName: chara.name,
                cardName: card.name ?? "",
            };
        })
        .filter((option): option is TargetCardOption => option !== null)
        .sort((a, b) => a.charaName.localeCompare(b.charaName) || a.id - b.id);
};
