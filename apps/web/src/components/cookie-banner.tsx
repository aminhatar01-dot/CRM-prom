"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const COOKIE_KEY = "cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!document.cookie.includes(`${COOKIE_KEY}=accepted`)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    document.cookie = `${COOKIE_KEY}=accepted; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimiento de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card px-4 py-4 shadow-lg sm:flex sm:items-center sm:justify-between sm:gap-6"
    >
      <p className="text-sm text-muted-foreground">
        Usamos cookies esenciales para el funcionamiento del servicio.{" "}
        <Link href="/legal/cookies" className="underline hover:text-foreground">
          Politica de cookies
        </Link>
      </p>
      <div className="mt-3 flex gap-3 sm:mt-0 shrink-0">
        <button
          type="button"
          onClick={accept}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Aceptar esenciales
        </button>
      </div>
    </div>
  );
}
