import { cn } from "@/lib/utils";

type Props = {
  title: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export const Navbar = ({ title, children, actions }: Props) => {
  return (
    <div
      className={cn([
        "navbar",
        "sticky top-0 z-20",
        "px-4 bg-base-100",
        "border-b border-base-content/10",
      ])}
    >
      <div className="navbar-start">
        <span className="text-md text-content font-medium">{title}</span>
      </div>
      <div className="navbar-center">{children}</div>
      <div className="navbar-end">{actions}</div>
    </div>
  );
};
