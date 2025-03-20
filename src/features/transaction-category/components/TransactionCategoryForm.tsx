import {
  NewTransactionCategory,
  TransactionCategory,
  TransactionCategoryColors,
} from "@/features/transaction-category/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Dialog, Flex, Grid } from "@radix-ui/themes";
import {
  SubmitHandler,
  useController,
  UseControllerProps,
  useForm,
} from "react-hook-form";
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

  const { handleSubmit, register, watch, control } =
    useForm<NewTransactionCategory>({
      resolver: zodResolver(TransactionCategorySchema),
      defaultValues: {
        name: category?.name,
        parent_id: category?.parent_id ?? -1,
        description: category?.description,
        color: category?.color,
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
      <ColorPicker control={control} name="color" />
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
      <Flex gap="3" mt="4" justify="end">
        <Dialog.Close>
          <Button variant="soft" color="gray">
            Cancel
          </Button>
        </Dialog.Close>
        <Dialog.Close>
          <Button type="submit">Save</Button>
        </Dialog.Close>
      </Flex>
    </form>
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
