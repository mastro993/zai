import { NewTransactionCategory } from "@/features/transaction-category/schema";
import { SubmitHandler, useForm } from "react-hook-form";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";

type TransactionCategoryFormProps = {
  onSubmit: SubmitHandler<NewTransactionCategory>;
  onClose: () => void;
};

export const TransactionCategoryForm = ({
  onSubmit,
  onClose,
}: TransactionCategoryFormProps) => {
  const { handleSubmit, register, watch } = useForm<NewTransactionCategory>({
    defaultValues: {
      name: "New category",
      description: "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex gap-2">
        {/*  <input {...register("icon")} placeholder="Icon" className="input" /> */}
        <input
          {...register("name")}
          placeholder="Name"
          className="input  w-full"
        />
      </div>
      {/* <select {...register("parent_id")} className="select w-full">
        {transactionCategories?.map((transactionCategory) => (
          <option key={transactionCategory.id} value={transactionCategory.id}>
            {transactionCategory.name}
          </option>
        ))}
      </select> */}
      <input
        {...register("description")}
        placeholder="Description"
        className="input  w-full"
      />
      {/* <input
        {...register("color")}
        placeholder="Color"
        className="input w-full"
        pattern="#[0-9a-fA-F]{6}"
      /> */}
      <div className="box bg-base-200 p-12 rounded-md flex justify-center ">
        <TransactionCategoryBadge name={watch("name")} />
      </div>
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
