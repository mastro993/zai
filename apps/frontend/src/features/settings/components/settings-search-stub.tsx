import { useId } from "react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export function SettingsSearchStub() {
  const searchId = useId();

  return (
    <div data-slot="settings-sidebar-search" className="flex h-12 w-full min-w-0 items-center px-2">
      <Field className="min-w-0 flex-1">
        <FieldLabel htmlFor={searchId} className="sr-only">
          Search settings
        </FieldLabel>
        <InputGroup className="bg-background">
          <InputGroupAddon align="inline-start">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput id={searchId} type="search" placeholder="Search settings" />
        </InputGroup>
      </Field>
    </div>
  );
}
