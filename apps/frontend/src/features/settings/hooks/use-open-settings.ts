import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { settingsLocation, type OpenSettingsOptions } from "@/lib/workspace-chrome";

export function useOpenSettings() {
  const navigate = useNavigate();

  return useCallback(
    (options: OpenSettingsOptions = {}) => {
      void navigate(settingsLocation(options));
    },
    [navigate],
  );
}
