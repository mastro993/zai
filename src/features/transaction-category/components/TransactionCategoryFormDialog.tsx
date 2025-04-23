import { Button } from "@/components/ui/button";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { cva } from "class-variance-authority";
import { CheckIcon, ChevronDownIcon, Command } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z, ZodType } from "zod";
import { useAvailableParentTransactionCategories } from "../api/useAvailableParentTransactionCategories";
import {
  NewTransactionCategory,
  TransactionCategory,
  TransactionCategoryColor,
  TransactionCategoryColors,
} from "../schema";
import {
  TransactionCategoryBadge,
  TransactionCategoryBadgeVariants,
} from "./TransactionCategoryBadge";

export type TransactionCategoryFormDialogProps = React.ComponentProps<
  typeof Dialog
> & {
  category?: TransactionCategory;
  onSubmit: (data: NewTransactionCategory) => void;
};

export const formSchema: ZodType<NewTransactionCategory> = z.object({
  name: z.string().nonempty({ message: "Name is required" }),
  color: z.enum(TransactionCategoryColors),
  parent_id: z.coerce.number().optional().nullable(),
  description: z.string().optional().nullable(),
});

export function TransactionCategoryFormDialog({
  category,
  onSubmit,
  ...dialogProps
}: TransactionCategoryFormDialogProps) {
  const { data: transactionCategories } =
    useAvailableParentTransactionCategories();

  const form = useForm<NewTransactionCategory>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name,
      description: category?.description,
      color: category?.color ?? "neutral",
      parent_id: category?.parent_id,
    },
  });

  const parentCategoryId = useWatch({
    control: form.control,
    name: "parent_id",
  });

  useEffect(() => {
    if (parentCategoryId) {
      const parentCategory = transactionCategories?.find(
        (category) => category.id === parentCategoryId
      );
      if (parentCategory) {
        form.setValue("color", parentCategory.color);
      }
    }
  }, [parentCategoryId]);

  const title = useMemo(
    () => (category ? "Edit category" : "New category"),
    [category]
  );

  const description = useMemo(
    () => (category ? "Edit the category details" : "Create a new category"),
    [category]
  );

  return (
    <Form {...form}>
      <Dialog {...dialogProps}>
        <DialogContent onCloseAutoFocus={() => form.reset()}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value?.toString() ?? undefined}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <SelectTrigger
                        id={"parent-category-select"}
                        className="w-auto max-w-full min-w-48"
                      >
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {transactionCategories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
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
                      defaultValue="neutral"
                      onValueChange={field.onChange}
                      value={field.value ?? "neutral"}
                    >
                      {TransactionCategoryColors.map((color) => (
                        <TransactionCategoryColorRadioGroupItem
                          key={color}
                          color={color}
                        />
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
                      parent: null,
                    }}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Confirm</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Form>
  );
}

const TransactionCategoryColorRadioGroupItem = ({
  color,
}: {
  color: TransactionCategoryColor;
}) => {
  const variants = cva<TransactionCategoryBadgeVariants>(
    "size-8 rounded-md shadow-none data-[state=checked]:ring-3 ring-offset-2 ring-offset-background ",
    {
      variants: {
        color: {
          red: "bg-red-700 border-red-800 ring-red-900 data-[state=checked]:bg-red-700 data-[state=checked]:border-red-800 data-[state=checked]:text-red-100",
          orange:
            "bg-orange-700 border-orange-800 ring-orange-900 data-[state=checked]:bg-orange-700 data-[state=checked]:border-orange-800 data-[state=checked]:text-orange-100",
          yellow:
            "bg-yellow-700 border-yellow-800 ring-yellow-900 data-[state=checked]:bg-yellow-700 data-[state=checked]:border-yellow-800 data-[state=checked]:text-yellow-100",
          green:
            "bg-green-700 border-green-800 ring-green-900 data-[state=checked]:bg-green-700 data-[state=checked]:border-green-800 data-[state=checked]:text-green-100",
          teal: "bg-teal-700 border-teal-800 ring-teal-900 data-[state=checked]:bg-teal-700 data-[state=checked]:border-teal-800 data-[state=checked]:text-teal-100",
          sky: "bg-sky-700 border-sky-800 ring-sky-900 data-[state=checked]:bg-sky-700 data-[state=checked]:border-sky-800 data-[state=checked]:text-sky-100",
          blue: "bg-blue-700 border-blue-800 ring-blue-900 data-[state=checked]:bg-blue-700 data-[state=checked]:border-blue-800 data-[state=checked]:text-blue-100",
          indigo:
            "bg-indigo-700 border-indigo-800 ring-indigo-900 data-[state=checked]:bg-indigo-700 data-[state=checked]:border-indigo-800 data-[state=checked]:text-indigo-100",
          purple:
            "bg-purple-700 border-purple-800 ring-purple-900 data-[state=checked]:bg-purple-700 data-[state=checked]:border-purple-800 data-[state=checked]:text-purple-100",
          pink: "bg-pink-700 border-pink-800 ring-pink-900 data-[state=checked]:bg-pink-700 data-[state=checked]:border-pink-800 data-[state=checked]:text-pink-100",
          neutral:
            "bg-neutral-700 border-neutral-800 ring-neutral-900 data-[state=checked]:bg-neutral-700 data-[state=checked]:border-neutral-800 data-[state=checked]:text-neutral-100",
          "red-soft":
            "bg-red-200 border-red-300 ring-red-300 data-[state=checked]:bg-red-200 data-[state=checked]:border-red-300 data-[state=checked]:text-red-800",
          "orange-soft":
            "bg-orange-200 border-orange-300 ring-orange-300 data-[state=checked]:bg-orange-200 data-[state=checked]:border-orange-300 data-[state=checked]:text-orange-800",
          "yellow-soft":
            "bg-yellow-200 border-yellow-300 ring-yellow-300 data-[state=checked]:bg-yellow-200 data-[state=checked]:border-yellow-300 data-[state=checked]:text-yellow-600",
          "green-soft":
            "bg-green-200 border-green-300 ring-green-300 data-[state=checked]:bg-green-200 data-[state=checked]:border-green-300 data-[state=checked]:text-green-600",
          "teal-soft":
            "bg-teal-200 border-teal-300 ring-teal-300 data-[state=checked]:bg-teal-200 data-[state=checked]:border-teal-300 data-[state=checked]:text-teal-600",
          "sky-soft":
            "bg-sky-200 border-sky-300 ring-sky-300 data-[state=checked]:bg-sky-200 data-[state=checked]:border-sky-300 data-[state=checked]:text-sky-600",
          "blue-soft":
            "bg-blue-200 border-blue-300 ring-blue-300 data-[state=checked]:bg-blue-200 data-[state=checked]:border-blue-300 data-[state=checked]:text-blue-600",
          "indigo-soft":
            "bg-indigo-200 border-indigo-300 ring-indigo-300 data-[state=checked]:bg-indigo-200 data-[state=checked]:border-indigo-300 data-[state=checked]:text-indigo-600",
          "purple-soft":
            "bg-purple-200 border-purple-300 ring-purple-300 data-[state=checked]:bg-purple-200 data-[state=checked]:border-purple-300 data-[state=checked]:text-purple-600",
          "pink-soft":
            "bg-pink-200 border-pink-300 ring-pink-300 data-[state=checked]:bg-pink-200 data-[state=checked]:border-pink-300 data-[state=checked]:text-pink-600",
          "neutral-soft":
            "bg-neutral-200 border-neutral-300 ring-neutral-300 data-[state=checked]:bg-neutral-200 data-[state=checked]:border-neutral-300 data-[state=checked]:text-neutral-600",
        },
      },
      defaultVariants: {
        color: "neutral-soft",
      },
    }
  );

  return (
    <RadioGroupItem
      value={color}
      aria-label={color}
      id={color}
      className={cn(variants({ color }))}
    />
  );
};

type TransactionCategoryParentSelectProps = {
  parentCategories: TransactionCategory[];
};

export default function TransactionCategoryParentSelect({
  parentCategories,
}: TransactionCategoryParentSelectProps) {
  const id = useId();
  const [open, setOpen] = useState<boolean>(false);
  const [value, setValue] = useState<string | null>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="bg-background hover:bg-background border-input w-full justify-between px-3 font-normal outline-offset-0 outline-none focus-visible:outline-[3px]"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value
              ? parentCategories.find((cat) => cat.id.toString() === value)
                  ?.name
              : "Select parent category"}
          </span>
          <ChevronDownIcon
            size={16}
            className="text-muted-foreground/80 shrink-0"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="border-input w-full min-w-[var(--radix-popper-anchor-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search framework..." />
          <CommandList>
            <CommandEmpty>No framework found.</CommandEmpty>
            <CommandGroup>
              {parentCategories.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.id.toString()}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  {cat.name}
                  {value === cat.id.toString() && (
                    <CheckIcon size={16} className="ml-auto" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
