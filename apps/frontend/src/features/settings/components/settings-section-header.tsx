interface SettingsSectionHeaderProps {
  title: string;
  description: string;
}

export function SettingsSectionHeader({ title, description }: SettingsSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
