import { importFromFile } from "@/lib/file-processor";
import { Button, Modal, Table } from "@heroui/react";
import { Result } from "@praha/byethrow";
import { Download01Icon, LoaderPinwheelIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import { useCallback, useEffect, useState } from "react";
import { shouldUseDarkForeground } from "@/utils/color";
import { useImportTransactionCategoriesMutation } from "../mutations/useImportTransactionCategoriesMutation";
import type { NewTransactionCategories } from "../types";
import { TransactionCategoriesSchema } from "../types";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
};

export const TransactionCategoryImportModal = ({ isOpen, onOpenChange, onClose }: Props) => {
  const [rawCategories, setRawCategories] = useState<NewTransactionCategories>();

  const {
    mutate: importCategoriesMutation,
    isPending: isImportPending,
    isSuccess,
  } = useImportTransactionCategoriesMutation();

  useEffect(() => {
    if (isSuccess) {
      setRawCategories(undefined);
      onOpenChange(false);
    }
  }, [isSuccess, onOpenChange]);

  const importCategories = useCallback(() => {
    if (rawCategories) {
      importCategoriesMutation(rawCategories);
    }
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
              parent: category.parentId ? data.find((c) => c.id === category.parentId) : undefined,
            };
          });
        }),
        Result.map(setRawCategories),
      ),
    [],
  );

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Import categories</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {rawCategories ? (
              <RawCategoriesTable categories={rawCategories} />
            ) : (
              <div
                className="flex-1 bg-base-200 rounded-md flex flex-col items-center justify-center gap-4 cursor-pointer border-dashed border-2 border-base-300"
                onClick={selectFile}
              >
                <Icon icon={Download01Icon} className="w-16 h-16 text-primary" />
                <p>Drop a file here or click to upload</p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              isDisabled={isImportPending}
              onPress={onClose ?? (() => onOpenChange(false))}
            >
              Cancel
            </Button>
            <Button
              onPress={() => importCategories()}
              isDisabled={isImportPending || !rawCategories}
            >
              {isImportPending && <Icon icon={LoaderPinwheelIcon} className="animate-spin" />}
              Import {rawCategories?.length ?? ""} categories
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};

const RawCategoriesTable = ({ categories }: { categories: NewTransactionCategories }) => {
  return (
    <div className="flex-1 min-h-0 flex flex-col rounded-md overflow-auto">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Categories to import">
            <Table.Header>
              <Table.Column isRowHeader>Name</Table.Column>
              <Table.Column>Parent</Table.Column>
              <Table.Column>Description</Table.Column>
              <Table.Column>Color</Table.Column>
            </Table.Header>
            <Table.Body>
              {categories.map((category) => {
                const parent = categories.find((c) => c.id === category.parentId);
                return (
                  <Table.Row key={category.id}>
                    <Table.Cell>{category.name}</Table.Cell>
                    <Table.Cell>{parent?.name}</Table.Cell>
                    <Table.Cell>{category.description}</Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        {category.color ? (
                          <>
                            <div
                              className="flex h-6 w-6 items-center justify-center rounded border border-default-300"
                              style={{ backgroundColor: category.color }}
                              aria-hidden="true"
                            />
                            <span
                              className="rounded px-2 py-1 font-mono text-xs"
                              style={{
                                backgroundColor: category.color,
                                color: shouldUseDarkForeground(category.color)
                                  ? "#111827"
                                  : "#FFFFFF",
                              }}
                            >
                              {category.color}
                            </span>
                          </>
                        ) : (
                          <>
                            <div
                              className="flex h-6 w-6 items-center justify-center rounded border border-dashed border-default-300 bg-default-100"
                              aria-hidden="true"
                            />
                            <span className="rounded border border-default-300 px-2 py-1 text-xs text-default-600">
                              No color
                            </span>
                          </>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
};
