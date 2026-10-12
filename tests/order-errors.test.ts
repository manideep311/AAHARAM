import { OrderError, toOrderError } from "../services/order-errors";

function httpError(body: unknown) {
  return { name: "FunctionsHttpError", context: { json: async () => body } };
}

describe("toOrderError", () => {
  it("maps a structured function error to its code, message and details", async () => {
    const err = await toOrderError(
      httpError({ error: { code: "PRICE_CHANGED", message: "Prices changed", details: { totals: { total: 500 } } } })
    );
    expect(err).toBeInstanceOf(OrderError);
    expect(err.code).toBe("PRICE_CHANGED");
    expect(err.message).toBe("Prices changed");
    expect(err.details).toEqual({ totals: { total: 500 } });
  });

  it("falls back to INTERNAL for an unknown code", async () => {
    expect((await toOrderError(httpError({ error: { code: "WHAT", message: "?" } }))).code).toBe("INTERNAL");
  });

  it("falls back to INTERNAL when the body is not JSON", async () => {
    const err = await toOrderError({ context: { json: async () => { throw new Error("bad json"); } } });
    expect(err.code).toBe("INTERNAL");
  });

  it("maps transport failures to NETWORK", async () => {
    expect((await toOrderError(new Error("Failed to fetch"))).code).toBe("NETWORK");
    expect((await toOrderError({ context: new TypeError("Network request failed") })).code).toBe("NETWORK");
  });
});
