import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

describe("Vercel monorepo contract", () => {
  it("builds the web workspace from the repository root", () => {
    const config = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as {
      framework: string;
      installCommand: string;
      buildCommand: string;
      outputDirectory?: string;
    };

    expect(config).toEqual(
      expect.objectContaining({
        framework: "nextjs",
        installCommand: "npm install",
        buildCommand: "npm run build --workspace @crm-pro-ai/web"
      })
    );
    expect(config).not.toHaveProperty("outputDirectory");
    expect(config).toHaveProperty("crons", [
      {
        path: "/api/cron/whatsapp-tokens",
        schedule: "0 6 * * *"
      }
    ]);
  });

  it("declares the Next.js runtime in the web workspace", () => {
    const webPackage = JSON.parse(
      readFileSync(resolve(root, "apps/web/package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
    };

    expect(webPackage.dependencies).toMatchObject({
      next: expect.any(String),
      react: expect.any(String),
      "react-dom": expect.any(String)
    });
  });
});
