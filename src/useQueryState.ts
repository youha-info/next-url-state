import { useBatchRouter } from "next-batch-router";
import { useRouter } from "next/router";
import React from "react";
import { HistoryOptions, NextQueryValue, Serializers, TransitionOptions } from "./defs";
import { defaultSerializer } from "./utils";

export interface UseQueryStateOptions<T> extends Serializers<T> {
    /**
     * The operation to use on state updates. Defaults to `replace`.
     */
    history?: HistoryOptions;
    /**
     * Sets if parse and serialize functions can be changed in runtime.
     * Parse and serialize functions must not be changed unless dynamic is set to true.
     * Defaults to false.
     *
     * If set to true, referential equality of the functions must be managed via useCallback or by other means.
     * Value and updater functions are dependent on them, and only the recent updater function must be used.
     * Stale updater functions use previously supplied parse and serialize functions,
     * which might have different types or different default values.
     */
    dynamic?: boolean;
}

export type SetQueryStateOptions = {
    history?: HistoryOptions;
};

export type UseQueryStateReturn<T> = [
    T,
    (
        value: T | ((prev: T) => T),
        options?: SetQueryStateOptions,
        transitionOptions?: TransitionOptions
    ) => void
];

/** Variation with no parser, serializer.
 * Uses default serializer of type `string | string[] | null`
 */
export function useQueryState(
    key: string,
    options?: { history?: HistoryOptions; dynamic?: boolean }
): UseQueryStateReturn<string | string[] | null>;
export function useQueryState<T>(
    key: string,
    options: UseQueryStateOptions<T>
): UseQueryStateReturn<T>;
export function useQueryState<T>(
    key: string,
    {
        history = "replace",
        dynamic = false,
        parse = (x) => (x === undefined ? null : x) as T,
        serialize = defaultSerializer,
    }: Partial<UseQueryStateOptions<T>> = {}
): UseQueryStateReturn<T> {
    const router = useRouter();
    const batchRouter = useBatchRouter();

    const routerValue = router.query[key];
    const value = React.useMemo(
        () => parse(routerValue),
        // Dependency array must be consistent.
        // If dynamic is false, set parse, serialize dependency as null so function instance change doesn't update callback.
        [
            Array.isArray(routerValue) ? routerValue.join("|") : routerValue,
            ...(dynamic ? [parse, serialize] : [null, null]),
        ]
    );

    const update = React.useCallback(
        (
            stateUpdater: T | ((prev: T) => T),
            options?: SetQueryStateOptions,
            transitionOptions?: TransitionOptions
        ) => {
            const queryUpdater = isUpdaterFunction(stateUpdater)
                ? (prevObj: Record<string, NextQueryValue>) => {
                      const newVal = serialize(stateUpdater(parse(prevObj[key])));
                      // Manually merge. Keep prev valud if new is undefined.
                      if (newVal !== undefined) return { ...prevObj, [key]: newVal };
                      return prevObj;
                  }
                : { [key]: serialize(stateUpdater) };

            const historyMode = options?.history || history;
            if (historyMode === "push")
                return batchRouter.push({ query: queryUpdater }, undefined, transitionOptions);
            else return batchRouter.replace({ query: queryUpdater }, undefined, transitionOptions);
        },
        // Dependency array must be consistent.
        // If dynamic is false, set parse, serialize dependency as null so function instance change doesn't update callback.
        [key, history, batchRouter, ...(dynamic ? [parse, serialize] : [null, null])]
    );
    return [value, update];
}

function isUpdaterFunction<T>(input: T | ((prev: T) => T)): input is (prev: T) => T {
    return typeof input === "function";
}
