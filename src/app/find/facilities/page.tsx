import { AppShell } from "@/components/AppShell";
import { Locator } from "@/components/Locator";

export default function FacilitiesPage() {
  return (
    <AppShell fullHeight>
      <Locator kind="facility" />
    </AppShell>
  );
}
