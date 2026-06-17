export function webchatCorsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "Origin"
  };
}

export function webchatOptionsResponse(request: Request) {
  return new Response(null, {
    status: 204,
    headers: webchatCorsHeaders(request.headers.get("origin"))
  });
}
