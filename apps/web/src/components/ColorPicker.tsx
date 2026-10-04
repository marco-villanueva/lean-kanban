import { COLORS, DEFAULT_COLUMN_COLOR } from "../api";

export default function ColorPicker({
  value,
  allowNone = false,
  defaultColor = DEFAULT_COLUMN_COLOR,
  onChange,
  label = "Color",
}: {
  value: string | null;
  allowNone?: boolean;
  defaultColor?: string;
  onChange: (color: string | null) => void | Promise<void>;
  label?: string;
}) {
  const current = value ?? defaultColor;

  return (
    <div>
      <div className="color-pick" role="group" aria-label={label}>
        {allowNone && (
          <button
            type="button"
            className={`color-none${value === null ? " sel" : ""}`}
            onClick={() => void onChange(null)}
            aria-label="No color"
            title="None"
          >
            ∅
          </button>
        )}
        {COLORS.map((color) => (
          <button
            type="button"
            key={color}
            style={{ background: color }}
            className={value === color ? "sel" : ""}
            onClick={() => void onChange(color)}
            aria-label={`Color ${color}`}
            title={color}
          />
        ))}
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <input
          type="color"
          value={current}
          onChange={(event) => void onChange(event.target.value)}
          aria-label={`Custom ${label.toLowerCase()}`}
        />
        {allowNone ? (
          <span className="muted">{value ?? "None"}</span>
        ) : (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void onChange(defaultColor)}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
