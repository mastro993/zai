import { InjectedModalProps, Modal } from "@/components/widgets/Modal";
import {
  NewTransactionCategory,
  TransactionCategory,
  TransactionCategoryColor,
  TransactionCategoryColors,
} from "@/features/transaction-category/schema";
import { cn } from "@/utils/style";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useHotkeys } from "react-hotkeys-hook";
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

type TransactionCategoryFormProps = InjectedModalProps & {
  category?: TransactionCategory;
  onSubmit: (data: NewTransactionCategory) => void;
};

export const TransactionCategoryFormModal = (
  props: TransactionCategoryFormProps
) => {
  const { data: transactionCategories } = useTransactionCategories();

  const { handleSubmit, register, watch } = useForm<NewTransactionCategory>({
    resolver: zodResolver(TransactionCategorySchema),
    defaultValues: {
      name: props.category?.name,
      description: props.category?.description,
      color: props.category?.color ?? "neutral",
      icon: props.category?.icon,
      parent_id: props.category?.parent_id,
    },
  });

  const onSubmit = (data: NewTransactionCategory) => {
    props.onSubmit(data);
    props.onDismiss?.();
  };

  useHotkeys("Escape", () => {
    props.onDismiss?.();
  });

  return (
    <Modal title="New category" {...props}>
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
        <div className="grid grid-cols-9 gap-1">
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
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Preview</legend>
          <div className="box bg-base-200 p-12 rounded-md flex justify-center ">
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
};
