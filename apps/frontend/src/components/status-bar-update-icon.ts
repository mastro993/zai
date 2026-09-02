import type { UpdateCheckStatus } from "@/features/settings/lib/updater";

export const STATUS_BAR_CURRENT_FEEDBACK_MS = 2_000;
export const STATUS_BAR_DEV_FAKE_CHECK_MS = 800;

export function isStatusBarVersionInteractive(
  isDev: boolean,
  updaterTarget: string | null,
): boolean {
  return updaterTarget !== null || isDev;
}

export type StatusBarUpdateIconPhase = "idle" | "checking" | "current";

export type StatusBarUpdateIconEvent =
  | { type: "check-started" }
  | { type: "check-completed"; status: UpdateCheckStatus }
  | { type: "check-failed" }
  | { type: "current-feedback-expired" };

const completedPhaseByStatus = {
  busy: "idle",
  current: "current",
  declined: "idle",
  restarting: "idle",
} satisfies Readonly<Record<UpdateCheckStatus, StatusBarUpdateIconPhase>>;

export function reduceStatusBarUpdateIconPhase(
  phase: StatusBarUpdateIconPhase,
  event: StatusBarUpdateIconEvent,
): StatusBarUpdateIconPhase {
  switch (event.type) {
    case "check-started":
      return "checking";
    case "check-completed":
      return phase === "checking" ? completedPhaseByStatus[event.status] : phase;
    case "check-failed":
      return phase === "checking" ? "idle" : phase;
    case "current-feedback-expired":
      return phase === "current" ? "idle" : phase;
  }
}
