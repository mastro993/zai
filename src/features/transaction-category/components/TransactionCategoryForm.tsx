import {
  NewTransactionCategory,
  TransactionCategory,
  TransactionCategoryColor,
  TransactionCategoryColors,
} from "@/features/transaction-category/schema";
import { cn } from "@/utils/style";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { z, ZodType } from "zod";
import { useTransactionCategories } from "../api/useTransactionCategories";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";

export const TransactionCategorySchema: ZodType<NewTransactionCategory> =
  z.object({
    name: z.string().nonempty(),
    color: z.enum(TransactionCategoryColors),
    icon: z.string().optional(),
    parent_id: z.coerce
      .number()
      .transform((val) => (val < 0 ? undefined : val))
      .optional(),
    description: z.string().optional(),
  });

type TransactionCategoryFormProps = {
  onSubmit: SubmitHandler<NewTransactionCategory>;
  onClose?: () => void;
  category?: TransactionCategory;
};

export const TransactionCategoryForm = ({
  onSubmit,
  onClose,
  category,
}: TransactionCategoryFormProps) => {
  const { data: transactionCategories } = useTransactionCategories();

  const { handleSubmit, register, watch } = useForm<NewTransactionCategory>({
    resolver: zodResolver(TransactionCategorySchema),
    defaultValues: {
      name: category?.name,
      parent_id: category?.parent_id,
      description: category?.description,
      color: category?.color || "white",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex gap-2">
        {/*  <input {...register("icon")} placeholder="Icon" className="input" /> */}
        <input
          {...register("name")}
          placeholder="Name"
          className="input w-full"
        />
      </div>
      <select {...register("parent_id")} className="select w-full">
        <option value={-1}>Select parent</option>
        {transactionCategories?.map((transactionCategory) => (
          <option key={transactionCategory.id} value={transactionCategory.id}>
            {transactionCategory.name}
          </option>
        ))}
      </select>
      <label className="input w-full">
        <input {...register("description")} placeholder="Description" />
        <span className="badge badge-soft badge-xs">Optional</span>
      </label>
      <div className="flex gap-2">
        {TransactionCategoryColors.map((color) => (
          <input
            {...register("color")}
            type="radio"
            name="color"
            value={color}
            className={cn(
              ["btn btn-sm btn-square"],
              colorRadioClassByVariants[color]
            )}
          />
        ))}
      </div>
      {/* <input
        {...register("color")}
        placeholder="Color"
        className="input w-full"
        pattern="#[0-9a-fA-F]{6}"
      /> */}
      <fieldset className="fieldset">
        <legend className="fieldset-legend">Preview</legend>
        <div className="box bg-base-200 p-12 rounded-md flex justify-center ">
          <TransactionCategoryBadge
            key={"category-badge-preview-" + watch("color")}
            name={watch("name") || "New category"}
            color={watch("color") || "white"}
          />
        </div>
      </fieldset>
      <div className="modal-action">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </div>
    </form>
  );
};

const colorRadioClassByVariants: {
  [color in TransactionCategoryColor]: string;
} = {
  white: "bg-white",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};
