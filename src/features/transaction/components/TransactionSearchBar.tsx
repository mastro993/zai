import { Search } from "lucide-react";
import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export const TransactionSearchBar = () => {
  const searchRef = useRef<HTMLInputElement>(null);

  useHotkeys("mod+k", () => {
    searchRef.current?.focus();
  });

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
};
