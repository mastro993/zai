import { Select } from "@/components/Select";
import { InjectedModalProps, Modal } from "@/components/widgets/Modal";
import {
  NewTransactionCategory,
  TransactionCategory,
  TransactionCategoryColor,
  TransactionCategoryColors,
} from "@/features/transaction-category/schema";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z, ZodType } from "zod";
import { useAvailableParentTransactionCategories } from "../api/useAvailableParentTransactionCategories";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";

export const TRANSACTION_CATEGORY_FORM_MODAL_ID =
  "transaction-category-form-modal";

export const TransactionCategorySchema: ZodType<NewTransactionCategory> =
  z.object({
    name: z.string().nonempty(),
    color: z.enum(TransactionCategoryColors),
    parent_id: z.coerce.number().optional().nullable(),
    description: z.string().optional(),
  });

type TransactionCategoryFormProps = InjectedModalProps & {
  category?: TransactionCategory;
  onSubmit: (data: NewTransactionCategory) => void;
};

export const TransactionCategoryFormModal = (
  props: TransactionCategoryFormProps
) => {
  const { data: transactionCategories } =
    useAvailableParentTransactionCategories();

  const { handleSubmit, register, watch, control, setValue } =
    useForm<NewTransactionCategory>({
      resolver: zodResolver(TransactionCategorySchema),
      defaultValues: {
        name: props.category?.name,
        description: props.category?.description,
        color: props.category?.color ?? "neutral",
        parent_id: props.category?.parent_id,
      },
    });

  const onSubmit = (data: NewTransactionCategory) => {
    props.onSubmit(data);
    props.onDismiss?.();
  };

  const parentCategoryId = useWatch({
    control,
    name: "parent_id",
  });

  useEffect(() => {
    if (parentCategoryId) {
      const parentCategory = transactionCategories?.find(
        (category) => category.id === parentCategoryId
      );
      if (parentCategory) {
        setValue("color", parentCategory.color);
      }
    }
  }, [parentCategoryId]);

  const parentCategoryOptions =
    transactionCategories
      ?.map((transactionCategory) => ({
        label: transactionCategory.name,
        value: transactionCategory.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)) ?? [];

  return (
    <Modal title="New category" {...props}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex gap-2">
          <input
            {...register("name")}
            placeholder="Name"
            className="input w-full"
            autoFocus
          />
        </div>
        <Controller
          name="parent_id"
          control={control}
          render={({ field }) => (
            <Select
              options={parentCategoryOptions}
              placeholder="Select parent"
              onChange={(value) => {
                const selectedValue = value as { value: number } | null;
                field.onChange(selectedValue?.value ?? null);
              }}
              value={parentCategoryOptions.find(
                (option) => option.value === field.value
              )}
              isClearable
              isSearchable
              unstyled
            />
          )}
        />

        <label className="input w-full">
          <input {...register("description")} placeholder="Description" />
          <span className="badge badge-soft badge-xs">Optional</span>
        </label>
        <div className="grid grid-cols-9 gap-1">
          {TransactionCategoryColors.map((color) => (
            <input
              key={color}
              {...register("color")}
              type="radio"
              name="color"
              value={color}
              className={cn(
                ["btn btn-square border-4 rounded-md"],
                colorRadioClassByVariants[color]
              )}
            />
          ))}
        </div>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Preview</legend>
          <div className="box bg-base-200 p-12 rounded-md flex justify-center border-base-300 border-1">
            <TransactionCategoryBadge
              category={{
                name: watch("name") || "New category",
                color: watch("color") || "neutral",
                parent: null,
              }}
            />
          </div>
        </fieldset>
        <div className="flex gap-2 justify-end">
          <button
            className="btn btn-soft"
            type="reset"
            onClick={props.onDismiss}
          >
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
};

const colorRadioClassByVariants: {
  [color in TransactionCategoryColor]: string;
} = {
  red: "bg-red-500 checked:border-red-300",
  orange: "bg-orange-500 checked:border-orange-300",
  amber: "bg-amber-500 checked:border-amber-300",
  yellow: "bg-yellow-500 checked:border-yellow-300",
  lime: "bg-lime-500 checked:border-lime-300",
  green: "bg-green-500 checked:border-green-300",
  emerald: "bg-emerald-500 checked:border-emerald-300",
  teal: "bg-teal-500 checked:border-teal-300",
  cyan: "bg-cyan-500 checked:border-cyan-300",
  sky: "bg-sky-500 checked:border-sky-300",
  blue: "bg-blue-500 checked:border-blue-300",
  indigo: "bg-indigo-500 checked:border-indigo-300",
  violet: "bg-violet-500 checked:border-violet-300",
  purple: "bg-purple-500 checked:border-purple-300",
  fuchsia: "bg-fuchsia-500 checked:border-fuchsia-300",
  pink: "bg-pink-500 checked:border-pink-300",
  rose: "bg-rose-500 checked:border-rose-300",
  neutral: "bg-neutral-500 checked:border-neutral-300",
};
