import { Button, Form, InputGroup } from "react-bootstrap";

type Props = {
    value: string;
    onChange: (value: string) => void;
};

const UmaMoeApiKeyInput = ({ value, onChange }: Props) => (
    <div className="uma-moe-key-input">
        <span className="uma-moe-key-label">uma.moe API key</span>
        <InputGroup size="sm">
            <Form.Control
                type="password"
                value={value}
                placeholder="Paste your uma.moe API key..."
                autoComplete="off"
                aria-label="uma.moe API key"
                onChange={event => onChange(event.target.value)}
            />
            <Button
                variant="outline-secondary"
                disabled={!value}
                onClick={() => onChange("")}
            >
                Clear
            </Button>
        </InputGroup>
        <p className="best-combo-hint">Saved in this browser only.</p>
    </div>
);

export default UmaMoeApiKeyInput;
