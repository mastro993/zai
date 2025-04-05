import { cn } from "@/lib/utils";
import { CircleHelp } from "lucide-react";

type Props = {
  title: string;
  docId?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export const Navbar = ({ title, children, actions, docId }: Props) => {
  return (
    <div
      className={cn([
        "navbar",
        "sticky top-0 z-20",
        "px-4 bg-base-100",
        "border-b border-base-content/10",
      ])}
    >
      <div className="navbar-start gap-2">
        <span className="text-md text-content font-medium">{title}</span>
        {docId && (
          <button className="btn btn-square btn-soft btn-sm">
            <CircleHelp className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="navbar-center">{children}</div>
      <div className="navbar-end ">{actions}</div>
    </div>
  );
};
