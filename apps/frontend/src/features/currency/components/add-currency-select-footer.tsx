import { Link } from "@tanstack/react-router";

import { SelectSeparator } from "@/components/ui/select";
import { useOpenSettings } from "@/features/settings/hooks/use-settings-modal";

export function AddCurrencySelectFooter() {
  const openSettings = useOpenSettings();

  return (
    <>
      <SelectSeparator />
      <Link
        to="/settings/currencies"
        search={{ focus: "currencies" }}
        className="flex w-full cursor-pointer items-center rounded-md py-1 pr-2 pl-1.5 text-sm text-muted-foreground outline-hidden hover:bg-foreground/10 hover:text-foreground"
        onClick={(event) => {
          event.preventDefault();
          openSettings({ section: "currencies", focus: "currencies" });
        }}
      >
        Add currency +
      </Link>
    </>
  );
}
