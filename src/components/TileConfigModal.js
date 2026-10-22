"use client";

import { useMemo, useState } from "react";
import { WIDGETS } from "./widgets/registry";
import { useProxmox } from "./DashContext";
import { Button, Field, Modal, Select, inputClass } from "./ui";

function timeZones() {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Asia/Tokyo",
    ];
  }
}

// Lists the cluster's nodes; keeps a saved node selectable even if it's offline
// or the API is unreachable right now.
function NodeSelect({ value, onChange, emptyLabel }) {
  const { data } = useProxmox();
  const names = (data?.nodes ?? []).map((n) => n.name);
  if (value && !names.includes(value)) names.push(value);
  return (
    <Select
      value={value ?? ""}
      onChange={onChange}
      options={[{ value: "", label: emptyLabel ?? "Any" }, ...names.map((n) => ({ value: n, label: n }))]}
    />
  );
}

export default function TileConfigModal({ tile, services, onClose, onSave }) {
  const def = tile ? WIDGETS[tile.type] : null;
  const [draft, setDraft] = useState(() => ({ ...(tile?.config ?? {}) }));
  const zones = useMemo(() => timeZones(), []);

  if (!tile || !def) return null;
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      title={`${def.name} settings`}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(tile.id, draft)}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(tile.id, draft);
        }}
      >
        {def.fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.type === "text" && (
              <input
                value={draft[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className={inputClass}
              />
            )}
            {f.type === "select" && (
              <Select value={draft[f.key] ?? f.options[0].value} onChange={(v) => set(f.key, v)} options={f.options} />
            )}
            {f.type === "service" && (
              <Select
                value={draft[f.key] ?? ""}
                onChange={(v) => set(f.key, v)}
                options={services.map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
            {f.type === "pveNode" && (
              <NodeSelect value={draft[f.key]} onChange={(v) => set(f.key, v)} emptyLabel={f.emptyLabel} />
            )}
            {f.type === "timezone" && (
              <Select
                value={draft[f.key] ?? ""}
                onChange={(v) => set(f.key, v)}
                options={[
                  { value: "", label: "Local time" },
                  ...zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") })),
                ]}
              />
            )}
          </Field>
        ))}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
