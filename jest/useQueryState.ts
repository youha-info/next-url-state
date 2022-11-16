import { describe, expect, test } from "@jest/globals";
import exp from "constants";
import { queryTypes, useQueryState } from "../src";

const mockBatchRouter = {
    push: jest.fn(),
    replace: jest.fn(),
};
jest.mock("next-batch-router", () => ({
    useBatchRouter: () => mockBatchRouter,
}));

const mockQuery = { current: {} };
jest.mock("next/router", () => ({
    useRouter: () => ({ query: mockQuery.current }),
}));

jest.mock("react", () => ({
    useMemo: (cb: Function, deps: any[]) => cb(),
    useCallback: (cb: Function, deps: any[]) => cb,
}));

describe("useQueryState", () => {
    beforeEach(() => {
        mockBatchRouter.push = jest.fn();
        mockBatchRouter.replace = jest.fn();
        mockQuery.current = {};
    });

    test("basic", () => {
        mockQuery.current = { val: "foo" };
        const [val, setVal] = useQueryState("val");

        expect(val).toBe("foo");

        setVal("bar");

        expect(mockBatchRouter.replace).toBeCalledWith({ query: { val: "bar" } }, undefined, {});
    });

    test("history option override", () => {
        const [val, setVal] = useQueryState("val", queryTypes.string, { history: "push" });

        setVal("foo");
        expect(mockBatchRouter.push).toBeCalledWith({ query: { val: "foo" } }, undefined, {});

        setVal("foo", { history: "replace" });
        expect(mockBatchRouter.replace).toBeCalledWith({ query: { val: "foo" } }, undefined, {});
    });

    describe("transition options passed", () => {
        for (const options of [
            {},
            { shallow: true },
            { scroll: false },
            { shallow: true, scroll: false },
        ])
            test(JSON.stringify(options), () => {
                const [, setVal] = useQueryState("val", queryTypes.string);
                setVal("foo", options);
                expect(mockBatchRouter.replace).toBeCalledWith(
                    { query: { val: "foo" } },
                    undefined,
                    options
                );
            });
    });

    describe("serializers integration", () => {
        test("parse number", () => {
            mockQuery.current = { val: "123" };
            const [val] = useQueryState("val", queryTypes.integer);
            expect(val).toBe(123);
        });

        test("parse number array", () => {
            mockQuery.current = { val: ["123", "456"] };
            const [val] = useQueryState("val", queryTypes.array(queryTypes.integer));
            expect(val).toEqual([123, 456]);
        });

        test("parse number delimited array", () => {
            mockQuery.current = { val: "123_456" };
            const [val] = useQueryState("val", queryTypes.delimitedArray(queryTypes.integer, "_"));
            expect(val).toEqual([123, 456]);
        });

        test("serialize payload", () => {
            const [, setVal] = useQueryState("val", queryTypes.integer);
            setVal(123);
            expect(mockBatchRouter.replace).toBeCalledWith(
                { query: { val: "123" } },
                undefined,
                {}
            );
        });

        test("functional update parse/serialize", () => {
            mockQuery.current = { val: "123" };
            const spyParse = jest.spyOn(queryTypes.integer, "parse");
            const spySerialize = jest.spyOn(queryTypes.integer, "serialize");
            const [, setVal] = useQueryState("val", queryTypes.integer);
            expect(spyParse).toBeCalledWith("123");

            setVal((prev) => prev! + 1);
            setVal((prev) => prev! + 1);

            let i = 0;
            let res = mockBatchRouter.replace.mock.calls[i][0].query({ val: "123" });
            expect(spyParse).toBeCalledWith("123");
            expect(spyParse.mock.results[i + 1].value).toBe(123);
            expect(spySerialize).toBeCalledWith(124);
            expect(spySerialize.mock.results[i].value).toBe("124");
            expect(res).toEqual({ val: "124" });

            i++;
            res = mockBatchRouter.replace.mock.calls[i][0].query(res);
            expect(spyParse).toBeCalledWith("124");
            expect(spyParse.mock.results[i + 1].value).toBe(124);
            expect(spySerialize).toBeCalledWith(125);
            expect(spySerialize.mock.results[i].value).toBe("125");
            expect(res).toEqual({ val: "125" });
        });

        test("keep previous value if functional update return value is undefined", () => {
            const [, setVal] = useQueryState("val", queryTypes.integer);
            setVal(() => undefined);

            let res = mockBatchRouter.replace.mock.calls[0][0].query({ val: "123" });
            expect(res).toEqual({ val: "123" });
        });
    });
});
