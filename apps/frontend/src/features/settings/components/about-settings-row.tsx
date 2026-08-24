import type { ReactNode } from "react";

import { Field, FieldContent, FieldDescription, FieldTitle } from "@/components/ui/field";

interface AboutSettingsRowProps {
  title: string;
  description?: string;
  value?: string;
  children?: ReactNode;
}

export function AboutSettingsRow({ title, description, value, children }: AboutSettingsRowProps) {
  return (
    <Field orientation="responsive" className="items-start py-4 @md/field-group:items-center">
      <FieldContent>
        <FieldTitle>{title}</FieldTitle>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </FieldContent>
      {value ? <p className="shrink-0 text-sm text-muted-foreground">{value}</p> : null}
      {children ? <div className="flex shrink-0 items-center">{children}</div> : null}
    </Field>
  );
}
