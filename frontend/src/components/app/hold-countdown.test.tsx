// HoldCountdown label per booking type.
// source: FLT-22 (seats are held for 10 minutes), HTL-18 (rooms are held for 10 minutes);
// wording "Seats held for you" / "Rooms held for you" and So3ad's "The seats/rooms won't wait"
// chosen by Khaled (popup, 24 Nov 2026).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HoldCountdown } from "./hold-countdown";

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();

afterEach(cleanup);

describe("HoldCountdown", () => {
  it("says seats are held for a flight booking", () => {
    render(<HoldCountdown bookingType="flight" expiresAt={inSeconds(600)} />);
    expect(screen.getByText("Seats held for you").textContent).toBe("Seats held for you");
    expect(screen.queryByText("Rooms held for you")).toBeNull();
  });

  it("says rooms are held for a hotel booking", () => {
    render(<HoldCountdown bookingType="hotel" expiresAt={inSeconds(600)} />);
    expect(screen.getByText("Rooms held for you").textContent).toBe("Rooms held for you");
    expect(screen.queryByText("Seats held for you")).toBeNull();
  });

  it("warns that the seats won't wait for a flight under 2 minutes", () => {
    render(<HoldCountdown bookingType="flight" expiresAt={inSeconds(60)} />);
    expect(screen.getByText(/The seats won.t wait\./).textContent).toBe("So3ad: “Hurry, habibi! The seats won’t wait.”");
  });

  it("warns that the rooms won't wait for a hotel under 2 minutes", () => {
    render(<HoldCountdown bookingType="hotel" expiresAt={inSeconds(60)} />);
    expect(screen.getByText(/The rooms won.t wait\./).textContent).toBe("So3ad: “Hurry, habibi! The rooms won’t wait.”");
    expect(screen.queryByText(/seats/i)).toBeNull();
  });
});
