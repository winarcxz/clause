import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AppShell } from "@/components/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/audit",
}));

describe("AppShell", () => {
  it("provides clear wayfinding and marks the active destination", () => {
    render(
      <AppShell authConfigured={false}>
        <p>Audit content</p>
      </AppShell>,
    );

    expect(screen.getByRole("navigation", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Audit content")).toBeInTheDocument();
  });
});
