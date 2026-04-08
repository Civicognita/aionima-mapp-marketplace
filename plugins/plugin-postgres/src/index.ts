import {
  createPlugin,
  defineSettings,
  defineSettingsPage,
  defineStack,
} from "@aionima/sdk";

const VERSIONS = [
  { id: "postgres-14", label: "PostgreSQL 14", version: "14", image: "postgres:14-alpine" },
  { id: "postgres-15", label: "PostgreSQL 15", version: "15", image: "postgres:15-alpine" },
  { id: "postgres-16", label: "PostgreSQL 16", version: "16", image: "postgres:16-alpine" },
  { id: "postgres-17", label: "PostgreSQL 17", version: "17", image: "postgres:17-alpine" },
];

export default createPlugin({
  async activate(api) {
    // Register each PostgreSQL version as a stack
    for (const v of VERSIONS) {
      api.registerStack(
        defineStack(`stack-${v.id}`, v.label)
          .description(`${v.label} — relational database`)
          .category("database")
          .projectCategories(["app", "web"])
          .requirement({ id: "postgresql", label: v.label, type: "provided" })
          .container({
            image: v.image,
            internalPort: 5432,
            shared: true,
            sharedKey: v.id,
            volumeMounts: () => [`${v.id}-data:/var/lib/postgresql/data`],
            env: () => ({ POSTGRES_PASSWORD: "aionima-dev" }),
            healthCheck: "pg_isready -U postgres",
          })
          .database({
            engine: "postgresql",
            rootUser: "postgres",
            rootPasswordEnvVar: "POSTGRES_PASSWORD",
            setupScript: (ctx) => [
              "psql",
              "-U",
              "postgres",
              "-c",
              `CREATE USER ${ctx.user} WITH PASSWORD '${ctx.password}'; CREATE DATABASE ${ctx.database} OWNER ${ctx.user};`,
            ],
            teardownScript: (ctx) => [
              "psql",
              "-U",
              "postgres",
              "-c",
              `DROP DATABASE IF EXISTS ${ctx.database}; DROP USER IF EXISTS ${ctx.user};`,
            ],
            connectionUrlTemplate:
              "postgresql://{user}:{password}@localhost:{port}/{database}",
          })
          .tool({
            id: "psql",
            label: "psql",
            description: "Open interactive PostgreSQL shell",
            action: "shell",
            command: "psql -U {user} -d {database}",
          })
          .icon("database")
          .build(),
      );
    }

    // Register system service for native PostgreSQL
    api.registerSystemService({
      id: "postgresql",
      name: "PostgreSQL",
      description: "Native PostgreSQL database service",
      unitName: "postgresql",
      statusCommand: "pg_isready",
      startCommand: "sudo systemctl start postgresql",
      stopCommand: "sudo systemctl stop postgresql",
      restartCommand: "sudo systemctl restart postgresql",
      installCommand: "sudo apt-get install -y postgresql",
      installedCheck: "which psql",
      agentAware: true,
      agentDescription:
        "PostgreSQL relational database. Use for projects requiring SQL storage.",
    });

    // Runtime installer for managing PostgreSQL versions via apt
    api.registerRuntimeInstaller({
      language: "postgresql",
      listAvailable: () => VERSIONS.map((v) => v.version),
      async listInstalled() {
        const { execSync } = await import("node:child_process");
        try {
          const output = execSync("pg_config --version", { encoding: "utf-8" });
          const match = output.match(/PostgreSQL (\d+)/);
          return match ? [match[1]!] : [];
        } catch {
          return [];
        }
      },
      async install(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(
          [
            "sudo sh -c 'echo \"deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main\" > /etc/apt/sources.list.d/pgdg.list'",
            "wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -",
            "sudo apt-get update",
            `sudo apt-get install -y postgresql-${version}`,
          ].join(" && "),
          { stdio: "inherit" },
        );
      },
      async uninstall(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(`sudo apt-get remove -y postgresql-${version}`, {
          stdio: "inherit",
        });
      },
    });

    // Settings page: service control + version manager + config
    const serviceSection = defineSettings("pg-service", "Service Control")
      .description("Start, stop, and restart the PostgreSQL service")
      .configPath("stacks.postgresql")
      .type("service-control")
      .serviceIds(["postgresql"])
      .build();

    const runtimeSection = defineSettings("pg-versions", "Installed Versions")
      .description("Manage PostgreSQL versions installed on this machine")
      .configPath("stacks.postgresql")
      .type("runtime-manager")
      .language("postgresql")
      .build();

    const configSection = defineSettings("pg-config", "Configuration")
      .description("Default PostgreSQL settings for new projects")
      .configPath("stacks.postgresql")
      .field({
        id: "defaultVersion",
        label: "Default Version",
        type: "select",
        description: "Version used when adding PostgreSQL to a project",
        options: VERSIONS.map((v) => ({ value: v.version, label: v.label })),
        defaultValue: "17",
      })
      .field({
        id: "defaultPort",
        label: "Default Port",
        type: "number",
        description: "Port for new PostgreSQL instances",
        defaultValue: 5432,
      })
      .field({
        id: "maxConnections",
        label: "Max Connections",
        type: "number",
        description: "Maximum concurrent connections",
        defaultValue: 100,
      })
      .build();

    api.registerSettingsPage(
      defineSettingsPage("postgres-settings", "PostgreSQL")
        .description("PostgreSQL versions, service control, and configuration")
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
