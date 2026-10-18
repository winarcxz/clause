import {
  AuthenticationError,
  getAuthenticatedUserId,
} from "@/lib/auth";

describe("getAuthenticatedUserId", () => {
  it("returns the stable Clerk user ID", () => {
    expect(getAuthenticatedUserId({ userId: "user_123" })).toBe("user_123");
  });

  it("fails closed when no Clerk session exists", () => {
    expect(() => getAuthenticatedUserId({ userId: null })).toThrow(
      AuthenticationError,
    );
  });
});
