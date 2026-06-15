"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
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
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`
    }
  });

  if (error) {
    redirect("/login?error=auth");
  }

  redirect("/login?sent=1");
}
