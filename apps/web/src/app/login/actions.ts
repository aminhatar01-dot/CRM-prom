"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRequestOrigin, passwordSignInErrorCode, postAuthPath } from "@/lib/auth-flow";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email()
});

const passwordLoginSchema = loginSchema.extend({
  password: z.string().min(1).max(128)
});

export async function signInWithPassword(formData: FormData) {
  const parsed = passwordLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    redirect("/login?error=invalid-credentials");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    redirect(
      `/login?error=${passwordSignInErrorCode(
        error?.message ?? "Invalid login credentials",
        error?.status
      )}`
    );
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", data.user.id)
    .limit(1);

  if (membershipError) {
    redirect("/login?error=membership");
  }

  redirect(postAuthPath(Boolean(memberships?.length)));
}

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
