import { useEffect, useState } from "react";
import http, { errorMessage } from "../api/http.js";

export default function usePublic(path, params = {}) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== "" && value != null) {
            query.set(key, String(value));
        }
    });

    const url =
        `/public${path}` +
        (query.size ? `?${query}` : "");

    const [version, setVersion] = useState(0);

    const requestKey = `${url}|${version}`;

    const [state, setState] = useState({
        key: "",
        data: null,
        error: "",
        loading: true
    });

    useEffect(() => {
        const controller = new AbortController();

        setState({
            key: requestKey,
            data: null,
            error: "",
            loading: true
        });

        http.get(url, {
            signal: controller.signal
        })
            .then(response => {
                if (controller.signal.aborted) return;

                setState({
                    key: requestKey,
                    data: response.data,
                    error: "",
                    loading: false
                });
            })
            .catch(error => {
                if (controller.signal.aborted) return;

                setState({
                    key: requestKey,
                    data: null,
                    error: errorMessage(error),
                    loading: false
                });
            });

        return () => controller.abort();
    }, [url, requestKey]);

    const current = state.key === requestKey;

    return {
        data: current ? state.data : null,
        error: current ? state.error : "",
        loading: !current || state.loading,
        reload: () => setVersion(value => value + 1)
    };
}