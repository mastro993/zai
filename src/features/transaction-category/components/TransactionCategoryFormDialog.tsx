import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Button,
  Chip,
  Input,
  ListBox,
  Modal,
  Radio,
  RadioGroup,
  Select,
  TextArea,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { TransactionCategoryColors } from "../types";
import { getColorHsl } from "../utils/colorUtils";

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
  color: z.enum(TransactionCategoryColors),
  parentId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export function TransactionCategoryFormDialog({
  category,
  onSubmit: onSubmitProp,
  isOpen,
  onOpenChange,
  onClose: _onClose,
}: TransactionCategoryFormDialogProps) {
  const { data: transactionCategories } = useParentTransactionCategories(category?.id);
  const { mutate: addTransactionCategory } = useCreateTransactionCategoryMutation();

  const onSubmit = (data: NewTransactionCategory) => {
    // Prevent self-reference
    if (category && data.parentId === category.id) {
      // This shouldn't happen with validation, but be safe
      return;
    }

    if (onSubmitProp) {
      onSubmitProp(data);
    } else {
      addTransactionCategory(data);
    }
    onOpenChange?.(false);
  };

  const form = useForm<NewTransactionCategory>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: category?.id,
      name: category?.name,
      description: category?.description,
      color: category?.color ?? "red",
      parentId: category?.parentId,
    },
  });

  const parentCategoryId = useWatch({
    control: form.control,
    name: "parentId",
  });

  const categoryId = useWatch({
    control: form.control,
    name: "id",
  });

  // Determine if we're creating a child (when parent is selected) or parent
  const isChild = !!parentCategoryId;

  useEffect(() => {
    if (parentCategoryId) {
      const parentCategory = transactionCategories?.find((cat) => cat.id === parentCategoryId);
      if (parentCategory && categoryId) {
        // For child categories: set color to parent's base color
        form.setValue("color", parentCategory.color);
      }
    }
  }, [parentCategoryId, categoryId, transactionCategories, form]);

  useEffect(() => {
    // Clear parentId if it's no longer available (e.g., all categories were excluded during edit)
    if (parentCategoryId && (!transactionCategories || transactionCategories.length === 0)) {
      form.setValue("parentId", null);
    }
  }, [transactionCategories, parentCategoryId, form]);

  const title = useMemo(() => (category ? "Edit category" : "New category"), [category]);

  return (
    <Form {...form}>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {transactionCategories && transactionCategories.length > 0 && (
                  <FormField
                    control={form.control}
                    name="parentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent</FormLabel>
                        <FormControl>
                          <div className="flex gap-2 items-end">
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
                                    {transactionCategories?.map((cat) => (
                                      <ListBox.Item key={cat.id} id={cat.id} textValue={cat.name}>
                                        {cat.name}
                                        <ListBox.ItemIndicator />
                                      </ListBox.Item>
                                    ))}
                                  </ListBox>
                                </Select.Popover>
                              </Select>
                            </div>
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onPress={() => field.onChange(null)}
                                className="text-foreground/60"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
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
                    <FormItem>
                      <FormLabel>Color{isChild && " (Auto-derived from parent)"}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          className="grid grid-cols-8 gap-4"
                          value={field.value ?? "red"}
                          onChange={field.onChange}
                        >
                          {TransactionCategoryColors.map((color) => (
                            <TransactionCategoryColorRadioItem key={color} color={color} />
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>Preview</FormLabel>
                  <FormControl>
                    <div className="flex justify-center bg-sidebar p-12 rounded-md border-1 border-dashed">
                      <Chip
                        variant="primary"
                        className="rounded-full border-2 border-black/30"
                        style={{ backgroundColor: getColorHsl(form.watch("color") || "red") }}
                      >
                        <Chip.Label>Default</Chip.Label>
                      </Chip>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>

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

const TransactionCategoryColorRadioItem = ({ color }: { color: TransactionCategoryColor }) => {
  const bgColor = getColorHsl(color);

  return (
    <Radio
      value={color}
      aria-label={color}
      className="size-8 rounded-md shadow-none "
      style={{
        backgroundColor: bgColor,
        borderRadius: 8,
      }}
    >
      <Radio.Control>
        <Radio.Indicator />
      </Radio.Control>
    </Radio>
  );
};
