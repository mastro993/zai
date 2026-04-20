import { Moon01Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";

import { useTheme } from "@/components/ThemeProvider";
import { Button, Dropdown } from "@heroui/react";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <Dropdown>
      <Button variant="bordered" isIconOnly={true}>
        <Icon
          icon={Sun01Icon}
          className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
        />
        <Icon
          icon={Moon01Icon}
          className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
        />
        <span className="sr-only">Toggle theme</span>
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => setTheme(key as "light" | "dark" | "system")}>
          <Dropdown.Item id="light">Light</Dropdown.Item>
          <Dropdown.Item id="dark">Dark</Dropdown.Item>
          <Dropdown.Item id="system">System</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
