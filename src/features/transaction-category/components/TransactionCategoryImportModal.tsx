import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { importFromFile } from "@/lib/file-processor";
import {
  Button,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { Result } from "@praha/byethrow";
import { Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useImportTransactionCategoriesMutation } from "../mutations/useImportTransactionCategoriesMutation";
import {
  NewTransactionCategories,
  TransactionCategoriesSchema,
} from "../types";

type Props = Pick<
  React.ComponentProps<typeof Modal>,
  "isOpen" | "onOpenChange" | "onClose"
>;

export const TransactionCategoryImportModal = (modalProps: Props) => {
  const [rawCategories, setRawCategories] =
    useState<NewTransactionCategories>();

  const {
    mutate: importCategoriesMutation,
    isPending: isImportPending,
    isSuccess,
  } = useImportTransactionCategoriesMutation();

  useEffect(() => {
    if (isSuccess) {
      setRawCategories(undefined);
      modalProps.onOpenChange?.(false);
    }
  }, [isSuccess, modalProps]);

  const importCategories = useCallback(() => {
    if (rawCategories) {
      importCategoriesMutation(rawCategories);
    }
  }, [rawCategories, importCategoriesMutation]);

  const clear = useCallback(() => {
    setRawCategories(undefined);
  }, [rawCategories, importCategoriesMutation]);

  const selectFile = useCallback(
    () =>
      Result.pipe(
        importFromFile(),
        Result.andThen(Result.parse(TransactionCategoriesSchema)),
        Result.map((data) => {
          return data.map((category) => {
            return {
              ...category,
              parent: category.parentId
                ? data.find((c) => c.id === category.parentId)
                : undefined,
            };
          });
        }),
        Result.map(setRawCategories),
      ),
    [],
  );

  return (
    <Modal {...modalProps}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Import categories
        </ModalHeader>
        {rawCategories ? (
          <RawCategoriesTable categories={rawCategories} />
        ) : (
          <div
            className="flex-1 bg-base-200 rounded-md flex flex-col items-center justify-center gap-4 cursor-pointer border-dashed border-2 border-base-300"
            onClick={selectFile}
          >
            <Download className="w-16 h-16 text-primary" />
            <p>Drop a file here or click to upload</p>
          </div>
        )}
        <ModalFooter>
          <Button
            type="button"
            color="secondary"
            disabled={isImportPending}
            onPress={modalProps.onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={() => importCategories()}
            disabled={isImportPending || !rawCategories}
          >
            {isImportPending && <Loader2 className="animate-spin" />}
            Import {rawCategories?.length ?? ""} categories
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const RawCategoriesTable = ({
  categories,
}: {
  categories: NewTransactionCategories;
}) => {
  return (
    <div className="flex-1 min-h-0 flex flex-col border border-base-300 rounded-md overflow-auto">
      <Table className="flex-1 min-h-0 [&_td]:border-border [&_th]:border-border border-separate border-spacing-0 [&_tfoot_td]:border-t [&_th]:border-b [&_tr]:border-none [&_tr:not(:last-child)_td]:border-b">
        <TableHeader className="bg-background/90 sticky top-0 z-10 backdrop-blur-xs">
          <TableRow className="bg-muted/50">
            <TableHead className="h-9 py-2">Name</TableHead>
            <TableHead className="h-9 py-2">Parent</TableHead>
            <TableHead className="h-9 py-2">Description</TableHead>
            <TableHead className="h-9 py-2">Color</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => {
            const parent = categories.find((c) => c.id === category.parentId);

            return (
              <TableRow key={category.id}>
                <TableCell className="py-2 font-medium">
                  {category.name}
                </TableCell>
                <TableCell className="py-2 italic">{parent?.name}</TableCell>
                <TableCell className="py-2">{category.description}</TableCell>
                <TableCell className="py-2">{category.color}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
