"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        options: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type SessionInfo = {
  wabaId: string;
  phoneNumberId?: string;
};

export function EmbeddedSignupButton({
  appId,
  configurationId,
  graphApiVersion,
  state
}: {
  appId: string;
  configurationId: string;
  graphApiVersion: string;
  state: string;
}) {
  const [sdkReady, setSdkReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const codeRef = useRef<string | undefined>(undefined);
  const sessionRef = useRef<SessionInfo | undefined>(undefined);
  const submittedRef = useRef(false);

  const completeWhenReady = useCallback(async () => {
    if (submittedRef.current || !codeRef.current || !sessionRef.current) return;
    submittedRef.current = true;
    try {
      const response = await fetch("/api/integrations/whatsapp/embedded-signup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeRef.current,
          wabaId: sessionRef.current.wabaId,
          phoneNumberId: sessionRef.current.phoneNumberId,
          state
        })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "No pudimos conectar WhatsApp.");
      window.location.assign("/settings/channels/whatsapp?connected=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos conectar WhatsApp.");
      setConnecting(false);
      submittedRef.current = false;
    }
  }, [state]);

  useEffect(() => {
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: graphApiVersion
      });
      setSdkReady(true);
    };

    if (window.FB) {
      window.fbAsyncInit();
    } else if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/es_LA/sdk.js";
      document.body.appendChild(script);
    }

    const listener = (event: MessageEvent) => {
      if (!isFacebookOrigin(event.origin) || typeof event.data !== "string") return;
      try {
        const payload = JSON.parse(event.data) as {
          type?: string;
          event?: string;
          data?: { waba_id?: string; phone_number_id?: string; current_step?: string };
        };
        if (payload.type !== "WA_EMBEDDED_SIGNUP") return;
        if (payload.event === "FINISH" || payload.event === "FINISH_ONLY_WABA") {
          if (!payload.data?.waba_id) {
            setError("Meta no devolvio el WABA ID.");
            setConnecting(false);
            return;
          }
          sessionRef.current = {
            wabaId: payload.data.waba_id,
            phoneNumberId: payload.data.phone_number_id
          };
          void completeWhenReady();
        } else if (payload.event === "CANCEL") {
          setError(`Conexion cancelada en ${payload.data?.current_step ?? "Meta"}.`);
          setConnecting(false);
        } else if (payload.event === "ERROR") {
          setError("Meta no pudo completar Embedded Signup.");
          setConnecting(false);
        }
      } catch {
        // Ignore unrelated Facebook SDK messages.
      }
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [appId, completeWhenReady, graphApiVersion]);

  function launch() {
    setError("");
    setConnecting(true);
    submittedRef.current = false;
    codeRef.current = undefined;
    sessionRef.current = undefined;

    if (!window.FB || !sdkReady) {
      setError("El SDK de Meta todavia no esta listo.");
      setConnecting(false);
      return;
    }

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setError("Meta no devolvio el codigo de autorizacion.");
          setConnecting(false);
          return;
        }
        codeRef.current = code;
        void completeWhenReady();
      },
      {
        config_id: configurationId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {} }
      },
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={launch} disabled={!sdkReady || connecting}>
        {connecting ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
        {connecting ? "Conectando..." : "Conectar WhatsApp"}
      </Button>
      {!sdkReady ? <p className="text-xs text-muted-foreground">Cargando conexion segura de Meta...</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

function isFacebookOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "facebook.com" || hostname.endsWith(".facebook.com");
  } catch {
    return false;
  }
}
