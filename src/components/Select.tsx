import { cn } from "@/lib/utils";
import ReactSelect, { Props as ReactSelectProps } from "react-select";

type SelectProps = ReactSelectProps;

export const Select = (props: SelectProps) => {
  return (
    <ReactSelect
      {...props}
      components={{
        DropdownIndicator: () => null,
        ...props.components,
      }}
      classNames={{
        control: (state) =>
          cn(
            "select w-full",
            state.isDisabled ? "opacity-50 cursor-not-allowed" : ""
          ),
        menu: () =>
          "menu bg-base-100 rounded-box shadow-xl p-2 z-50 border-base-300 border-1",
        option: (state) =>
          cn(
            "p-2 rounded-md cursor-pointer",
            state.isFocused ? "bg-base-200" : "",
            state.isSelected ? "bg-base-300" : ""
          ),
        placeholder: () => "text-base-content/50",
        singleValue: () => "text-base-content",
        input: () => "text-base-content",
        indicatorsContainer: () => "text-base-content/50",
        clearIndicator: () =>
          "text-base-content/50 hover:text-base-content hover:cursor-pointer",
        dropdownIndicator: () => "hidden",
        multiValue: () => "badge badge-primary gap-1",
        multiValueLabel: () => "text-primary-content",
        multiValueRemove: () => "text-primary-content hover:bg-primary-focus",
        noOptionsMessage: () => "text-base-content/50 p-2",
        loadingMessage: () => "text-base-content/50 p-2",
        ...props.classNames,
      }}
    />
  );
};
