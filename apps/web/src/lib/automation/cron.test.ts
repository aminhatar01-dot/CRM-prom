import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron";

describe("automation cron protection", () => {
  it("accepts bearer secret", () => {
    expect(
      isCronAuthorized({
        authorization: "Bearer secret",
        cronSecret: "secret"
      }),
    ).toBe(true);
  });

  it("rejects missing or invalid secret", () => {
    expect(isCronAuthorized({ authorization: "Bearer nope", cronSecret: "secret" })).toBe(false);
    expect(isCronAuthorized({ authorization: "Bearer secret" })).toBe(false);
  });
});
