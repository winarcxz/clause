import {
  isTerminalExecutionStatus,
  transitionExecution,
} from "@/lib/domain/execution";

describe("transitionExecution", () => {
  it("advances through the approved execution path", () => {
    expect(transitionExecution("PROPOSED", "VALIDATE")).toBe("VALIDATED");
    expect(transitionExecution("VALIDATED", "SIMULATE")).toBe("SIMULATED");
    expect(transitionExecution("SIMULATED", "APPROVE")).toBe("APPROVED");
    expect(transitionExecution("APPROVED", "START_EXECUTION")).toBe("EXECUTING");
    expect(transitionExecution("EXECUTING", "SUCCEED")).toBe("SUCCEEDED");
  });

  it("fails closed on an impossible transition", () => {
    expect(() => transitionExecution("SUCCEEDED", "APPROVE")).toThrow(
      "Illegal execution transition: SUCCEEDED + APPROVE",
    );
  });

  it.each(["REJECTED", "CANCELLED", "EXPIRED", "SUCCEEDED", "FAILED"] as const)(
    "recognizes %s as terminal",
    (status) => {
      expect(isTerminalExecutionStatus(status)).toBe(true);
    },
  );

  it("keeps an in-flight execution non-terminal", () => {
    expect(isTerminalExecutionStatus("EXECUTING")).toBe(false);
  });
});
