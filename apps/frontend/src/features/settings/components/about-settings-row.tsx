import type { ReactNode } from "react";

import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";

interface AboutSettingsRowProps {
  title: string;
  description?: string;
  value?: string;
  children?: ReactNode;
}

export function AboutSettingsRow({ title, description, value, children }: AboutSettingsRowProps) {
  return (
    <Item className="rounded-none px-4">
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        {description ? <ItemDescription>{description}</ItemDescription> : null}
      </ItemContent>
      <ItemActions>
        {value ? <span className="text-muted-foreground">{value}</span> : null}
        {children}
      </ItemActions>
    </Item>
  );
}
