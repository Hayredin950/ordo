import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { storedHourFormat, type HourFormat } from "@/lib/ordo";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Ordo" },
      // Nothing here should ever surface in a search result.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  // Read after mount: localStorage does not exist while the page is server-rendered.
  const [hourFormat, setHourFormat] = useState<HourFormat>("24h");
  useEffect(() => setHourFormat(storedHourFormat()), []);

  return (
    <>
      <Toaster />
      <AdminDashboard hourFormat={hourFormat} />
    </>
  );
}
