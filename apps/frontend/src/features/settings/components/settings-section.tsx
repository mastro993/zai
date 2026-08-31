import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface SettingsSectionHeaderProps {
  title: string;
  description?: string;
}

export function SettingsSectionHeader({ title, description }: SettingsSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-heading text-2xl font-semibold tracking-tight">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

interface SettingsSectionProps {
  title?: string;
  children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      {title ? <h3 className="px-1 text-sm text-muted-foreground">{title}</h3> : null}
      <Card className="gap-0! py-0!">
        <CardContent className="px-0!">{children}</CardContent>
      </Card>
    </section>
  );
}

export function SettingsSectionDivider() {
  return <Separator role="presentation" className="mx-4 w-auto!" />;
}
