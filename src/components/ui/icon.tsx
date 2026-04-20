import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";

export type IconProps = Omit<HugeiconsIconProps, "icon"> & {
  icon: HugeiconsIconProps["icon"];
};

export const Icon = ({ strokeWidth = 1.75, ...props }: IconProps) => {
  return <HugeiconsIcon strokeWidth={strokeWidth} {...props} />;
};
