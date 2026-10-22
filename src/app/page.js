import Dashboard from "@/components/Dashboard";
import { loadServices } from "@/lib/services";

export const dynamic = "force-dynamic";

export default function Home() {
  const services = loadServices();
  return <Dashboard services={services} />;
}
