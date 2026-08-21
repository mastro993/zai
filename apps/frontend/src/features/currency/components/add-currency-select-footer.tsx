import { Link } from "@tanstack/react-router";

import { SelectSeparator } from "@/components/ui/select";

export function AddCurrencySelectFooter() {
  return (
    <>
      <SelectSeparator />
      <Link
        to="/settings"
        search={{ focus: "currencies" }}
        className="flex w-full cursor-pointer items-center rounded-md py-1 pr-2 pl-1.5 text-sm text-muted-foreground outline-hidden hover:bg-foreground/10 hover:text-foreground"
      >
        Add currency +
      </Link>
    </>
  );
}
