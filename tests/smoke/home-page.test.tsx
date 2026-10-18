import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("states the product's safety promise", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "The safest way to let AI spend money.",
      }),
    ).toBeInTheDocument();
  });
});
