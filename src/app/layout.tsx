export const metadata = { title: "OA Personalshop", robots: { index: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`body{font-family:'Inter',sans-serif}`}</style>
      </head>
      <body style={{ background: "#eeeeee", color: "#111" }}>{children}</body>
    </html>
  );
}
