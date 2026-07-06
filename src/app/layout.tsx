export const metadata = { title: "OA Personalshop", robots: { index: false } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          body{font-family:'Inter',sans-serif}
          .grotesk{font-family:'Space Grotesk',sans-serif;letter-spacing:-0.02em}
          @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
          .pop{animation:fadeUp .5s cubic-bezier(.16,1,.3,1) both}
          @keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
          .toast{animation:toastIn .3s cubic-bezier(.16,1,.3,1) both}
          @media (prefers-reduced-motion: reduce){.pop,.toast{animation:none!important}}
        `}</style>
      </head>
      <body style={{ background: "#eeeeee", color: "#111" }}>{children}</body>
    </html>
  );
}
