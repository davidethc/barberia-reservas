import { getAdminData } from "@/app/actions/admin";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { StaffHeader } from "@/components/staff/staff-header";

export default async function AdminPage() {
  const { services, barbers, businessHours } = await getAdminData();

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader title="Admin" />
      <AdminTabs services={services} barbers={barbers} businessHours={businessHours} />
    </div>
  );
}
