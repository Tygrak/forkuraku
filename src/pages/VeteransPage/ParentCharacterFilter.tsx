import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import AssetLoader from "../../data/AssetLoader";
import UMDatabaseWrapper from "../../data/UMDatabaseWrapper";
import { Veteran } from "./types";
import "./VeteransPage.css";

interface ParentCharacterFilterProps {
    veterans: Veteran[];
    selected: number[];
    onChange: (characterIds: number[]) => void;
    includeAllCharacters?: boolean;
}

type CharacterOption = {
    id: number;
    name: string;
    count: number;
};

const ParentCharacterFilter: React.FC<ParentCharacterFilterProps> = ({
    veterans,
    selected,
    onChange,
    includeAllCharacters = false,
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

        for (const veteran of veterans) {
            const id = Math.floor(veteran.card_id / 100);
            const existing = byId.get(id);
            if (existing) {
                existing.count += 1;
            } else {
                byId.set(id, {
                    id,
                    name: UMDatabaseWrapper.charas[id]?.name ?? `Character ${id}`,
                    count: 1,
                });
            }
        }

        if (includeAllCharacters) {
            for (const chara of Object.values(UMDatabaseWrapper.charas)) {
                const id = chara.id;
                if (id == null || byId.has(id) || !UMDatabaseWrapper.charaRelationTypes[id]) continue;

                byId.set(id, {
                    id,
                    name: chara.name ?? `Character ${id}`,
                    count: 0,
                });
            }
        }

        return Array.from(byId.values()).sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.name.localeCompare(b.name);
        });
    }, [veterans, includeAllCharacters]);

    const filteredOptions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return options;

        return options.filter(option => option.name.toLowerCase().includes(query));
    }, [options, search]);

    const selectedNames = useMemo(
        () => selected.map(id => UMDatabaseWrapper.charas[id]?.name ?? `Character ${id}`),
        [selected],
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
                    Parent characters{selected.length > 0 ? ` (${selected.length})` : ""}
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
                    <Modal.Title>Select parent characters</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Control
                        size="sm"
                        placeholder="Search characters..."
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
                                        src={AssetLoader.getCharaIcon(option.id)}
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
                            <div className="text-muted">No characters found.</div>
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
