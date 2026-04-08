import {
  createPlugin,
  defineSettings,
  defineSettingsPage,
  defineStack,
} from "@aionima/sdk";

const VERSIONS = [
  { id: "redis-72", label: "Redis 7.2", version: "7.2", image: "redis:7.2-alpine" },
  { id: "redis-74", label: "Redis 7.4", version: "7.4", image: "redis:7.4-alpine" },
  { id: "valkey-80", label: "Valkey 8.0", version: "8.0", image: "valkey/valkey:8.0-alpine" },
];

export default createPlugin({
  async activate(api) {
    for (const v of VERSIONS) {
      const isValkey = v.id.startsWith("valkey");
      api.registerStack(
        defineStack(`stack-${v.id}`, v.label)
          .description(`${v.label} — in-memory data store`)
          .category("database")
          .projectCategories(["app", "web"])
          .requirement({
            id: isValkey ? "valkey" : "redis",
            label: v.label,
            type: "provided",
          })
          .container({
            image: v.image,
            internalPort: 6379,
            shared: true,
            sharedKey: v.id,
            volumeMounts: () => [`${v.id}-data:/data`],
            env: () => ({}),
            healthCheck: "redis-cli ping",
          })
          .tool({
            id: "redis-cli",
            label: "redis-cli",
            description: "Open interactive Redis shell",
            action: "shell",
            command: "redis-cli",
          })
          .icon("database")
          .build(),
      );
    }

    api.registerSystemService({
      id: "redis-server",
      name: "Redis",
      description: "Native Redis in-memory data store",
      unitName: "redis-server",
      statusCommand: "redis-cli ping",
      startCommand: "sudo systemctl start redis-server",
      stopCommand: "sudo systemctl stop redis-server",
      restartCommand: "sudo systemctl restart redis-server",
      installCommand: "sudo apt-get install -y redis-server",
      installedCheck: "which redis-server",
      agentAware: true,
      agentDescription:
        "Redis in-memory data store. Use for caching, sessions, queues, and pub/sub.",
    });

    api.registerRuntimeInstaller({
      language: "redis",
      listAvailable: () => VERSIONS.filter((v) => !v.id.startsWith("valkey")).map((v) => v.version),
      async listInstalled() {
        const { execSync } = await import("node:child_process");
        try {
          const output = execSync("redis-server --version", { encoding: "utf-8" });
          const match = output.match(/v=(\d+\.\d+)/);
          return match ? [match[1]!] : [];
        } catch {
          return [];
        }
      },
      async install(_version: string) {
        const { execSync } = await import("node:child_process");
        execSync("sudo apt-get update && sudo apt-get install -y redis-server", {
          stdio: "inherit",
        });
      },
      async uninstall(_version: string) {
        const { execSync } = await import("node:child_process");
        execSync("sudo apt-get remove -y redis-server", { stdio: "inherit" });
      },
    });

    const serviceSection = defineSettings("redis-service", "Service Control")
      .description("Start, stop, and restart the Redis service")
      .configPath("stacks.redis")
      .type("service-control")
      .serviceIds(["redis-server"])
      .build();

    const runtimeSection = defineSettings("redis-versions", "Installed Versions")
      .description("Manage Redis versions installed on this machine")
      .configPath("stacks.redis")
      .type("runtime-manager")
      .language("redis")
      .build();

    const configSection = defineSettings("redis-config", "Configuration")
      .description("Default Redis settings for new projects")
      .configPath("stacks.redis")
      .field({
        id: "defaultVersion",
        label: "Default Version",
        type: "select",
        description: "Version used when adding Redis to a project",
        options: VERSIONS.map((v) => ({ value: v.version, label: v.label })),
        defaultValue: "7.4",
      })
      .field({
        id: "defaultPort",
        label: "Default Port",
        type: "number",
        description: "Port for new Redis instances",
        defaultValue: 6379,
      })
      .field({
        id: "maxMemory",
        label: "Max Memory",
        type: "select",
        description: "Memory limit for the Redis instance",
        options: [
          { value: "64mb", label: "64 MB" },
          { value: "128mb", label: "128 MB" },
          { value: "256mb", label: "256 MB" },
          { value: "512mb", label: "512 MB" },
          { value: "1gb", label: "1 GB" },
          { value: "0", label: "Unlimited" },
        ],
        defaultValue: "256mb",
      })
      .field({
        id: "persistence",
        label: "Persistence",
        type: "toggle",
        description: "Enable RDB snapshots for data durability",
        defaultValue: true,
      })
      .build();

    api.registerSettingsPage(
      defineSettingsPage("redis-settings", "Redis")
        .description("Redis/Valkey versions, service control, and configuration")
        .icon("database")
        .section(serviceSection)
        .section(runtimeSection)
        .section(configSection)
        .build(),
    );
  },

  async cleanup() {
    return {
      resources: [
        ...VERSIONS.map((v) => ({
          id: `${v.id}-image`,
          type: "container-image" as const,
          label: `${v.label} container image`,
          removeCommand: `docker rmi ${v.image}`,
        })),
        ...VERSIONS.map((v) => ({
          id: `${v.id}-volume`,
          type: "data-directory" as const,
          label: `${v.label} data volume`,
          removeCommand: `docker volume rm ${v.id}-data`,
        })),
      ],
    };
  },
});
