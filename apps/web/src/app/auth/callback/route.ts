import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getRequestOrigin, isSupportedOtpType, postAuthPath } from "@/lib/auth-flow";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const origin = getRequestOrigin(request.headers);
  const supabase = await createClient();
  let authError: Error | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && isSupportedOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType
    });
    authError = error;
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing-code`);
  }

  if (authError) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(`${origin}/login?error=session`);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1);

  if (membershipError) {
    return NextResponse.redirect(`${origin}/login?error=membership`);
  }

  return NextResponse.redirect(`${origin}${postAuthPath(Boolean(memberships?.length))}`);
}
