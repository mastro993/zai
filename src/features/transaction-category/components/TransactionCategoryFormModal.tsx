import { InjectedModalProps, Modal } from "@/components/Modal";
import {
  NewTransactionCategory,
  TransactionCategory,
  TransactionCategoryColors,
} from "@/features/transaction-category/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Flex, Grid } from "@radix-ui/themes";
import { useController, UseControllerProps, useForm } from "react-hook-form";
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

  const { handleSubmit, register, watch, control } =
    useForm<NewTransactionCategory>({
      resolver: zodResolver(TransactionCategorySchema),
      defaultValues: {
        name: props.category?.name,
        description: props.category?.description,
        color: props.category?.color ?? "gray",
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
    <Modal title="New categordy">
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
        <ColorPicker control={control} name="color" />
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
        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" color="gray" onClick={props.onDismiss}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </Flex>
      </form>
    </Modal>
  );
};

const ColorPicker = (props: UseControllerProps<NewTransactionCategory>) => {
  const { field } = useController(props);

  return (
    <Grid columns={"9"} gap={"2"}>
      {TransactionCategoryColors.map((color) => (
        <Button
          type="button"
          key={color}
          variant={field.value === color ? "solid" : "soft"}
          color={color}
          onClick={() => field.onChange(color)}
        />
      ))}
    </Grid>
  );
};
