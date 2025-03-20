import { cn } from "@/utils/style";

export const Navbar = ({ children }: React.PropsWithChildren) => {
  return (
    <div
      className={cn([
        "navbar sticky top-0 z-20",
        "px-5 flex justify-between",
        "bg-base-100",
        // "border-b border-base-300",
      ])}
    >
      {children}
    </div>
  );
};
