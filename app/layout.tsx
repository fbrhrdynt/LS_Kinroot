import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "KinRoot — Cerita keluarga kita",
  description:
    "Ruang keluarga bersama. Simpan cerita, temukan akar, bangun hubungan.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
