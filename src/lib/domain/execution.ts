export const executionStatuses = [
  "PROPOSED",
  "REJECTED",
  "VALIDATED",
  "SIMULATED",
  "APPROVED",
  "CANCELLED",
  "EXPIRED",
  "EXECUTING",
  "SUCCEEDED",
  "FAILED",
] as const;

export type ExecutionStatus = (typeof executionStatuses)[number];

export const executionEvents = [
  "REJECT",
  "VALIDATE",
  "SIMULATE",
  "APPROVE",
  "CANCEL",
  "EXPIRE",
  "START_EXECUTION",
  "SUCCEED",
  "FAIL",
] as const;

export type ExecutionEvent = (typeof executionEvents)[number];

const transitions: Readonly<
  Partial<Record<ExecutionStatus, Partial<Record<ExecutionEvent, ExecutionStatus>>>>
> = {
  PROPOSED: {
    REJECT: "REJECTED",
    VALIDATE: "VALIDATED",
    CANCEL: "CANCELLED",
  },
  VALIDATED: {
    REJECT: "REJECTED",
    SIMULATE: "SIMULATED",
    CANCEL: "CANCELLED",
  },
  SIMULATED: {
    APPROVE: "APPROVED",
    CANCEL: "CANCELLED",
    EXPIRE: "EXPIRED",
  },
  APPROVED: {
    START_EXECUTION: "EXECUTING",
    EXPIRE: "EXPIRED",
  },
  EXECUTING: {
    SUCCEED: "SUCCEEDED",
    FAIL: "FAILED",
  },
};

const terminalStatuses = new Set<ExecutionStatus>([
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "SUCCEEDED",
  "FAILED",
]);

export function transitionExecution(
  status: ExecutionStatus,
  event: ExecutionEvent,
): ExecutionStatus {
  const nextStatus = transitions[status]?.[event];

  if (nextStatus === undefined) {
    throw new Error(`Illegal execution transition: ${status} + ${event}`);
  }

  return nextStatus;
}

export function isTerminalExecutionStatus(status: ExecutionStatus): boolean {
  return terminalStatuses.has(status);
}
