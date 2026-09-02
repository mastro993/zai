// @vitest-environment jsdom

import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { Result } from "@praha/byethrow";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationStatusBar } from "../application-status-bar";
import { toast } from "@/components/toaster/toast";
import { aboutPackageVersion, resolveAboutAppVersion } from "@/features/settings/lib/about-info";
import * as alertsBell from "@/features/alerts/components/alerts-bell";
import * as updater from "@/features/settings/lib/updater";
import { UpdaterError, type UpdateCheckStatus } from "@/features/settings/lib/updater";
import { THEME_STORAGE_KEY } from "@/lib/theme-toggle";

const DESKTOP_PACKAGE_VERSION = "2026.9.2000";

const stubColorScheme = (system: "light" | "dark" = "light") => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("prefers-color-scheme: dark") && system === "dark",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
};

const stubDesktopUpdaterEnv = () => {
  vi.stubEnv("VITE_ZAI_BUILD_TARGET", "tauri");
  vi.stubEnv("VITE_ZAI_UPDATER_TARGET", "macos-aarch64");
  vi.stubEnv("VITE_ZAI_APP_VERSION", DESKTOP_PACKAGE_VERSION);
};

const renderStatusBar = async () => {
  stubColorScheme();

  const rootRoute = createRootRoute({
    component: () => (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
        storageKey={THEME_STORAGE_KEY}
      >
        <ApplicationStatusBar />
        <Outlet />
      </ThemeProvider>
    ),
  });
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <p>Dashboard page</p>,
  });
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => <p>Settings page</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([dashboardRoute, settingsRoute]),
    history: createMemoryHistory({ initialEntries: ["/dashboard"] }),
  });

  await router.load();
  render(<RouterProvider router={router} />);
  return router;
};

const versionLabel = (packageVersion = aboutPackageVersion()) =>
  `Version ${resolveAboutAppVersion(packageVersion)}`;

const deferredCheck = () => {
  let resolveResult!: (value: ReturnType<typeof Result.succeed<UpdateCheckStatus>>) => void;
  const promise = new Promise<ReturnType<typeof Result.succeed<UpdateCheckStatus>>>((resolve) => {
    resolveResult = resolve;
  });
  vi.mocked(updater.checkForUpdates).mockReturnValue(promise);
  return {
    resolve: (status: UpdateCheckStatus) => {
      resolveResult(Result.succeed(status));
      return promise;
    },
  };
};

describe("StatusBarVersion", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.spyOn(alertsBell, "AlertsBell").mockImplementation(() => (
      <button type="button">Alerts</button>
    ));
    vi.spyOn(toast, "error");
    vi.spyOn(updater, "checkForUpdates");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("keeps a non-interactive span when the updater is unavailable", async () => {
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "web");
    await renderStatusBar();

    const version = screen.getByLabelText(versionLabel());
    fireEvent.click(version);

    expect(version.tagName).toBe("SPAN");
    expect(screen.queryByRole("button", { name: versionLabel() })).toBeNull();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it("checks for updates once and spins while the request is pending", async () => {
    stubDesktopUpdaterEnv();
    const pending = deferredCheck();
    await renderStatusBar();

    const version = screen.getByRole("button", { name: versionLabel(DESKTOP_PACKAGE_VERSION) });
    fireEvent.click(version);

    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(updater.checkForUpdates).toHaveBeenCalledWith("stable", "macos-aarch64");
    expect(version.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Checking for updates");

    await act(async () => {
      pending.resolve("declined");
    });
  });

  it("shows a check mark for current and returns to the box after 2000 ms", async () => {
    stubDesktopUpdaterEnv();
    vi.useFakeTimers();
    const pending = deferredCheck();
    await renderStatusBar();

    const version = screen.getByRole("button", { name: versionLabel(DESKTOP_PACKAGE_VERSION) });
    fireEvent.click(version);

    await act(async () => {
      pending.resolve("current");
    });

    expect(screen.getByText("Zai is up to date")).toBeTruthy();
    expect(version.querySelector(".animate-spin")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1_999);
    });
    expect(screen.getByText("Zai is up to date")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("Zai is up to date")).toBeNull();
  });

  it.each(["declined", "restarting", "busy"] as const)(
    "does not show a check mark when the check returns %s",
    async (status) => {
      stubDesktopUpdaterEnv();
      vi.mocked(updater.checkForUpdates).mockResolvedValue(Result.succeed(status));
      await renderStatusBar();

      fireEvent.click(screen.getByRole("button", { name: versionLabel(DESKTOP_PACKAGE_VERSION) }));

      await waitFor(() => {
        expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByText("Zai is up to date")).toBeNull();
      expect(toast.error).not.toHaveBeenCalled();
    },
  );

  it("toasts the error and skips the check mark when the check fails", async () => {
    stubDesktopUpdaterEnv();
    vi.mocked(updater.checkForUpdates).mockResolvedValue(
      Result.fail(new UpdaterError("Update check failed.")),
    );
    await renderStatusBar();

    fireEvent.click(screen.getByRole("button", { name: versionLabel(DESKTOP_PACKAGE_VERSION) }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update check failed.");
    });
    expect(screen.queryByText("Zai is up to date")).toBeNull();
  });

  it("ignores a second click while a check is in flight", async () => {
    stubDesktopUpdaterEnv();
    const pending = deferredCheck();
    await renderStatusBar();

    const version = screen.getByRole("button", { name: versionLabel(DESKTOP_PACKAGE_VERSION) });
    fireEvent.click(version);
    fireEvent.click(version);

    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve("busy");
    });
  });

  it("starts a new check from the current check mark", async () => {
    stubDesktopUpdaterEnv();
    const first = deferredCheck();
    await renderStatusBar();

    const version = screen.getByRole("button", { name: versionLabel(DESKTOP_PACKAGE_VERSION) });
    fireEvent.click(version);

    await act(async () => {
      first.resolve("current");
    });
    expect(screen.getByText("Zai is up to date")).toBeTruthy();

    const second = deferredCheck();
    fireEvent.click(version);

    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
    expect(version.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.getByText("Checking for updates")).toBeTruthy();

    await act(async () => {
      second.resolve("declined");
    });
  });
});
