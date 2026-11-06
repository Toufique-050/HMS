import {
    useEffect,
    useRef,
    useState
} from "react";

import http, {
    errorMessage
} from "../api/http.js";

const MAX_BYTES = 5 * 1024 * 1024;

const TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

export default function ImageUploadField({
    value = [],
    onChange,
    kind,
    disabled = false,
    onBusyChange
}) {
    const images = Array.isArray(value)
        ? value
        : [];

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [progress, setProgress] = useState("");

    const lock = useRef(false);
    const mounted = useRef(true);
    const controller = useRef(null);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
            controller.current?.abort();
        };
    }, []);

    async function choose(event) {
        const files = Array.from(
            event.target.files || []
        );

        event.target.value = "";

        if (
            !files.length ||
            lock.current ||
            disabled
        ) {
            return;
        }

        setError("");

        if (images.length + files.length > 10) {
            setError(
                "You can keep a maximum of 10 photos. Remove an existing photo first."
            );
            return;
        }

        if (
            files.some(file =>
                !TYPES.has(file.type) ||
                file.size > MAX_BYTES
            )
        ) {
            setError(
                "Choose JPG, PNG or WebP images, each up to 5 MB."
            );
            return;
        }

        lock.current = true;
        setBusy(true);
        onBusyChange?.(true);

        controller.current =
            new AbortController();

        const added = [];

        try {
            for (
                let index = 0;
                index < files.length;
                index++
            ) {
                setProgress(
                    `Uploading ${index + 1} of ${files.length}…`
                );

                const body = new FormData();

                body.append(
                    "image",
                    files[index]
                );

                const { data } = await http.post(
                    `/uploads/images/${kind}`,
                    body,
                    {
                        signal:
                            controller.current.signal,

                        timeout: 90000
                    }
                );

                if (!data.image?.url) {
                    throw new Error(
                        "Invalid upload response"
                    );
                }

                added.push(data.image.url);
            }
        } catch (caught) {
            if (mounted.current) {
                setError(errorMessage(caught));
            }
        } finally {
            lock.current = false;

            if (mounted.current) {
                if (added.length) {
                    onChange([
                        ...images,
                        ...added
                    ]);
                }

                setBusy(false);
                setProgress("");
                onBusyChange?.(false);
            }
        }
    }

    return (
        <div className="lsa-image-uploader">
            <input
                type="file"
                aria-label="Choose photos"
                accept="image/jpeg,image/png,image/webp"
                multiple

                disabled={
                    disabled ||
                    busy ||
                    images.length >= 10
                }

                onChange={choose}
            />

            <p className="lsa-hint">
                JPG, PNG or WebP · Up to 5 MB each ·
                Maximum 10 photos. Save the form to
                apply your gallery changes.
            </p>

            {busy && (
                <p role="status">{progress}</p>
            )}

            {error && (
                <p
                    className="lsa-error"
                    role="alert"
                >
                    {error}
                </p>
            )}

            <div className="lsa-image-grid">
                {images.map((url, index) => (
                    <div
                        className="lsa-image-item"
                        key={`${url}-${index}`}
                    >
                        <img
                            src={url}
                            alt={`Gallery photo ${index + 1}`}
                            loading="lazy"
                        />

                        <span>
                            {index === 0
                                ? "Cover photo"
                                : `Photo ${index + 1}`}
                        </span>

                        <div className="lsa-image-actions">
                            <button
                                type="button"

                                disabled={
                                    disabled ||
                                    busy ||
                                    index === 0
                                }

                                onClick={() =>
                                    onChange([
                                        url,

                                        ...images.filter(
                                            (_, i) =>
                                                i !== index
                                        )
                                    ])
                                }
                            >
                                Set cover
                            </button>

                            <button
                                type="button"
                                disabled={disabled || busy}

                                onClick={() =>
                                    onChange(
                                        images.filter(
                                            (_, i) =>
                                                i !== index
                                        )
                                    )
                                }
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}