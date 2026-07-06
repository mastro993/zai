import { Button } from "@/components/ui/button";

import { ColorDot } from "./color-dot";
import type { CategoryFormMode } from "./category-types";
import { getCategoryDisplayColor, type TransactionCategory } from "./model";

function CategoryCard({
  category,
  childrenCategories,
  onAddChild,
  onEdit,
  onDelete,
}: {
  category: TransactionCategory;
  childrenCategories: Array<TransactionCategory>;
  onAddChild: () => void;
  onEdit: (mode: CategoryFormMode) => void;
  onDelete: (category: TransactionCategory) => void;
}) {
  return (
    <article className="flex flex-col gap-3 border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ColorDot color={getCategoryDisplayColor(category)} />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="truncate text-base font-medium">{category.name}</h2>
            {category.description ? (
              <p className="text-sm text-muted-foreground">{category.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAddChild}>
            Add child
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit({ type: "edit", category })}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(category)}>
            Delete
          </Button>
        </div>
      </div>

      {childrenCategories.length > 0 ? (
        <div className="ml-6 flex flex-col gap-2 border-l pl-4">
          {childrenCategories.map((child) => (
            <div key={child.id} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ColorDot color={getCategoryDisplayColor(child)} />
                <span className="truncate text-sm">{child.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit({ type: "edit", category: child })}
                >
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(child)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export { CategoryCard };
