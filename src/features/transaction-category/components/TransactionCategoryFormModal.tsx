import { Modal } from "@/components/layout/Modal";
import {
  NewTransactionCategory,
  TransactionCategoryColor,
  TransactionCategoryColors,
} from "@/features/transaction-category/schema";
import { closeModal } from "@/utils/modal";
import { cn } from "@/utils/style";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z, ZodType } from "zod";
import { useTransactionCategories } from "../api/useTransactionCategories";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";

export const TRANSACTION_CATEGORY_FORM_MODAL_ID =
  "transaction-category-form-modal";

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
  onSubmit: (data: NewTransactionCategory) => void;
};

export const TransactionCategoryFormModal = (
  props: TransactionCategoryFormProps
) => {
  const { data: transactionCategories } = useTransactionCategories();

  const { handleSubmit, register, watch, reset } =
    useForm<NewTransactionCategory>({
      resolver: zodResolver(TransactionCategorySchema),
      defaultValues: {},
    });

  const onSubmit = (data: NewTransactionCategory) => {
    props.onSubmit(data);
    reset();
  };

  return (
    <Modal id={TRANSACTION_CATEGORY_FORM_MODAL_ID} title="New category">
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
        <div className="grid grid-cols-10 gap-1">
          {TransactionCategoryColors.map((color) => (
            <input
              {...register("color")}
              type="radio"
              name="color"
              value={color}
              className={cn(
                ["btn btn-square"],
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
              category={{
                name: watch("name") || "New category",
                color: watch("color") || "white",
                parent: null,
              }}
            />
          </div>
        </fieldset>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => closeModal(TRANSACTION_CATEGORY_FORM_MODAL_ID)}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
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
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-500",
  lime: "bg-lime-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  purple: "bg-purple-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
  neutral: "bg-neutral-500",
  black: "bg-black",
  white: "bg-white",
};
