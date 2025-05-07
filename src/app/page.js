import fs from "fs";
import path from "path";
import Image from "next/image";
import Weather from "@/components/Weather";

function ServiceList({ services }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {services.map((service) => (
        <a
          key={service.name}
          href={service.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start space-x-4 hover:bg-gray-700/40 transition rounded-xl p-4 no-underline bg-gray-800/40 backdrop-blur-md border border-white/10"
        >
          <Image
            src={service.icon}
            alt={service.name}
            width={48}
            height={48}
            className="mt-1"
          />
          <div>
            <p className="text-xl font-semibold">{service.name}</p>
            <p className="text-sm text-gray-300">{service.description}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

export default async function Home() {
  const filePath = path.join(process.cwd(), "src/data/services.json");
  const fileContents = fs.readFileSync(filePath, "utf8");
  const services = JSON.parse(fileContents);

  const publicServices = services.filter((s) => !s.private);
  const privateServices = services.filter((s) => s.private);

  return (
    <main className="min-h-screen bg-cover bg-center bg-no-repeat text-white flex flex-col items-center justify-center p-8 space-y-8 hide-scrollbar" style={{ backgroundImage: "url('/forest.jpg')" }}>
      <div className="w-full max-w-5xl flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold text-gradient bg-clip-text">Welcome Home</h1>
        <Weather />
      </div>

      <div className="w-full max-w-5xl space-y-2 mt-8">
        <h2 className="text-3xl font-bold text-left">Public Services</h2>
        <p className="text-left text-lg mb-1">Services that are accessible to anyone on the home network.</p>
        <div className="w-full bg-gray-700/40 backdrop-blur-sm rounded-xl p-3 shadow-xl border border-white/10">
          <ServiceList services={publicServices} />
        </div>
      </div>

      <div className="w-full max-w-5xl space-y-2 mt-8">
        <h2 className="text-3xl font-bold text-left">Private Services</h2>
        <p className="text-left text-lg mb-1">Services that require authentication or are restricted to admin.</p>
        <div className="w-full bg-gray-700/40 backdrop-blur-sm rounded-xl p-3 shadow-xl border border-white/10">
          <ServiceList services={privateServices} />
        </div>
      </div>
    </main>
  );
}
