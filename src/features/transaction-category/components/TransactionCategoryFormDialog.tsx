import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Button,
  Input,
  ListBox,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Textarea,
  cn,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { Form, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useCreateTransactionCategoryMutation } from "../mutations/useCreateTransactionCategoryMutation";
import { useParentTransactionCategories } from "../queries/useParentTransactionCategories";
import type {
  NewTransactionCategory,
  TransactionCategory,
  TransactionCategoryColor,
} from "../types";
import { TransactionCategoryColors } from "../types";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";

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
  const { data: transactionCategories } = useParentTransactionCategories();
  const { mutate: addTransactionCategory } = useCreateTransactionCategoryMutation();

  const onSubmit = (data: NewTransactionCategory) => {
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
      color: category?.color ?? "neutral",
      parentId: category?.parentId,
    },
  });

  const parentCategoryId = useWatch({
    control: form.control,
    name: "parentId",
  });

  useEffect(() => {
    if (parentCategoryId) {
      const parentCategory = transactionCategories?.find((cat) => cat.id === parentCategoryId);
      if (parentCategory) {
        form.setValue("color", parentCategory.color);
      }
    }
  }, [parentCategoryId, transactionCategories, form]);

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
                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent</FormLabel>
                      <FormControl>
                        <Select
                          selectedKey={field.value ?? null}
                          onSelectionChange={(key) => field.onChange(key ? String(key) : null)}
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                        <Textarea
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
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <RadioGroup
                          className="grid grid-cols-11 gap-4"
                          value={field.value ?? "neutral"}
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
                      <TransactionCategoryBadge
                        category={{
                          name: form.watch("name") || "New category",
                          color: form.watch("color") || "neutral",
                        }}
                      />
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

const colorRadioClasses: Record<TransactionCategoryColor, string> = {
  red: "bg-red-700 border-red-800",
  orange: "bg-orange-700 border-orange-800",
  yellow: "bg-yellow-700 border-yellow-800",
  green: "bg-green-700 border-green-800",
  teal: "bg-teal-700 border-teal-800",
  sky: "bg-sky-700 border-sky-800",
  blue: "bg-blue-700 border-blue-800",
  indigo: "bg-indigo-700 border-indigo-800",
  purple: "bg-purple-700 border-purple-800",
  pink: "bg-pink-700 border-pink-800",
  neutral: "bg-neutral-700 border-neutral-800",
  "red-soft": "bg-red-200 border-red-300",
  "orange-soft": "bg-orange-200 border-orange-300",
  "yellow-soft": "bg-yellow-200 border-yellow-300",
  "green-soft": "bg-green-200 border-green-300",
  "teal-soft": "bg-teal-200 border-teal-300",
  "sky-soft": "bg-sky-200 border-sky-300",
  "blue-soft": "bg-blue-200 border-blue-300",
  "indigo-soft": "bg-indigo-200 border-indigo-300",
  "purple-soft": "bg-purple-200 border-purple-300",
  "pink-soft": "bg-pink-200 border-pink-300",
  "neutral-soft": "bg-neutral-200 border-neutral-300",
};

const TransactionCategoryColorRadioItem = ({ color }: { color: TransactionCategoryColor }) => {
  return (
    <Radio
      value={color}
      aria-label={color}
      className={cn("size-8 rounded-md shadow-none", colorRadioClasses[color])}
    >
      <Radio.Control>
        <Radio.Indicator />
      </Radio.Control>
    </Radio>
  );
};
