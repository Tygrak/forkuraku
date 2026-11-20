import { useEffect, useMemo, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import AssetLoader from "../../data/AssetLoader";
import { getTargetCardOptions, TargetCardOption } from "./targetOptions";
import "./VeteransPage.css";

type TargetUmaPickerProps = {
    selected: number | null;
    onChange: (cardId: number | null) => void;
    placeholder?: string;
    title?: string;
    id?: string;
};

const TargetUmaPicker = ({
    selected,
    onChange,
    placeholder = "Select target Uma...",
    title = "Select target Uma",
    id,
}: TargetUmaPickerProps) => {
    const [show, setShow] = useState(false);
    const [search, setSearch] = useState("");
    const [draft, setDraft] = useState<number | null>(selected);

    const options = useMemo<TargetCardOption[]>(() => getTargetCardOptions(), []);
    const selectedOption = options.find(option => option.id === selected);

    useEffect(() => {
        if (show) {
            setDraft(selected);
            setSearch("");
        }
    }, [show, selected]);

    const filteredOptions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return options;

        return options.filter(option =>
            option.charaName.toLowerCase().includes(query)
            || option.cardName.toLowerCase().includes(query),
        );
    }, [options, search]);

    const apply = () => {
        onChange(draft);
        setShow(false);
    };

    return (
        <>
            <button
                id={id}
                type="button"
                className="target-uma-trigger"
                onClick={() => setShow(true)}
                aria-haspopup="dialog"
            >
                {selectedOption ? (
                    <>
                        <img
                            className="target-uma-trigger-img"
                            src={AssetLoader.getCharaThumb(selectedOption.id)}
                            alt=""
                            onError={event => { (event.currentTarget as HTMLImageElement).style.opacity = "0"; }}
                        />
                        <span className="target-uma-trigger-text">
                            <span className="target-uma-trigger-name">{selectedOption.charaName}</span>
                            <span className="target-uma-trigger-card">{selectedOption.cardName}</span>
                        </span>
                    </>
                ) : (
                    <span className="target-uma-placeholder">{placeholder}</span>
                )}
                <span className="target-uma-caret" aria-hidden="true">{"\u25BE"}</span>
            </button>

            <Modal show={show} onHide={() => setShow(false)} size="lg" scrollable>
                <Modal.Header closeButton>
                    <Modal.Title>{title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Control
                        size="sm"
                        placeholder="Search characters or costumes..."
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        className="mb-3"
                        autoFocus
                    />
                    <div className="vet-parent-grid">
                        {filteredOptions.map(option => {
                            const isSelected = draft === option.id;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`vet-parent-option${isSelected ? " selected" : ""}`}
                                    onClick={() => setDraft(option.id)}
                                >
                                    <img
                                        src={AssetLoader.getCharaThumb(option.id)}
                                        alt=""
                                        onError={event => { (event.currentTarget as HTMLImageElement).style.opacity = "0"; }}
                                    />
                                    <span className="vet-parent-option-text">
                                        <span className="vet-parent-option-name">{option.charaName}</span>
                                        <span className="vet-parent-option-count">{option.cardName}</span>
                                    </span>
                                </button>
                            );
                        })}
                        {filteredOptions.length === 0 && (
                            <div className="text-muted">No characters or costumes found.</div>
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={() => setDraft(null)}>
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

export default TargetUmaPicker;
