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
    <Item role="listitem" className="rounded-none border-0 px-4 py-4">
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
