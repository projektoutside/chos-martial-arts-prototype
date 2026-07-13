import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DemoEnvironmentBadge } from "./DemoEnvironmentBadge";

describe("DemoEnvironmentBadge", () => {
  it("labels testing builds", () => {
    render(<DemoEnvironmentBadge demo />);
    expect(screen.getByRole("status", { name: "Demo Environment" })).toBeTruthy();
  });

  it("is absent from stable builds", () => {
    render(<DemoEnvironmentBadge demo={false} />);
    expect(screen.queryByRole("status", { name: "Demo Environment" })).toBeNull();
  });
});
