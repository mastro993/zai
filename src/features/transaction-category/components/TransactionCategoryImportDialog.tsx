import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileUp, Loader2 } from "lucide-react";
import { useImportCategories } from "../hooks/useImportCategories";

export function TransactionCategoryImportDialog(
  dialogProps: React.ComponentProps<typeof Dialog>
) {
  const { selectFile, rawCategories, importCategories, isImporting, clear } =
    useImportCategories(() => {
      dialogProps.onOpenChange?.(false);
    });

  return (
    <Dialog {...dialogProps}>
      <DialogContent
        onCloseAutoFocus={() => clear()}
        className="min-w-2/3 min-h-3/4 max-h-3/4 flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>Import categories</DialogTitle>
        </DialogHeader>
        {rawCategories ? (
          <div className="[&>div]:max-h-96 border border-base-300 rounded-md">
            <Table className="[&_td]:border-border [&_th]:border-border border-separate border-spacing-0 [&_tfoot_td]:border-t [&_th]:border-b [&_tr]:border-none [&_tr:not(:last-child)_td]:border-b">
              <TableHeader className="bg-background/90 sticky top-0 z-10 backdrop-blur-xs">
                <TableRow className="bg-muted/50">
                  <TableHead className="h-9 py-2">Name</TableHead>
                  <TableHead className="h-9 py-2">Description</TableHead>
                  <TableHead className="h-9 py-2">Parent</TableHead>
                  <TableHead className="h-9 py-2">Color</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="py-2 font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell className="py-2">
                      {category.description}
                    </TableCell>
                    <TableCell className="py-2">{category.parentId}</TableCell>
                    <TableCell className="py-2">{category.color}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div
            className="flex-1 bg-base-200 rounded-md flex flex-col items-center justify-center gap-4 cursor-pointer border-dashed border-2 border-base-300"
            onClick={selectFile}
          >
            <FileUp className="w-16 h-16 text-primary" />
            <p>Drop a file here or click to upload</p>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isImporting}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={() => importCategories()} disabled={isImporting}>
            {isImporting && <Loader2 className="animate-spin" />}
            Import {rawCategories?.length ?? ""} categories
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
