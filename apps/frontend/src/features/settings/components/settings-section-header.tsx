interface SettingsSectionHeaderProps {
  description: string;
}

export function SettingsSectionHeader({ description }: SettingsSectionHeaderProps) {
  return <p className="text-sm text-muted-foreground">{description}</p>;
}
