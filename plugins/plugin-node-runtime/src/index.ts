import {
  createPlugin,
  defineRuntime,
  defineSettings,
  defineSettingsPage,
} from "@aionima/sdk";

const VERSIONS = [
  { id: "node-18", label: "Node.js 18 LTS", version: "18", image: "node:18-alpine", port: 3000 },
  { id: "node-20", label: "Node.js 20 LTS", version: "20", image: "node:20-alpine", port: 3000 },
  { id: "node-22", label: "Node.js 22 LTS", version: "22", image: "node:22-alpine", port: 3000 },
  { id: "node-24", label: "Node.js 24 LTS", version: "24", image: "node:24-alpine", port: 3000 },
];

export default createPlugin({
  async activate(api) {
    // Register each Node.js version as a runtime
    for (const v of VERSIONS) {
      api.registerRuntime(
        defineRuntime(v.id, v.label)
          .language("node")
          .version(v.version)
          .containerImage(v.image)
          .internalPort(v.port)
          .projectTypes(["app", "web"])
          .dependency({ name: "npm", version: "bundled", type: "bundled" })
          .installable(true)
          .build(),
      );
    }

    // Register installer for managing Node.js versions via system packages
    api.registerRuntimeInstaller({
      language: "node",
      listAvailable: () => VERSIONS.map((v) => v.version),
      async listInstalled() {
        const { execSync } = await import("node:child_process");
        try {
          const output = execSync("node --version", { encoding: "utf-8" }).trim();
          const match = output.match(/^v(\d+)/);
          return match ? [match[1]!] : [];
        } catch {
          return [];
        }
      },
      async install(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(
          `curl -fsSL https://deb.nodesource.com/setup_${version}.x | sudo -E bash - && sudo apt-get install -y nodejs`,
          { stdio: "inherit" },
        );
      },
      async uninstall(_version: string) {
        const { execSync } = await import("node:child_process");
        execSync("sudo apt-get remove -y nodejs", { stdio: "inherit" });
      },
    });

    // Settings page with runtime manager + config
    const runtimeSection = defineSettings("node-versions", "Installed Versions")
      .description("Manage Node.js versions installed on this machine")
      .configPath("runtimes.node")
      .type("runtime-manager")
      .language("node")
      .build();

    const configSection = defineSettings("node-config", "Configuration")
      .description("Default Node.js settings for new projects")
      .configPath("runtimes.node")
      .field({
        id: "defaultVersion",
        label: "Default Version",
        type: "select",
        description: "Version used when creating new projects",
        options: VERSIONS.map((v) => ({ value: v.version, label: v.label })),
        defaultValue: "22",
      })
      .field({
        id: "packageManager",
        label: "Package Manager",
        type: "select",
        description: "Default package manager for new projects",
        options: [
          { value: "npm", label: "npm" },
          { value: "pnpm", label: "pnpm" },
          { value: "yarn", label: "Yarn" },
          { value: "bun", label: "Bun" },
        ],
        defaultValue: "pnpm",
      })
      .build();

    api.registerSettingsPage(
      defineSettingsPage("node-settings", "Node.js")
        .description("Node.js runtime versions and configuration")
        .icon("node")
        .section(runtimeSection)
        .section(configSection)
        .build(),
    );
  },

  async cleanup() {
    return {
      resources: VERSIONS.map((v) => ({
        id: `${v.id}-image`,
        type: "container-image" as const,
        label: `${v.label} container image`,
        removeCommand: `docker rmi ${v.image}`,
      })),
    };
  },
});
