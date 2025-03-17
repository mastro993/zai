import { NewTransactionCategory } from "@/features/transaction-category/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { z, ZodType } from "zod";
import { useTransactionCategories } from "../api/useTransactionCategories";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";

export const TransactionCategorySchema: ZodType<NewTransactionCategory> =
  z.object({
    name: z.string(),
    color: z.string().optional(),
    icon: z.string().optional(),
    parent_id: z.coerce
      .number()
      .transform((val) => (val < 0 ? undefined : val))
      .optional(),
    description: z.string().optional(),
  });

type TransactionCategoryFormProps = {
  onSubmit: SubmitHandler<NewTransactionCategory>;
  onClose: () => void;
};

export const TransactionCategoryForm = ({
  onSubmit,
  onClose,
}: TransactionCategoryFormProps) => {
  const { data: transactionCategories } = useTransactionCategories();

  const { handleSubmit, register, watch } = useForm<NewTransactionCategory>({
    resolver: zodResolver(TransactionCategorySchema),
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
      {/* <input
        {...register("color")}
        placeholder="Color"
        className="input w-full"
        pattern="#[0-9a-fA-F]{6}"
      /> */}
      <fieldset className="fieldset">
        <legend className="fieldset-legend">Preview</legend>
        <div className="box bg-base-200 p-12 rounded-md flex justify-center ">
          <TransactionCategoryBadge name={watch("name") || "New category"} />
        </div>
      </fieldset>
      <div className="modal-action">
        <button type="submit" className="btn btn-primary">
          Save
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </form>
  );
};
