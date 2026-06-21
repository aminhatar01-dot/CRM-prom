$ErrorActionPreference = "Stop"

$startedSupabase = $false
$user = $null
$exitCode = 1

function Read-SupabaseEnv {
  $lines = & cmd /d /s /c "npx supabase status -o env 2>nul"
  if ($LASTEXITCODE -ne 0) {
    return $null
  }

  $values = @{}
  foreach ($line in $lines) {
    if ($line -match '^([A-Z_]+)="(.*)"$') {
      $values[$matches[1]] = $matches[2]
    }
  }

  return $values
}

try {
  $supabase = Read-SupabaseEnv
  if (-not $supabase -or -not $supabase["API_URL"]) {
    & cmd /d /s /c "npx supabase start -x edge-runtime,imgproxy,mailpit,studio,vector,logflare,storage-api,realtime --ignore-health-check"
    if ($LASTEXITCODE -ne 0) {
      throw "Supabase local could not be started."
    }
    $startedSupabase = $true
    $supabase = Read-SupabaseEnv
  }

  $baseUrl = $supabase["API_URL"]
  $anonKey = $supabase["ANON_KEY"]
  $serviceRoleKey = $supabase["SERVICE_ROLE_KEY"]
  if (-not $baseUrl -or -not $anonKey -or -not $serviceRoleKey) {
    throw "Supabase local keys are unavailable."
  }

  $email = "phase14-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())@example.com"
  $password = "Phase14-$([guid]::NewGuid().ToString('N'))-Aa1!"
  $headers = @{
    Authorization = "Bearer $serviceRoleKey"
    apikey = $serviceRoleKey
    "Content-Type" = "application/json"
  }

  $user = Invoke-RestMethod `
    -Method Post `
    -Uri "$baseUrl/auth/v1/admin/users" `
    -Headers $headers `
    -Body (@{
      email = $email
      password = $password
      email_confirm = $true
    } | ConvertTo-Json)

  $env:NEXT_PUBLIC_SUPABASE_URL = $baseUrl
  $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $anonKey
  $env:SUPABASE_SERVICE_ROLE_KEY = $serviceRoleKey
  $env:PHASE14_TEST_EMAIL = $email
  $env:PHASE14_TEST_PASSWORD = $password

  & cmd /d /s /c "npx playwright test --config apps/web/phase14.playwright.config.ts"
  $exitCode = $LASTEXITCODE
}
finally {
  if ($user -and $user.id) {
    $members = Invoke-RestMethod `
      -Uri "$baseUrl/rest/v1/organization_members?user_id=eq.$($user.id)&select=organization_id" `
      -Headers $headers `
      -ErrorAction SilentlyContinue

    if ($members.Count -gt 0) {
      Invoke-RestMethod `
        -Method Delete `
        -Uri "$baseUrl/rest/v1/organizations?id=eq.$($members[0].organization_id)" `
        -Headers $headers | Out-Null
    }

    Invoke-RestMethod `
      -Method Delete `
      -Uri "$baseUrl/auth/v1/admin/users/$($user.id)" `
      -Headers $headers | Out-Null
  }

  Remove-Item Env:NEXT_PUBLIC_SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:NEXT_PUBLIC_SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:PHASE14_TEST_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:PHASE14_TEST_PASSWORD -ErrorAction SilentlyContinue

  if ($startedSupabase) {
    & cmd /d /s /c "npx supabase stop"
  }
}

exit $exitCode
