import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import AssetLoader from "../../data/AssetLoader";
import UMDatabaseWrapper from "../../data/UMDatabaseWrapper";
import { isPlayableCharacter } from "../../data/GameToraCharacterSkills";
import { Veteran } from "./types";
import "./VeteransPage.css";

type SelectionMode = "character" | "card";

interface ParentCharacterFilterProps {
    veterans: Veteran[];
    selected: number[];
    onChange: (ids: number[]) => void;
    includeAllCharacters?: boolean;
    selectionMode?: SelectionMode;
    label?: string;
    title?: string;
    excludedIds?: number[];
    excludedCharaIds?: number[];
}

type CharacterOption = {
    id: number;
    charaId: number;
    name: string;
    count: number;
};

const EMPTY_IDS: number[] = [];

const getCardLabel = (cardId: number): string => {
    const charaId = Math.floor(cardId / 100);
    const charaName = UMDatabaseWrapper.charas[charaId]?.name;
    const cardName = UMDatabaseWrapper.cards[cardId]?.name;
    return charaName && cardName ? `${charaName} — ${cardName}` : `Card ${cardId}`;
};

const ParentCharacterFilter: React.FC<ParentCharacterFilterProps> = ({
    veterans,
    selected,
    onChange,
    includeAllCharacters = false,
    selectionMode = "character",
    label = "Parent characters",
    title = "Select parent characters",
    excludedIds = EMPTY_IDS,
    excludedCharaIds = EMPTY_IDS,
}) => {
    const [show, setShow] = useState(false);
    const [search, setSearch] = useState("");
    const [draft, setDraft] = useState<number[]>(selected);

    useEffect(() => {
        if (show) {
            setDraft(selected);
            setSearch("");
        }
    }, [show, selected]);

    const options = useMemo(() => {
        const byId = new Map<number, CharacterOption>();

        if (selectionMode === "card") {
            for (const veteran of veterans) {
                const cardId = veteran.card_id;
                const existing = byId.get(cardId);
                if (existing) {
                    existing.count += 1;
                    continue;
                }

                const charaId = Math.floor(cardId / 100);
                const charaName = UMDatabaseWrapper.charas[charaId]?.name;
                const cardName = UMDatabaseWrapper.cards[cardId]?.name;
                if (!charaName || !cardName) continue;

                byId.set(cardId, {
                    id: cardId,
                    charaId,
                    name: `${charaName} — ${cardName}`,
                    count: 1,
                });
            }

            if (includeAllCharacters) {
                for (const card of Object.values(UMDatabaseWrapper.cards)) {
                    const cardId = card.id;
                    if (cardId == null || byId.has(cardId) || !card.name) continue;

                    const charaId = Math.floor(cardId / 100);
                    const charaName = UMDatabaseWrapper.charas[charaId]?.name;
                    if (!charaName || !isPlayableCharacter(charaId)) continue;

                    byId.set(cardId, {
                        id: cardId,
                        charaId,
                        name: `${charaName} — ${card.name}`,
                        count: 0,
                    });
                }
            }
        } else {
            for (const veteran of veterans) {
                const id = Math.floor(veteran.card_id / 100);
                const existing = byId.get(id);
                if (existing) {
                    existing.count += 1;
                } else {
                    byId.set(id, {
                        id,
                        charaId: id,
                        name: UMDatabaseWrapper.charas[id]?.name ?? `Character ${id}`,
                        count: 1,
                    });
                }
            }

            if (includeAllCharacters) {
                for (const chara of Object.values(UMDatabaseWrapper.charas)) {
                    const id = chara.id;
                    if (id == null || byId.has(id) || !chara.name || !isPlayableCharacter(id)) continue;

                    byId.set(id, {
                        id,
                        charaId: id,
                        name: chara.name,
                        count: 0,
                    });
                }
            }
        }

        const excludedCharaSet = new Set(excludedCharaIds);
        if (selectionMode === "card") {
            // The game cannot use two costumes of the same character as the two
            // parents, so exclude the whole character when a costume is picked.
            for (const id of excludedIds) {
                excludedCharaSet.add(Math.floor(id / 100));
            }
        }

        return Array.from(byId.values())
            .filter(option =>
                !excludedIds.includes(option.id)
                && !excludedCharaSet.has(option.charaId),
            )
            .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                return a.name.localeCompare(b.name);
            });
    }, [veterans, includeAllCharacters, selectionMode, excludedIds, excludedCharaIds]);

    const filteredOptions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return options;

        return options.filter(option => option.name.toLowerCase().includes(query));
    }, [options, search]);

    const selectedNames = useMemo(
        () => selected.map(id => selectionMode === "card"
            ? getCardLabel(id)
            : UMDatabaseWrapper.charas[id]?.name ?? `Character ${id}`),
        [selected, selectionMode],
    );

    const toggleCharacter = (id: number) => {
        setDraft(current => current.includes(id)
            ? current.filter(value => value !== id)
            : [...current, id]);
    };

    const apply = () => {
        onChange(draft);
        setShow(false);
    };

    return (
        <>
            <div className="vet-parent-filter">
                <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setShow(true)}
                >
                    {label}{selected.length > 0 ? ` (${selected.length})` : ""}
                </Button>
                {selected.length > 0 && (
                    <div className="vet-parent-chips">
                        {selected.map((id, index) => (
                            <button
                                key={id}
                                type="button"
                                className="vet-parent-chip"
                                title={`Remove ${selectedNames[index]}`}
                                onClick={() => onChange(selected.filter(value => value !== id))}
                            >
                                <span>{selectedNames[index]}</span>
                                <span aria-hidden="true">{"\u00D7"}</span>
                            </button>
                        ))}
                        <Button
                            variant="link"
                            size="sm"
                            className="vet-parent-clear"
                            onClick={() => onChange([])}
                        >
                            Clear
                        </Button>
                    </div>
                )}
            </div>

            <Modal show={show} onHide={() => setShow(false)} size="lg" scrollable>
                <Modal.Header closeButton>
                    <Modal.Title>{title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Control
                        size="sm"
                        placeholder={selectionMode === "card" ? "Search characters or costumes..." : "Search characters..."}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="mb-3"
                        autoFocus
                    />
                    <div className="vet-parent-grid">
                        {filteredOptions.map(option => {
                            const isSelected = draft.includes(option.id);
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`vet-parent-option${isSelected ? " selected" : ""}`}
                                    onClick={() => toggleCharacter(option.id)}
                                >
                                    <img
                                        src={selectionMode === "card"
                                            ? AssetLoader.getCharaThumb(option.id)
                                            : AssetLoader.getCharaIcon(option.id)}
                                        alt=""
                                        onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0"; }}
                                    />
                                    <span className="vet-parent-option-text">
                                        <span className="vet-parent-option-name">{option.name}</span>
                                        <span className="vet-parent-option-count">
                                            {option.count} veteran{option.count === 1 ? "" : "s"}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                        {filteredOptions.length === 0 && (
                            <div className="text-muted">
                                {selectionMode === "card" ? "No costumes found." : "No characters found."}
                            </div>
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={() => setDraft([])}>
                        Clear
                    </Button>
                    <Button variant="secondary" onClick={() => setShow(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={apply}>
                        Apply
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default ParentCharacterFilter;
