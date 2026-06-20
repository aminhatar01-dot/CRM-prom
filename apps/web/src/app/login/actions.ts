"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRequestOrigin } from "@/lib/auth-flow";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email()
});

export async function signInWithEmail(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email")
  });

  if (!parsed.success) {
    redirect("/login?error=invalid-email");
  }

  const supabase = await createClient();
  const origin = getRequestOrigin(await headers());

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true
    }
  });

  if (error) {
    redirect(`/login?error=${error.status === 429 ? "rate-limit" : "auth"}`);
  }

  redirect("/login?sent=1");
}
