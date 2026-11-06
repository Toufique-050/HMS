import ImageUploadField from "./ImageUploadField.jsx";

export default function AdminFields({
    fields,
    form,
    editing,
    busy,
    options,
    onChange,
    kind,
    onBusyChange
}) {
    return (
        <div className="lsa-form-grid">
            {fields
                .filter(field =>
                    !(editing && field.createOnly)
                )
                .map(field => {
                    const inputId =
                        `lsa-field-${field.key}`;

                    if (field.type === "images") {
                        return (
                            <div
                                key={field.key}
                                className="lsa-wide"
                            >
                                <p className="lsa-image-heading">
                                    {field.label}
                                </p>

                                <ImageUploadField
                                    value={form[field.key]}
                                    kind={kind}
                                    disabled={busy}

                                    onBusyChange={
                                        onBusyChange
                                    }

                                    onChange={value =>
                                        onChange(
                                            field.key,
                                            value
                                        )
                                    }
                                />
                            </div>
                        );
                    }

                    return (
                        <label
                            key={field.key}
                            htmlFor={inputId}

                            className={
                                ["textarea", "list"].includes(
                                    field.type
                                )
                                    ? "lsa-wide"
                                    : ""
                            }
                        >
                            {field.label}

                            {!field.optional &&
                                !["checkbox", "list"].includes(
                                    field.type
                                )
                                ? " *"
                                : ""}

                            {field.type === "select" ? (
                                <select
                                    id={inputId}
                                    required={!field.optional}

                                    disabled={
                                        busy ||
                                        (
                                            editing &&
                                            field.immutable
                                        )
                                    }

                                    value={
                                        form[field.key] ?? ""
                                    }

                                    onChange={event =>
                                        onChange(
                                            field.key,
                                            event.target.value
                                        )
                                    }
                                >
                                    <option value="">
                                        {field.optional
                                            ? "None / walk-in"
                                            : "Choose…"}
                                    </option>

                                    {options(field).map(
                                        ([key, title]) => (
                                            <option
                                                key={key}
                                                value={key}
                                            >
                                                {title}
                                            </option>
                                        )
                                    )}
                                </select>
                            ) : ["textarea", "list"].includes(
                                field.type
                            ) ? (
                                <textarea
                                    id={inputId}
                                    rows={4}
                                    disabled={busy}

                                    required={
                                        !field.optional &&
                                        field.type !== "list"
                                    }

                                    value={
                                        form[field.key] ?? ""
                                    }

                                    onChange={event =>
                                        onChange(
                                            field.key,
                                            event.target.value
                                        )
                                    }
                                />
                            ) : field.type === "checkbox" ? (
                                <input
                                    id={inputId}
                                    type="checkbox"
                                    disabled={busy}

                                    checked={
                                        !!form[field.key]
                                    }

                                    onChange={event =>
                                        onChange(
                                            field.key,
                                            event.target.checked
                                        )
                                    }
                                />
                            ) : (
                                <input
                                    id={inputId}
                                    type={field.type}
                                    disabled={busy}
                                    required={!field.optional}

                                    min={field.min}
                                    max={field.max}

                                    step={
                                        field.step ||
                                        (
                                            field.type === "number"
                                                ? "0.01"
                                                : undefined
                                        )
                                    }

                                    minLength={
                                        field.type === "password"
                                            ? 12
                                            : undefined
                                    }

                                    maxLength={
                                        field.type === "password"
                                            ? 72
                                            : undefined
                                    }

                                    autoComplete={
                                        field.type === "password"
                                            ? "new-password"
                                            : undefined
                                    }

                                    value={
                                        form[field.key] ?? ""
                                    }

                                    onChange={event =>
                                        onChange(
                                            field.key,
                                            event.target.value
                                        )
                                    }
                                />
                            )}
                        </label>
                    );
                })}
        </div>
    );
}