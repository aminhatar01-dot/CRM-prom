import { describe, expect, it } from "vitest";
import { assertSafeUrl, isPrivateIp } from "./ssrf-guard";

// Fake DNS resolver for tests — never makes real network calls
function fakeResolver(ipMap: Record<string, string[]>) {
  return async (hostname: string) => {
    const ips = ipMap[hostname];
    if (!ips) throw new Error(`NXDOMAIN: ${hostname}`);
    return ips.map((address) => ({ address }));
  };
}

describe("isPrivateIp", () => {
  it("blocks IPv4 loopback", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.255.255.255")).toBe(true);
  });

  it("blocks 0.0.0.0/8", () => {
    expect(isPrivateIp("0.0.0.0")).toBe(true);
    expect(isPrivateIp("0.1.2.3")).toBe(true);
  });

  it("blocks RFC1918 private ranges", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("10.255.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
  });

  it("does not block public IPv4 that looks like RFC1918", () => {
    expect(isPrivateIp("172.15.0.1")).toBe(false);  // outside 172.16-31 range
    expect(isPrivateIp("172.32.0.1")).toBe(false);
    expect(isPrivateIp("11.0.0.1")).toBe(false);
  });

  it("blocks link-local / cloud metadata 169.254.x.x", () => {
    expect(isPrivateIp("169.254.0.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);  // AWS/GCP/Azure IMDS
  });

  it("blocks CGNAT 100.64.0.0/10", () => {
    expect(isPrivateIp("100.64.0.1")).toBe(true);
    expect(isPrivateIp("100.127.255.255")).toBe(true);
  });

  it("does not block public IPv4", () => {
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("203.0.113.1")).toBe(false);
  });

  it("blocks IPv6 loopback ::1", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("0:0:0:0:0:0:0:1")).toBe(true);
  });

  it("blocks IPv6 link-local fe80::", () => {
    expect(isPrivateIp("fe80::1")).toBe(true);
  });

  it("blocks IPv6 ULA fc00::/7", () => {
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456:789a::1")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 for private addresses", () => {
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:192.168.1.1")).toBe(true);
    expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
  });

  it("does not block IPv4-mapped IPv6 for public addresses", () => {
    expect(isPrivateIp("::ffff:1.1.1.1")).toBe(false);
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("assertSafeUrl", () => {
  it("allows public HTTPS URL", async () => {
    const resolver = fakeResolver({ "example.com": ["93.184.216.34"] });
    await expect(assertSafeUrl("https://example.com/path", resolver)).resolves.toBeDefined();
  });

  it("allows public HTTP URL", async () => {
    const resolver = fakeResolver({ "example.com": ["93.184.216.34"] });
    await expect(assertSafeUrl("http://example.com/", resolver)).resolves.toBeDefined();
  });

  it("blocks localhost by hostname", async () => {
    const resolver = fakeResolver({ "localhost": ["127.0.0.1"] });
    await expect(assertSafeUrl("http://localhost:8080/", resolver)).rejects.toThrow("red privada");
  });

  it("blocks direct IPv4 loopback", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/")).rejects.toThrow("red privada");
  });

  it("blocks direct IPv4 private (RFC1918)", async () => {
    await expect(assertSafeUrl("http://192.168.1.1/")).rejects.toThrow("red privada");
    await expect(assertSafeUrl("http://10.0.0.1/")).rejects.toThrow("red privada");
  });

  it("blocks cloud metadata IP 169.254.169.254", async () => {
    await expect(assertSafeUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow("red privada");
  });

  it("blocks DNS-rebinding (hostname resolves to private IP)", async () => {
    const resolver = fakeResolver({ "evil.attacker.com": ["169.254.169.254"] });
    await expect(assertSafeUrl("https://evil.attacker.com/", resolver)).rejects.toThrow("red privada");
  });

  it("blocks hostname resolving to 10.x.x.x", async () => {
    const resolver = fakeResolver({ "internal.corp": ["10.0.0.50"] });
    await expect(assertSafeUrl("https://internal.corp/api", resolver)).rejects.toThrow("red privada");
  });

  it("blocks non-http/https protocols", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow("Protocolo no permitido");
    await expect(assertSafeUrl("ftp://files.example.com")).rejects.toThrow("Protocolo no permitido");
    await expect(assertSafeUrl("gopher://example.com")).rejects.toThrow("Protocolo no permitido");
  });

  it("blocks URLs with embedded credentials", async () => {
    const resolver = fakeResolver({ "example.com": ["93.184.216.34"] });
    await expect(assertSafeUrl("https://user:pass@example.com/", resolver)).rejects.toThrow("credenciales");
  });

  it("blocks NXDOMAIN (unresolvable hostname)", async () => {
    const resolver = fakeResolver({});
    await expect(assertSafeUrl("https://does-not-exist.invalid/", resolver)).rejects.toThrow("resolver");
  });

  it("returns the parsed URL on success", async () => {
    const resolver = fakeResolver({ "api.example.com": ["93.184.216.34"] });
    const url = await assertSafeUrl("https://api.example.com/v1/data", resolver);
    expect(url.hostname).toBe("api.example.com");
    expect(url.protocol).toBe("https:");
  });
});
