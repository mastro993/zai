import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";

import { SettingsModal } from "../components/settings-modal";

const AboutSettingsScreen = lazy(() =>
  import("../screens/about-settings-screen").then((module) => ({
    default: module.AboutSettingsScreen,
  })),
);
const AppearanceSettingsScreen = lazy(() =>
  import("../screens/appearance-settings-screen").then((module) => ({
    default: module.AppearanceSettingsScreen,
  })),
);
const CurrenciesSettingsScreen = lazy(() =>
  import("../screens/currencies-settings-screen").then((module) => ({
    default: module.CurrenciesSettingsScreen,
  })),
);
const DiagnosticsSettingsScreen = lazy(() =>
  import("../screens/diagnostics-settings-screen").then((module) => ({
    default: module.DiagnosticsSettingsScreen,
  })),
);

type SettingsSection = "appearance" | "about" | "diagnostics" | "currencies";
type SettingsFocus = "rates" | "currencies";

interface OpenSettingsOptions {
  section?: SettingsSection;
  focus?: SettingsFocus;
}

interface SettingsState {
  section: SettingsSection;
  focus?: SettingsFocus;
}

const OpenSettingsContext = createContext<((options?: OpenSettingsOptions) => void) | null>(null);

export function SettingsModalProvider({ children }: { children: ReactNode }) {
  // ponytail: local modal state keeps current route mounted; direct settings URLs remain fallback routes.
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const openSettings = useCallback((options: OpenSettingsOptions = {}) => {
    setSettings({ section: options.section ?? "appearance", focus: options.focus });
  }, []);

  return (
    <OpenSettingsContext.Provider value={openSettings}>
      {children}
      {settings ? (
        <SettingsModal
          pathname={`/settings/${settings.section}`}
          onNavigate={(pathname) => {
            if (pathname === "/settings/about") {
              setSettings({ section: "about" });
            } else if (pathname === "/settings/diagnostics") {
              setSettings({ section: "diagnostics" });
            } else if (pathname === "/settings/currencies") {
              setSettings({ section: "currencies" });
            } else {
              setSettings({ section: "appearance" });
            }
          }}
          onClose={() => setSettings(null)}
        >
          <Suspense fallback={null}>
            <SettingsContent settings={settings} />
          </Suspense>
        </SettingsModal>
      ) : null}
    </OpenSettingsContext.Provider>
  );
}

export function useOpenSettings() {
  const openSettings = useContext(OpenSettingsContext);
  const navigate = useNavigate();

  return useCallback(
    (options: OpenSettingsOptions = {}) => {
      if (openSettings) {
        openSettings(options);
        return;
      }

      if (options.section === "about") {
        void navigate({ to: "/settings/about" });
      } else if (options.section === "diagnostics") {
        void navigate({ to: "/settings/diagnostics" });
      } else if (options.section === "currencies") {
        void navigate({ to: "/settings/currencies", search: { focus: options.focus } });
      } else {
        void navigate({ to: "/settings" });
      }
    },
    [navigate, openSettings],
  );
}

function SettingsContent({ settings }: { settings: SettingsState }) {
  if (settings.section === "about") {
    return <AboutSettingsScreen />;
  }

  if (settings.section === "diagnostics") {
    return <DiagnosticsSettingsScreen />;
  }

  if (settings.section === "currencies") {
    return (
      <CurrenciesSettingsScreen
        focusRates={settings.focus === "rates"}
        focusAdd={settings.focus === "currencies"}
      />
    );
  }

  return <AppearanceSettingsScreen />;
}
