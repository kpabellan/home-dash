import Dashboard from "@/components/Dashboard";
import { loadServices } from "@/lib/services";
import { proxmoxConfig } from "@/lib/proxmox";

export const dynamic = "force-dynamic";

export default function Home() {
  const services = loadServices();
  // Only whether Proxmox is configured reaches the browser, never the settings.
  return <Dashboard services={services} proxmox={Boolean(proxmoxConfig())} />;
}
