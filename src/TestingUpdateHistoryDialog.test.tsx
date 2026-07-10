import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TestingUpdateHistoryDialog } from "./TestingUpdateHistoryDialog";
import { testingUpdateNotices } from "./testingUpdateNotice";

describe("TestingUpdateHistoryDialog", () => {
  it("renders the newest-first app update history in an accessible dialog", () => {
    render(<TestingUpdateHistoryDialog onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "App updates" });
    expect(within(dialog).getByRole("heading", { name: "App updates" })).toBeVisible();

    const historyList = within(dialog).getAllByRole("list")[0];
    const entries = Array.from(historyList.children) as HTMLElement[];
    expect(entries.length).toBeGreaterThanOrEqual(testingUpdateNotices.length);
    expect(within(entries[0]).getByText(`Version ${testingUpdateNotices[0].version}`)).toBeVisible();
    expect(within(entries[0]).getByText(testingUpdateNotices[0].date)).toBeVisible();
    expect(within(entries[0]).getByRole("heading", { name: testingUpdateNotices[0].title })).toBeVisible();
    testingUpdateNotices[0].changes.forEach((change) => {
      expect(within(entries[0]).getByText(change)).toBeVisible();
    });

    testingUpdateNotices.forEach((entry, index) => {
      expect(within(entries[index]).getByText(entry.title)).toBeVisible();
    });
  });

  it("closes from its close button and backdrop", () => {
    const onClose = vi.fn();
    const { rerender } = render(<TestingUpdateHistoryDialog onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close app updates" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<TestingUpdateHistoryDialog onClose={onClose} />);
    fireEvent.mouseDown(screen.getByRole("presentation"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
