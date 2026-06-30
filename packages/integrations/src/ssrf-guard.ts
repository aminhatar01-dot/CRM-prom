import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export const MAX_SSRF_RESPONSE_BYTES = 10 * 1024 * 1024;

const BLOCKED_PROTOCOLS = new Set(["file:", "ftp:", "gopher:", "data:", "javascript:", "vbscript:"]);

function isPrivateIp(raw: string): boolean {
  const ip = raw.toLowerCase().trim();

  // IPv6 loopback and special
  if (ip === "::1" || ip === "::" || ip === "0:0:0:0:0:0:0:1") return true;
  if (ip.startsWith("fe80:")) return true;    // link-local
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // ULA / RFC4193

  // IPv4-mapped IPv6 — recurse on the IPv4 part
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isPrivateIp(v4mapped[1]);

  // IPv4
  if (ip === "0.0.0.0") return true;
  if (/^0\./.test(ip)) return true;                         // 0.0.0.0/8
  if (/^127\./.test(ip)) return true;                       // 127.0.0.0/8 loopback
  if (/^10\./.test(ip)) return true;                        // 10.0.0.0/8 RFC1918
  if (/^192\.168\./.test(ip)) return true;                  // 192.168.0.0/16 RFC1918
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;  // 172.16.0.0/12 RFC1918
  if (/^169\.254\./.test(ip)) return true;                  // 169.254.0.0/16 link-local + cloud metadata
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true; // 100.64.0.0/10 CGNAT

  // Explicit cloud metadata IPs
  if (ip === "169.254.169.254") return true;  // AWS/GCP/Azure IMDS
  if (ip === "100.100.100.200") return true;  // Alibaba Cloud IMDS

  return false;
}

/**
 * Validates that a URL is safe to fetch from a server-side context.
 * Throws an Error with a user-safe Spanish message on any violation.
 */
export async function assertSafeUrl(
  rawUrl: string,
  resolver?: (hostname: string, opts: { all: true }) => Promise<Array<{ address: string }>>,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida.");
  }

  if (BLOCKED_PROTOCOLS.has(url.protocol)) {
    throw new Error(`Protocolo no permitido: ${url.protocol}`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Solo se permiten URLs HTTP o HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("No se permiten credenciales en la URL.");
  }
  if (!url.hostname) {
    throw new Error("La URL debe tener un hostname válido.");
  }

  const resolve = resolver ?? ((h, o) => lookup(h, o));

  let addresses: Array<{ address: string }>;
  if (isIP(url.hostname) !== 0) {
    addresses = [{ address: url.hostname }];
  } else {
    try {
      addresses = await resolve(url.hostname, { all: true });
    } catch {
      throw new Error("No se pudo resolver el hostname de la URL.");
    }
  }

  if (addresses.length === 0) {
    throw new Error("El hostname no resolvió ninguna dirección IP.");
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error("La URL apunta a una red privada o recurso interno no permitido.");
    }
  }

  return url;
}

export { isPrivateIp };
