import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useId, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export function TransactionSearchBar() {
  const id = useId();
  const searchRef = useRef<HTMLInputElement>(null);

  useHotkeys("mod+k", () => {
    searchRef.current?.focus();
  });

  return (
    <div className="relative -my-1">
      <Input
        id={id}
        ref={searchRef}
        className="peer ps-9"
        placeholder="Email"
        type="email"
      />
      <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
        <Search size={16} aria-hidden="true" />
      </div>
      <div className="text-muted-foreground pointer-events-none absolute inset-y-0 end-0 flex items-center justify-center pe-2">
        <kbd className="text-muted-foreground/70 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
          ⌘K
        </kbd>
      </div>
    </div>
  );

  return (
    <label className="input ">
      <Search className="w-4 h-4 text-content" />
      <input
        type="search"
        className="grow"
        placeholder="Search"
        ref={searchRef}
      />
      <kbd className="kbd kbd-sm">⌘</kbd>
      <kbd className="kbd kbd-sm">K</kbd>
    </label>
  );
}
