import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const useRemoteFonts =
  process.env.NEXT_PUBLIC_REMOTE_FONTS === "true" || process.env.REMOTE_FONTS === "true";

export const metadata: Metadata = {
  title: "Appeal Shark",
  description:
    "DIY property tax appeal assistant with AI-driven valuation comparisons and filing guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" data-remote-fonts={useRemoteFonts ? "true" : "false"}>
      <head>
        {useRemoteFonts ? (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&display=swap"
            />
          </>
        ) : null}
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
