import { cn } from "@/utils/style";
import { Box } from "@radix-ui/themes";

const allowedColors = ["sky", "red", "orange"];

export const ColorPalette = () => {
  return (
    <div className="grid grid-cols-12 gap-2">
      {allowedColors.map((color) => (
        <ColorPaletteItem key={color} color={color} />
      ))}
    </div>
  );
};

const ColorPaletteItem = ({ color }: { color: string }) => {
  return (
    <Box
      className={cn([
        "flex items-center justify-center",
        `dark:bg-red-500 aspect-square ring ring-red-500/70 rounded-box`,
        `text-red-400`,
      ])}
    >
      Aa
    </Box>
  );
};
