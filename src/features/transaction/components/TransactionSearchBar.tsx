import { Input } from "@heroui/react";
import { Search } from "lucide-react";
import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export function TransactionSearchBar() {
  const searchRef = useRef<HTMLInputElement>(null);

  useHotkeys("mod+k", () => {
    searchRef.current?.focus();
  });

  return (
    <Input
      ref={searchRef}
      placeholder="Search"
      type="search"
      startContent={<Search size={16} aria-hidden="true" />}
      endContent={
        <kbd className="inline-flex h-5 items-center rounded border px-1 text-[0.625rem] font-medium">
          ⌘K
        </kbd>
      }
    />
  );
}
