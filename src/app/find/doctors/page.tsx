import { AppShell } from "@/components/AppShell";
import { Locator } from "@/components/Locator";

export default async function DoctorsPage({ searchParams }: { searchParams: Promise<{ specialty?: string }> }) {
  const { specialty } = await searchParams;
  return (
    <AppShell fullHeight>
      <Locator kind="doctor" initialSpecialty={specialty} />
    </AppShell>
  );
}
