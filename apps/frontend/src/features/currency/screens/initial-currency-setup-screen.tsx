import { Result } from "@praha/byethrow";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useCurrencyBootstrap } from "../hooks/use-currency-bootstrap";

export function InitialCurrencySetupScreen() {
  const { catalog, suggestedCurrency, confirmSetup, errorMessage } = useCurrencyBootstrap();
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selected = selectedCode ?? suggestedCurrency;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = catalog.filter((item) => {
      if (needle.length === 0) {
        return true;
      }
      return item.code.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle);
    });
    return filtered.toSorted((left, right) => {
      if (left.code === suggestedCurrency) return -1;
      if (right.code === suggestedCurrency) return 1;
      return left.code.localeCompare(right.code);
    });
  }, [catalog, query, suggestedCurrency]);

  const handleContinue = async () => {
    setPending(true);
    setSubmitError(null);
    const result = await confirmSetup(selected);
    setPending(false);
    if (Result.isFailure(result)) {
      setSubmitError(result.error.message);
    }
  };

  return (
    <main className="grid min-h-svh place-items-start bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <header className="space-y-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Choose your default currency
          </h1>
          <p className="text-sm text-muted-foreground">
            {suggestedCurrency} is preselected from this device locale. You must confirm it.
          </p>
        </header>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search currencies"
          aria-label="Search currencies"
        />
        <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto border border-border">
          {visible.map((item) => {
            const checked = selected === item.code;
            return (
              <li key={item.code}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-3">
                  <input
                    type="radio"
                    name="initial-currency-setup"
                    checked={checked}
                    onChange={() => setSelectedCode(item.code)}
                  />
                  <span className="flex-1">
                    <span className="block font-medium">
                      {item.name} ({item.code})
                    </span>
                    {item.code === suggestedCurrency ? (
                      <span className="text-xs text-muted-foreground">
                        Suggested from this device
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {submitError || errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {submitError ?? errorMessage}
          </p>
        ) : null}
        <Button
          type="button"
          className="w-full"
          disabled={pending || catalog.length === 0}
          onClick={() => {
            void handleContinue();
          }}
        >
          Continue
        </Button>
      </div>
    </main>
  );
}
