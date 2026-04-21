import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { shouldUseDarkForeground } from "@/utils/color";
import {
  Button,
  Chip,
  cn,
  Input,
  ListBox,
  Modal,
  Radio,
  RadioGroup,
  Select,
  TextArea,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useCreateTransactionCategoryMutation } from "../mutations/useCreateTransactionCategoryMutation";
import { useParentTransactionCategories } from "../queries/useParentTransactionCategories";
import type {
  NewTransactionCategory,
  TransactionCategory,
  TransactionCategoryColor,
} from "../types";
import { TransactionCategoryColorSchema } from "../types";
import {
  getTransactionCategoryPaletteColor,
  transactionCategoryPaletteOptions,
} from "../utils/colorUtils";

export type TransactionCategoryFormDialogProps = {
  category?: TransactionCategory;
  onSubmit?: (data: NewTransactionCategory) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
};

export const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().nonempty({ message: "Name is required" }),
  color: TransactionCategoryColorSchema.optional(),
  parentId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

type TransactionCategoryFormValues = z.infer<typeof formSchema>;

const getDefaultValues = (category?: TransactionCategory): TransactionCategoryFormValues => ({
  id: category?.id,
  name: category?.name ?? "",
  description: category?.description ?? undefined,
  color: category?.parentId ? undefined : getTransactionCategoryPaletteColor(category?.color),
  parentId: category?.parentId ?? null,
});

function getSubmittedColor(
  color: TransactionCategoryFormValues["color"],
  parentId: string | null | undefined,
  transactionCategories?: TransactionCategory[],
) {
  if (parentId) {
    return transactionCategories?.find((category) => category.id === parentId)?.color;
  }

  return getTransactionCategoryPaletteColor(color);
}

export function TransactionCategoryFormDialog({
  category,
  onSubmit: onSubmitProp,
  isOpen,
  onOpenChange,
  onClose: _onClose,
}: TransactionCategoryFormDialogProps) {
  const { data: transactionCategories } = useParentTransactionCategories(category?.id);
  const { mutate: addTransactionCategory } = useCreateTransactionCategoryMutation();

  const form = useForm<TransactionCategoryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(category),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(getDefaultValues(category));
    }
  }, [category, form, isOpen]);

  const parentCategoryId = useWatch({
    control: form.control,
    name: "parentId",
  });

  const selectedColor = useWatch({
    control: form.control,
    name: "color",
  });

  const hasParent = !!parentCategoryId;
  const selectedParentCategory = useMemo(
    () => transactionCategories?.find((parentCategory) => parentCategory.id === parentCategoryId),
    [parentCategoryId, transactionCategories],
  );

  useEffect(() => {
    if (!parentCategoryId || !transactionCategories) {
      return;
    }

    const parentStillAvailable = transactionCategories.some(
      (parentCategory) => parentCategory.id === parentCategoryId,
    );

    if (!parentStillAvailable) {
      form.setValue("parentId", null);
    }
  }, [form, parentCategoryId, transactionCategories]);

  const previewColor =
    selectedParentCategory?.color ?? getTransactionCategoryPaletteColor(selectedColor);
  const title = useMemo(() => (category ? "Edit category" : "New category"), [category]);

  const onSubmit = (data: TransactionCategoryFormValues) => {
    const submittedData: NewTransactionCategory = {
      ...data,
      color: getSubmittedColor(data.color, data.parentId, transactionCategories),
    };

    if (category && submittedData.parentId === category.id) {
      return;
    }

    if (onSubmitProp) {
      onSubmitProp(submittedData);
    } else {
      addTransactionCategory(submittedData);
    }

    onOpenChange?.(false);
  };

  return (
    <Form {...form}>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-2">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {transactionCategories && transactionCategories.length > 0 ? (
                  <FormField
                    control={form.control}
                    name="parentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent</FormLabel>
                        <FormControl>
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <Select
                                selectedKey={field.value ?? null}
                                onSelectionChange={(key) =>
                                  field.onChange(key ? String(key) : null)
                                }
                                placeholder="Select category"
                              >
                                <Select.Trigger>
                                  <Select.Value />
                                  <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                  <ListBox>
                                    {transactionCategories.map((parentCategory) => (
                                      <ListBox.Item
                                        key={parentCategory.id}
                                        id={parentCategory.id}
                                        textValue={parentCategory.name}
                                      >
                                        {parentCategory.name}
                                        <ListBox.ItemIndicator />
                                      </ListBox.Item>
                                    ))}
                                  </ListBox>
                                </Select.Popover>
                              </Select>
                            </div>
                            {field.value ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onPress={() => field.onChange(null)}
                                className="text-foreground/60"
                              >
                                Clear
                              </Button>
                            ) : null}
                          </div>
                        </FormControl>
                        <FormDescription>Leave empty to create a root category.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Name<span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="New category" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <TextArea
                          placeholder="Description"
                          {...field}
                          value={field.value ?? undefined}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid gap-1">
                          <FormLabel>Color</FormLabel>
                          <FormDescription>
                            {hasParent
                              ? "Child categories use the parent color automatically."
                              : "Choose one of the configured category colors."}
                          </FormDescription>
                        </div>
                      </div>

                      {hasParent ? (
                        <InheritedColorCard
                          parentName={selectedParentCategory?.name}
                          color={previewColor}
                        />
                      ) : (
                        <FormControl>
                          <RadioGroup
                            className="grid gap-1 xs:grid-cols-4 sm:grid-cols-8"
                            value={field.value ?? undefined}
                            onChange={field.onChange}
                          >
                            {transactionCategoryPaletteOptions.map((option) => (
                              <TransactionCategoryColorRadioItem
                                key={option.id}
                                color={option.color}
                              />
                            ))}
                          </RadioGroup>
                        </FormControl>
                      )}

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-2">
                  <Button type="submit" className="w-full">
                    {category ? "Save changes" : "Create category"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onPress={() => onOpenChange?.(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Form>
  );
}

const InheritedColorCard = ({ color, parentName }: { color?: string; parentName?: string }) => {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-default-300 bg-default-50 p-4">
      <div className="grid gap-1">
        <p className="text-sm font-medium text-foreground">
          {parentName ? `Inherited from ${parentName}` : "Inherited from parent"}
        </p>
        <p className="text-sm text-foreground/60">
          {color ?? "The selected parent does not have a color yet."}
        </p>
      </div>
      <ColorPreviewChip color={color} label={parentName ?? "Inherited"} />
    </div>
  );
};

const ColorPreviewChip = ({ color, label }: { color?: string; label: string }) => {
  if (!color) {
    return (
      <Chip
        size="lg"
        className="rounded-full border-1 border-default-300 bg-default-100 text-default-700"
      >
        <Chip.Label>{label}</Chip.Label>
      </Chip>
    );
  }

  const useDarkForeground = shouldUseDarkForeground(color);

  return (
    <Chip
      size="lg"
      className="rounded-full border-1 border-black/20"
      style={{
        backgroundColor: color,
        color: useDarkForeground ? "#111827" : "#FFFFFF",
      }}
    >
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
};

const TransactionCategoryColorRadioItem = ({ color }: { color: TransactionCategoryColor }) => {
  const useDarkForeground = shouldUseDarkForeground(color);
  return (
    <Radio
      value={color}
      aria-label={color}
      className={cn([
        "aspect-square rounded-xl p-1 shadow-none transition-colors m-0",
        `opacity-50 data-[selected=true]:opacity-100`,
        "border-2 border-transparent data-[selected=true]:border-black/20",
      ])}
      style={{ backgroundColor: color }}
    >
      <Radio.Control className="h-full w-full bg-transparent shadow-none">
        <Radio.Indicator
          className={cn([
            "absolute inset-0 flex items-center justify-center",
            useDarkForeground ? "text-black/50" : "text-white/90",
          ])}
        >
          {({ isSelected }) => (isSelected ? <Icon icon={Tick01Icon} strokeWidth={3} /> : <div />)}
        </Radio.Indicator>
      </Radio.Control>
      <Radio.Content className="sr-only">
        <span>{color}</span>
      </Radio.Content>
    </Radio>
  );
};
