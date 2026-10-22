import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Home Dash",
  description: "A dashboard for self hosted home services.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#0b0d12",
};

// Applies the saved theme and accent before first paint to avoid a flash.
const themeScript = `
try {
  var s = JSON.parse(localStorage.getItem("homedash:v2"));
  var a = s && s.settings && s.settings.appearance;
  if (a) {
    var t = a.theme === "auto"
      ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : a.theme;
    document.documentElement.dataset.theme = t || "dark";
    if (a.accent) document.documentElement.style.setProperty("--accent", a.accent);
  }
} catch (e) {}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
