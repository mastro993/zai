import { cn } from "@/lib/utils";

type JsonDisplayProps = {
  data: unknown;
  className?: string;
  maxHeight?: string;
};

export const JsonDisplay = ({
  data,
  className,
  maxHeight = "max-h-[500px]",
}: JsonDisplayProps) => {
  const formattedJson = JSON.stringify(data, null, 2);

  return (
    <div className={cn("bg-gray-500/10 p-4 rounded-lg", className)}>
      <div className="card-body">
        <pre className={cn("overflow-auto font-mono text-sm", maxHeight)}>
          <code className="text-base-content/80">{formattedJson}</code>
        </pre>
      </div>
    </div>
  );
};
