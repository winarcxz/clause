import { render, screen } from "@testing-library/react";

import { ProposalCard } from "@/components/execution/proposal-card";

const baseProposal = {
  id: "proposal_1",
  status: "SIMULATED",
  actionType: "ERC20_TRANSFER",
  actionJson: {
    type: "erc20_transfer",
    chainId: 11155111,
    amount: "1",
    recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    tokenAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    tokenSymbol: "USDC",
    tokenDecimals: 6,
    category: "payment",
  },
  explanation: "Pay 1 USDC",
  checks: [
    {
      id: "check_1",
      code: "CHAIN_ALLOWED",
      label: "Network is allowed",
      passed: true,
      detail: "Sepolia is allowed",
    },
  ],
  simulation: {
    gasEstimate: "65000",
    wouldRevert: false,
    fromAddress: "0x0000000000000000000000000000000000000001",
    targetAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  },
  execution: null,
};

describe("ProposalCard", () => {
  it("enables approval only for a passing simulation", () => {
    render(
      <ProposalCard
        proposal={baseProposal}
        onSimulate={() => undefined}
        onApprove={() => undefined}
        onCancel={() => undefined}
        pendingAction={null}
      />,
    );

    expect(screen.getByRole("button", { name: "Approve execution" })).toBeEnabled();
  });

  it("disables approval when any mandate check fails", () => {
    render(
      <ProposalCard
        proposal={{
          ...baseProposal,
          checks: [{ ...baseProposal.checks[0]!, passed: false }],
        }}
        onSimulate={() => undefined}
        onApprove={() => undefined}
        onCancel={() => undefined}
        pendingAction={null}
      />,
    );

    expect(screen.getByRole("button", { name: "Approve execution" })).toBeDisabled();
  });

  it("never shows execution controls for unsupported actions", () => {
    render(
      <ProposalCard
        proposal={{
          ...baseProposal,
          status: "REJECTED",
          actionType: "UNSUPPORTED",
          actionJson: null,
          simulation: null,
        }}
        onSimulate={() => undefined}
        onApprove={() => undefined}
        onCancel={() => undefined}
        pendingAction={null}
      />,
    );

    expect(screen.queryByRole("button", { name: "Approve execution" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Simulate transaction" })).toBeNull();
  });
});
