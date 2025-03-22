import { TriangleDashed } from "lucide-react";

type Props = {
  message?: string;
};

export const EmptyView = ({ message }: Props) => {
  return (
    <div className="flex flex-col gap-4 items-center justify-center h-full text-base-content/40">
      <TriangleDashed className="w-16 h-16" />
      <p className="text-md">{message}</p>
    </div>
  );
};
