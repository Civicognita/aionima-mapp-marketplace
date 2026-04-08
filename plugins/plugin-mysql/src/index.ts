import {
  createPlugin,
  defineSettings,
  defineSettingsPage,
  defineStack,
} from "@aionima/sdk";

const VERSIONS = [
  { id: "mysql-80", label: "MySQL 8.0", version: "8.0", image: "mysql:8.0" },
  { id: "mysql-84", label: "MySQL 8.4 LTS", version: "8.4", image: "mysql:8.4" },
  { id: "mysql-90", label: "MySQL 9.0", version: "9.0", image: "mysql:9.0" },
  { id: "mariadb-1011", label: "MariaDB 10.11 LTS", version: "10.11", image: "mariadb:10.11" },
  { id: "mariadb-114", label: "MariaDB 11.4 LTS", version: "11.4", image: "mariadb:11.4" },
];

export default createPlugin({
  async activate(api) {
    for (const v of VERSIONS) {
      const isMariaDB = v.id.startsWith("mariadb");
      api.registerStack(
        defineStack(`stack-${v.id}`, v.label)
          .description(`${v.label} — relational database`)
          .category("database")
          .projectCategories(["app", "web"])
          .requirement({
            id: isMariaDB ? "mariadb" : "mysql",
            label: v.label,
            type: "provided",
          })
          .container({
            image: v.image,
            internalPort: 3306,
            shared: true,
            sharedKey: v.id,
            volumeMounts: () => [`${v.id}-data:/var/lib/mysql`],
            env: () => ({
              MYSQL_ROOT_PASSWORD: "aionima-dev",
            }),
            healthCheck: isMariaDB
              ? "healthcheck.sh --connect --innodb_initialized"
              : "mysqladmin ping -h localhost",
          })
          .database({
            engine: isMariaDB ? "mariadb" : "mysql",
            rootUser: "root",
            rootPasswordEnvVar: "MYSQL_ROOT_PASSWORD",
            setupScript: (ctx) => [
              "mysql",
              "-u",
              "root",
              `-p$MYSQL_ROOT_PASSWORD`,
              "-e",
              `CREATE DATABASE IF NOT EXISTS ${ctx.database}; CREATE USER IF NOT EXISTS '${ctx.user}'@'%' IDENTIFIED BY '${ctx.password}'; GRANT ALL ON ${ctx.database}.* TO '${ctx.user}'@'%';`,
            ],
            teardownScript: (ctx) => [
              "mysql",
              "-u",
              "root",
              `-p$MYSQL_ROOT_PASSWORD`,
              "-e",
              `DROP DATABASE IF EXISTS ${ctx.database}; DROP USER IF EXISTS '${ctx.user}'@'%';`,
            ],
            connectionUrlTemplate:
              "mysql://{user}:{password}@localhost:{port}/{database}",
          })
          .tool({
            id: "mysql-cli",
            label: "mysql",
            description: "Open interactive MySQL shell",
            action: "shell",
            command: "mysql -u {user} -p{password} {database}",
          })
          .icon("database")
          .build(),
      );
    }

    api.registerSystemService({
      id: "mysql",
      name: "MySQL",
      description: "Native MySQL database service",
      unitName: "mysql",
      statusCommand: "mysqladmin ping -h localhost",
      startCommand: "sudo systemctl start mysql",
      stopCommand: "sudo systemctl stop mysql",
      restartCommand: "sudo systemctl restart mysql",
      installCommand: "sudo apt-get install -y mysql-server",
      installedCheck: "which mysql",
      agentAware: true,
      agentDescription:
        "MySQL relational database. Use for projects requiring MySQL-compatible storage.",
    });

    api.registerRuntimeInstaller({
      language: "mysql",
      listAvailable: () => VERSIONS.filter((v) => !v.id.startsWith("mariadb")).map((v) => v.version),
      async listInstalled() {
        const { execSync } = await import("node:child_process");
        try {
          const output = execSync("mysql --version", { encoding: "utf-8" });
          const match = output.match(/(\d+\.\d+)\.\d+/);
          return match ? [match[1]!] : [];
        } catch {
          return [];
        }
      },
      async install(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(
          `sudo apt-get update && sudo apt-get install -y mysql-server-${version}`,
          { stdio: "inherit" },
        );
      },
      async uninstall(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(`sudo apt-get remove -y mysql-server-${version}`, {
          stdio: "inherit",
        });
      },
    });

    const serviceSection = defineSettings("mysql-service", "Service Control")
      .description("Start, stop, and restart the MySQL service")
      .configPath("stacks.mysql")
      .type("service-control")
      .serviceIds(["mysql"])
      .build();

    const runtimeSection = defineSettings("mysql-versions", "Installed Versions")
      .description("Manage MySQL versions installed on this machine")
      .configPath("stacks.mysql")
      .type("runtime-manager")
      .language("mysql")
      .build();

    const configSection = defineSettings("mysql-config", "Configuration")
      .description("Default MySQL settings for new projects")
      .configPath("stacks.mysql")
      .field({
        id: "defaultVersion",
        label: "Default Version",
        type: "select",
        description: "Version used when adding MySQL to a project",
        options: VERSIONS.map((v) => ({ value: v.version, label: v.label })),
        defaultValue: "8.4",
      })
      .field({
        id: "defaultPort",
        label: "Default Port",
        type: "number",
        description: "Port for new MySQL instances",
        defaultValue: 3306,
      })
      .field({
        id: "charset",
        label: "Default Character Set",
        type: "select",
        description: "Character set for new databases",
        options: [
          { value: "utf8mb4", label: "utf8mb4 (recommended)" },
          { value: "utf8", label: "utf8" },
          { value: "latin1", label: "latin1" },
        ],
        defaultValue: "utf8mb4",
      })
      .build();

    api.registerSettingsPage(
      defineSettingsPage("mysql-settings", "MySQL")
        .description("MySQL/MariaDB versions, service control, and configuration")
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
