import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDojoDoorMachine } from "./useDojoDoorMachine";

function Harness({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const door = useDojoDoorMachine({
    initialPanelId: "today",
    reducedMotion,
    openDurationMs: 30,
    closeDurationMs: 20,
    frameDelayMs: 1
  });

  return (
    <div>
      <p data-testid="phase">{door.phase}</p>
      <p data-testid="active">{door.activePanelId}</p>
      <p data-testid="selected">{door.selectedPanelId}</p>
      <button type="button" onClick={() => door.requestPanel("classes")}>
        Classes
      </button>
      <button type="button" onClick={() => door.requestPanel("progress")}>
        Progress
      </button>
      <button type="button" onClick={() => door.requestPanel("programs")}>
        Programs
      </button>
    </div>
  );
}

async function advanceDoorTimers(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useDojoDoorMachine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts requested content while closed, then opens the door", async () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Classes" }));

    expect(screen.getByTestId("active")).toHaveTextContent("classes");
    expect(screen.getByTestId("selected")).toHaveTextContent("classes");
    expect(screen.getByTestId("phase")).toHaveTextContent("closed");

    await advanceDoorTimers(1);
    expect(screen.getByTestId("phase")).toHaveTextContent("opening");

    await advanceDoorTimers(30);
    expect(screen.getByTestId("phase")).toHaveTextContent("open");
  });

  it("closes an open door before swapping to the next requested panel", async () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Classes" }));
    await advanceDoorTimers(31);
    expect(screen.getByTestId("phase")).toHaveTextContent("open");

    fireEvent.click(screen.getByRole("button", { name: "Progress" }));
    expect(screen.getByTestId("phase")).toHaveTextContent("closing");
    expect(screen.getByTestId("active")).toHaveTextContent("classes");

    await advanceDoorTimers(20);
    expect(screen.getByTestId("active")).toHaveTextContent("progress");
    expect(screen.getByTestId("phase")).toHaveTextContent("closed");

    await advanceDoorTimers(31);
    expect(screen.getByTestId("phase")).toHaveTextContent("open");
  });

  it("queues rapid requests so the latest requested panel wins", async () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Classes" }));
    await advanceDoorTimers(1);
    fireEvent.click(screen.getByRole("button", { name: "Progress" }));
    fireEvent.click(screen.getByRole("button", { name: "Programs" }));

    await advanceDoorTimers(120);

    expect(screen.getByTestId("phase")).toHaveTextContent("open");
    expect(screen.getByTestId("active")).toHaveTextContent("programs");
    expect(screen.getByTestId("selected")).toHaveTextContent("programs");
  });

  it("uses the newest request before reopening when clicks arrive during close", async () => {
    vi.useFakeTimers();
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Classes" }));
    await advanceDoorTimers(31);
    expect(screen.getByTestId("phase")).toHaveTextContent("open");

    fireEvent.click(screen.getByRole("button", { name: "Progress" }));
    await advanceDoorTimers(10);
    fireEvent.click(screen.getByRole("button", { name: "Programs" }));

    await advanceDoorTimers(10);
    expect(screen.getByTestId("phase")).toHaveTextContent("closed");
    expect(screen.getByTestId("active")).toHaveTextContent("programs");

    await advanceDoorTimers(31);
    expect(screen.getByTestId("phase")).toHaveTextContent("open");
    expect(screen.getByTestId("selected")).toHaveTextContent("programs");
  });

  it("uses instant timing for reduced-motion users while keeping the same phases", async () => {
    vi.useFakeTimers();
    render(<Harness reducedMotion />);

    fireEvent.click(screen.getByRole("button", { name: "Classes" }));
    await advanceDoorTimers(3);

    expect(screen.getByTestId("phase")).toHaveTextContent("open");
    expect(screen.getByTestId("active")).toHaveTextContent("classes");
  });
});
