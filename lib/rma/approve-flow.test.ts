import { describe, expect, it, vi } from "vitest";
import { approveVars, sendRmaDecision, submitApprove } from "./approve-flow";

/** Whole path of the typed amount: dialog submit -> mutation variables -> API call. */
async function runPath(canPartial: boolean, typed: string, cap: number | null) {
  const approveRma = vi.fn().mockResolvedValue({});
  const rejectRma = vi.fn().mockResolvedValue({});
  let vars = null as ReturnType<typeof approveVars> | null;
  const res = await submitApprove({
    canPartial,
    amount: typed,
    cap,
    onConfirm: async (refundAmount) => {
      vars = approveVars("rma-1", refundAmount);
      await sendRmaDecision({ approveRma, rejectRma }, vars);
    },
  });
  return { res, approveRma, rejectRma, vars };
}

describe("typed partial refund reaches the request", () => {
  it("a typed amount arrives at the API as a normalised refundAmount", async () => {
    const r = await runPath(true, "250", 100000);
    expect(r.res.errorKey).toBeNull();
    expect(r.vars).toEqual({ id: "rma-1", decision: "APPROVED", refundAmount: "250.00" });
    expect(r.approveRma).toHaveBeenCalledTimes(1);
    expect(r.approveRma).toHaveBeenCalledWith("rma-1", { note: undefined, refundAmount: "250.00" });
    expect(r.rejectRma).not.toHaveBeenCalled();
  });
  it("an empty field sends no refundAmount at all (full refund)", async () => {
    const r = await runPath(true, "", 100000);
    const body = r.approveRma.mock.calls[0]![1] as Record<string, unknown>;
    expect("refundAmount" in body).toBe(false);
  });
  it("an over-cap amount never reaches the API and the dialog gets the error key", async () => {
    const r = await runPath(true, "1000.01", 100000);
    expect(r.res.errorKey).toBe("admin.rmaPage.approveModal.errors.exceeds");
    expect(r.approveRma).not.toHaveBeenCalled();
  });
  it("a non-staff dialog sends no amount even if text was typed", async () => {
    const r = await runPath(false, "250", 100000);
    expect(r.approveRma).toHaveBeenCalledWith("rma-1", { note: undefined });
  });
  it("reject goes to the reject route with a default note", async () => {
    const approveRma = vi.fn();
    const rejectRma = vi.fn().mockResolvedValue({});
    await sendRmaDecision({ approveRma, rejectRma }, { id: "r", decision: "REJECTED" });
    expect(rejectRma).toHaveBeenCalledWith("r", { note: "Rejected" });
    expect(approveRma).not.toHaveBeenCalled();
  });
});
