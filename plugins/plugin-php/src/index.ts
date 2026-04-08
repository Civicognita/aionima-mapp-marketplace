import {
  createPlugin,
  defineRuntime,
  defineSettings,
  defineSettingsPage,
} from "@aionima/sdk";

const VERSIONS = [
  { id: "php-81", label: "PHP 8.1", version: "8.1", image: "php:8.1-fpm-alpine", port: 9000 },
  { id: "php-82", label: "PHP 8.2", version: "8.2", image: "php:8.2-fpm-alpine", port: 9000 },
  { id: "php-83", label: "PHP 8.3", version: "8.3", image: "php:8.3-fpm-alpine", port: 9000 },
  { id: "php-84", label: "PHP 8.4", version: "8.4", image: "php:8.4-fpm-alpine", port: 9000 },
];

export default createPlugin({
  async activate(api) {
    for (const v of VERSIONS) {
      api.registerRuntime(
        defineRuntime(v.id, v.label)
          .language("php")
          .version(v.version)
          .containerImage(v.image)
          .internalPort(v.port)
          .projectTypes(["web"])
          .dependency({ name: "composer", version: "bundled", type: "bundled" })
          .installable(true)
          .build(),
      );
    }

    api.registerRuntimeInstaller({
      language: "php",
      listAvailable: () => VERSIONS.map((v) => v.version),
      async listInstalled() {
        const { execSync } = await import("node:child_process");
        try {
          const output = execSync("php -v", { encoding: "utf-8" });
          const match = output.match(/PHP (\d+\.\d+)/);
          return match ? [match[1]!] : [];
        } catch {
          return [];
        }
      },
      async install(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(
          [
            "sudo add-apt-repository -y ppa:ondrej/php",
            "sudo apt-get update",
            `sudo apt-get install -y php${version} php${version}-cli php${version}-fpm php${version}-mbstring php${version}-xml php${version}-curl php${version}-zip`,
          ].join(" && "),
          { stdio: "inherit" },
        );
      },
      async uninstall(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(`sudo apt-get remove -y php${version}*`, { stdio: "inherit" });
      },
    });

    const runtimeSection = defineSettings("php-versions", "Installed Versions")
      .description("Manage PHP versions installed on this machine")
      .configPath("runtimes.php")
      .type("runtime-manager")
      .language("php")
      .build();

    const configSection = defineSettings("php-config", "Configuration")
      .description("Default PHP settings for new projects")
      .configPath("runtimes.php")
      .field({
        id: "defaultVersion",
        label: "Default Version",
        type: "select",
        description: "Version used when creating new projects",
        options: VERSIONS.map((v) => ({ value: v.version, label: v.label })),
        defaultValue: "8.3",
      })
      .field({
        id: "memoryLimit",
        label: "Memory Limit",
        type: "select",
        description: "PHP memory_limit for development",
        options: [
          { value: "128M", label: "128 MB" },
          { value: "256M", label: "256 MB" },
          { value: "512M", label: "512 MB" },
          { value: "1G", label: "1 GB" },
        ],
        defaultValue: "256M",
      })
      .field({
        id: "displayErrors",
        label: "Display Errors",
        type: "toggle",
        description: "Show PHP errors in browser (development only)",
        defaultValue: true,
      })
      .build();

    api.registerSettingsPage(
      defineSettingsPage("php-settings", "PHP")
        .description("PHP runtime versions and configuration")
        .icon("php")
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
