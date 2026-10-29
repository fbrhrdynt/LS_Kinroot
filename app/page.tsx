export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <iframe
      title="KinRoot ruang keluarga"
      src="/kinroot-app/index.html"
      style={{ border: 0, width: "100%", height: "100dvh", display: "block" }}
      allow="clipboard-write; web-share"
    />
  );
}
