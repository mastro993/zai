import { ArrowLeft01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

import { getCategoryDisplayColor } from "../lib/category";
import {
  getCategorySelectionItems,
  getRootState,
  groupCategories,
  toggleChildSelection,
  toggleRootSelection,
} from "../lib/category-selection";
import type { TransactionCategory } from "../types/model";
import { CategoryBadge } from "./category-badge";
import {
  CategoryCheckboxRow,
  CategoryOptionRow,
  ExpandControl,
} from "./category-drawer-select-rows";

interface CategoryDrawerSelectPanelBase {
  open: boolean;
  categories: Array<TransactionCategory>;
  drawerTitle: string;
  drawerDescription?: string;
  backAriaLabel: string;
  emptyListMessage: string;
  searchInputId: string;
}

interface CategoryDrawerSelectPanelMultiple extends CategoryDrawerSelectPanelBase {
  mode: "multiple";
  selectedIds: Array<string>;
  onSelectedIdsChange: (selectedIds: Array<string>) => void;
  onDone: () => void;
}

interface CategoryDrawerSelectPanelSingle extends CategoryDrawerSelectPanelBase {
  mode: "single";
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  clearable?: boolean;
  onClear?: () => void;
}

type CategoryDrawerSelectPanelProps =
  | CategoryDrawerSelectPanelMultiple
  | CategoryDrawerSelectPanelSingle;

function CategoryDrawerSelectPanel(props: CategoryDrawerSelectPanelProps) {
  const {
    open,
    categories,
    drawerTitle,
    drawerDescription,
    backAriaLabel,
    emptyListMessage,
    searchInputId,
  } = props;
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const groups = useMemo(
    () => groupCategories(categories, deferredQuery),
    [categories, deferredQuery],
  );
  const multipleIds = props.mode === "multiple" ? props.selectedIds : [];
  const selectedIdSet = useMemo(() => new Set(multipleIds), [multipleIds]);
  const selectionCount =
    props.mode === "multiple"
      ? getCategorySelectionItems(categories, props.selectedIds).length
      : props.selectedId
        ? 1
        : 0;

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const toggleExpanded = (categoryId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  return (
    <DrawerContent className="[--drawer-bleed-background:transparent] [--drawer-inset:1rem] data-[swipe-axis=x]:w-[calc(100%-2rem)] sm:data-[swipe-axis=x]:w-96">
      <DrawerHeader className="flex-row items-start gap-2">
        <DrawerClose
          render={
            <Button type="button" variant="ghost" size="icon-sm" aria-label={backAriaLabel} />
          }
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" />
        </DrawerClose>
        <div className="flex min-w-0 flex-col gap-0.5">
          <DrawerTitle>{drawerTitle}</DrawerTitle>
          {drawerDescription ? <DrawerDescription>{drawerDescription}</DrawerDescription> : null}
        </div>
      </DrawerHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <Field>
          <FieldLabel htmlFor={searchInputId} className="sr-only">
            Search categories
          </FieldLabel>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <HugeiconsIcon icon={Search01Icon} aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id={searchInputId}
              type="search"
              placeholder="Search categories"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        </Field>

        <div
          role={props.mode === "single" ? "listbox" : "group"}
          aria-label={drawerTitle}
          className="min-h-0 flex-1 overflow-y-auto border"
        >
          {categories.length === 0 ? (
            <FieldDescription className="px-3 py-8 text-center">
              {emptyListMessage}
            </FieldDescription>
          ) : groups.length === 0 ? (
            <FieldDescription className="px-3 py-8 text-center">
              No categories match “{query.trim()}”.
            </FieldDescription>
          ) : (
            groups.map(({ root, children, visibleChildren }) => {
              if (!root) {
                return visibleChildren.map((category) =>
                  props.mode === "multiple" ? (
                    <CategoryCheckboxRow
                      key={category.id}
                      category={category}
                      inputIdPrefix={searchInputId}
                      checked={selectedIdSet.has(category.id)}
                      onCheckedChange={(checked) => {
                        props.onSelectedIdsChange(
                          checked
                            ? [...props.selectedIds, category.id]
                            : props.selectedIds.filter((id) => id !== category.id),
                        );
                      }}
                    />
                  ) : (
                    <CategoryOptionRow
                      key={category.id}
                      category={category}
                      optionId={`${searchInputId}-option-${category.id}`}
                      selected={props.selectedId === category.id}
                      onSelect={() => props.onSelect(category.id)}
                    />
                  ),
                );
              }

              const isExpanded = expandedIds.has(root.id);
              const showChildren = deferredQuery.length > 0 || isExpanded;

              if (props.mode === "single") {
                return (
                  <div key={root.id} className="border-b last:border-b-0">
                    <div className="flex min-w-0 items-center">
                      <ExpandControl
                        root={root}
                        childrenCount={children.length}
                        deferredQuery={deferredQuery}
                        isExpanded={isExpanded}
                        showChildren={showChildren}
                        onToggle={() => toggleExpanded(root.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <CategoryOptionRow
                          category={root}
                          optionId={`${searchInputId}-option-${root.id}`}
                          selected={props.selectedId === root.id}
                          onSelect={() => props.onSelect(root.id)}
                        />
                      </div>
                      {children.length > 0 ? (
                        <span
                          className="mr-3 shrink-0 text-xs tabular-nums text-muted-foreground"
                          aria-hidden="true"
                        >
                          +{children.length}
                        </span>
                      ) : null}
                    </div>
                    {showChildren
                      ? visibleChildren.map((category) => (
                          <CategoryOptionRow
                            key={category.id}
                            category={category}
                            nested
                            optionId={`${searchInputId}-option-${category.id}`}
                            selected={props.selectedId === category.id}
                            onSelect={() => props.onSelect(category.id)}
                          />
                        ))
                      : null}
                  </div>
                );
              }

              const rootState = getRootState(root, children, selectedIdSet);

              return (
                <div key={root.id} className="border-b last:border-b-0">
                  <div className="flex min-w-0 items-center">
                    <ExpandControl
                      root={root}
                      childrenCount={children.length}
                      deferredQuery={deferredQuery}
                      isExpanded={isExpanded}
                      showChildren={showChildren}
                      onToggle={() => toggleExpanded(root.id)}
                    />
                    <Field orientation="horizontal" className="min-w-0 flex-1 gap-2 px-2 py-2.5">
                      <Checkbox
                        id={`${searchInputId}-${root.id}`}
                        checked={rootState.checked}
                        indeterminate={rootState.indeterminate}
                        onCheckedChange={(checked) =>
                          props.onSelectedIdsChange(
                            toggleRootSelection(props.selectedIds, root, children, checked),
                          )
                        }
                      />
                      <FieldLabel
                        htmlFor={`${searchInputId}-${root.id}`}
                        className="min-w-0 flex-1 font-normal"
                      >
                        <CategoryBadge color={getCategoryDisplayColor(root)}>
                          {root.name}
                        </CategoryBadge>
                        {children.length > 0 ? (
                          <span
                            className="shrink-0 text-xs tabular-nums text-muted-foreground"
                            aria-hidden="true"
                          >
                            +{children.length}
                          </span>
                        ) : null}
                      </FieldLabel>
                    </Field>
                  </div>
                  {showChildren
                    ? visibleChildren.map((category) => (
                        <CategoryCheckboxRow
                          key={category.id}
                          category={category}
                          nested
                          inputIdPrefix={searchInputId}
                          checked={rootState.checked || selectedIdSet.has(category.id)}
                          onCheckedChange={(checked) =>
                            props.onSelectedIdsChange(
                              toggleChildSelection(
                                props.selectedIds,
                                root,
                                children,
                                category.id,
                                checked,
                              ),
                            )
                          }
                        />
                      ))
                    : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {props.mode === "multiple" ? (
        <DrawerFooter className="flex-row items-center justify-between border-t pt-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {selectionCount === 0
                ? "None selected"
                : `${selectionCount} ${selectionCount === 1 ? "category" : "categories"}`}
            </span>
            {selectionCount > 0 ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => props.onSelectedIdsChange([])}
              >
                Clear
              </Button>
            ) : null}
          </div>
          <Button type="button" onClick={props.onDone}>
            Done
          </Button>
        </DrawerFooter>
      ) : props.clearable && props.selectedId ? (
        <DrawerFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={props.onClear}>
            Clear
          </Button>
        </DrawerFooter>
      ) : null}
    </DrawerContent>
  );
}

export { CategoryDrawerSelectPanel };
