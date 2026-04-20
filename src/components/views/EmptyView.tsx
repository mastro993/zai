import { TriangleDashIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";

type Props = {
  message?: string;
};

export const EmptyView = ({ message }: Props) => {
  return (
    <div className="flex flex-col gap-4 items-center justify-center h-full text-base-content/40">
      <Icon icon={TriangleDashIcon} className="w-16 h-16" />
      <p className="text-md">{message}</p>
    </div>
  );
};
