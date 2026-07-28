import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

import { getCategoryDisplayColor } from "../lib/category";
import { getCategorySelectionItems } from "../lib/category-selection";
import type { TransactionCategory } from "../types/model";
import { CategoryBadge } from "./category-badge";
import { CategoryDrawerSelectPanel } from "./category-drawer-select-panel";

interface CategoryDrawerSelectBase {
  id: string;
  categories: Array<TransactionCategory>;
  placeholder: string;
  ariaLabel: string;
  drawerTitle: string;
  drawerDescription?: string;
  backAriaLabel?: string;
  emptyListMessage?: string;
  parentOpen?: boolean;
  onBlur?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

interface CategoryDrawerSelectSingleProps extends CategoryDrawerSelectBase {
  mode: "single";
  value: string | null;
  onChange: (value: string | null) => void;
  clearable?: boolean;
}

interface CategoryDrawerSelectMultipleProps extends CategoryDrawerSelectBase {
  mode: "multiple";
  value: Array<string>;
  onChange: (value: Array<string>) => void;
}

type CategoryDrawerSelectProps =
  | CategoryDrawerSelectSingleProps
  | CategoryDrawerSelectMultipleProps;

const EMPTY_IDS: Array<string> = [];

function CategoryDrawerSelect(props: CategoryDrawerSelectProps) {
  const {
    id,
    categories,
    placeholder,
    ariaLabel,
    drawerTitle,
    drawerDescription,
    backAriaLabel = "Back",
    emptyListMessage = "No categories yet.",
    parentOpen,
    onBlur,
    open,
    onOpenChange,
    className,
  } = props;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpenControlled = open !== undefined;
  const isDrawerOpen = isOpenControlled ? open : uncontrolledOpen;
  const [draftIds, setDraftIds] = useState<Array<string>>(EMPTY_IDS);
  const searchInputId = useId();

  const multipleValue = props.mode === "multiple" ? props.value : EMPTY_IDS;
  const singleValue = props.mode === "single" ? props.value : null;
  const selectionItems = useMemo(
    () =>
      getCategorySelectionItems(
        categories,
        props.mode === "multiple" ? multipleValue : singleValue ? [singleValue] : EMPTY_IDS,
      ),
    [categories, multipleValue, props.mode, singleValue],
  );

  const setDrawerOpen = (next: boolean) => {
    if (next && props.mode === "multiple") {
      setDraftIds(props.value);
    }
    if (!isOpenControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) onBlur?.();
  };

  useEffect(() => {
    if (parentOpen !== false) return;
    if (!isOpenControlled) setUncontrolledOpen(false);
    onOpenChange?.(false);
  }, [parentOpen, isOpenControlled, onOpenChange]);

  const handleDone = () => {
    if (props.mode === "multiple") props.onChange(draftIds);
    setDrawerOpen(false);
  };

  const handleSingleSelect = (categoryId: string) => {
    if (props.mode !== "single") return;
    props.onChange(categoryId);
    setDrawerOpen(false);
  };

  const handleSingleClear = () => {
    if (props.mode !== "single") return;
    props.onChange(null);
    setDrawerOpen(false);
  };

  return (
    <Drawer open={isDrawerOpen} onOpenChange={setDrawerOpen} swipeDirection="right">
      <DrawerTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "h-auto min-h-8 w-full min-w-0 justify-between gap-2 overflow-hidden py-1.5 font-normal",
              className,
            )}
            aria-label={ariaLabel}
            aria-haspopup="dialog"
            aria-expanded={isDrawerOpen}
          />
        }
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selectionItems.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selectionItems.map(({ category, label }) => (
              <CategoryBadge
                key={category.id}
                color={getCategoryDisplayColor(category)}
                truncate={false}
                className="max-w-full shrink"
              >
                {label}
              </CategoryBadge>
            ))
          )}
        </span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="shrink-0 self-center"
          data-icon="inline-end"
          aria-hidden="true"
        />
      </DrawerTrigger>

      {props.mode === "multiple" ? (
        <CategoryDrawerSelectPanel
          mode="multiple"
          open={isDrawerOpen}
          categories={categories}
          selectedIds={draftIds}
          onSelectedIdsChange={setDraftIds}
          onDone={handleDone}
          drawerTitle={drawerTitle}
          drawerDescription={drawerDescription}
          backAriaLabel={backAriaLabel}
          emptyListMessage={emptyListMessage}
          searchInputId={searchInputId}
        />
      ) : (
        <CategoryDrawerSelectPanel
          mode="single"
          open={isDrawerOpen}
          categories={categories}
          selectedId={props.value}
          onSelect={handleSingleSelect}
          clearable={props.clearable}
          onClear={handleSingleClear}
          drawerTitle={drawerTitle}
          drawerDescription={drawerDescription}
          backAriaLabel={backAriaLabel}
          emptyListMessage={emptyListMessage}
          searchInputId={searchInputId}
        />
      )}
    </Drawer>
  );
}

export { CategoryDrawerSelect };
export type { CategoryDrawerSelectProps };
