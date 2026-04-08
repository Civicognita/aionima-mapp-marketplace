import {
  createPlugin,
  defineRuntime,
  defineSettings,
  defineSettingsPage,
} from "@aionima/sdk";

const VERSIONS = [
  { id: "go-121", label: "Go 1.21", version: "1.21", image: "golang:1.21-alpine", port: 8080 },
  { id: "go-122", label: "Go 1.22", version: "1.22", image: "golang:1.22-alpine", port: 8080 },
  { id: "go-123", label: "Go 1.23", version: "1.23", image: "golang:1.23-alpine", port: 8080 },
  { id: "go-124", label: "Go 1.24", version: "1.24", image: "golang:1.24-alpine", port: 8080 },
];

export default createPlugin({
  async activate(api) {
    for (const v of VERSIONS) {
      api.registerRuntime(
        defineRuntime(v.id, v.label)
          .language("go")
          .version(v.version)
          .containerImage(v.image)
          .internalPort(v.port)
          .projectTypes(["app"])
          .installable(true)
          .build(),
      );
    }

    api.registerRuntimeInstaller({
      language: "go",
      listAvailable: () => VERSIONS.map((v) => v.version),
      async listInstalled() {
        const { execSync } = await import("node:child_process");
        try {
          const output = execSync("go version", { encoding: "utf-8" });
          const match = output.match(/go(\d+\.\d+)/);
          return match ? [match[1]!] : [];
        } catch {
          return [];
        }
      },
      async install(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(
          [
            `wget -q https://go.dev/dl/go${version}.linux-amd64.tar.gz -O /tmp/go.tar.gz`,
            "sudo rm -rf /usr/local/go",
            "sudo tar -C /usr/local -xzf /tmp/go.tar.gz",
            "rm /tmp/go.tar.gz",
          ].join(" && "),
          { stdio: "inherit" },
        );
      },
      async uninstall(_version: string) {
        const { execSync } = await import("node:child_process");
        execSync("sudo rm -rf /usr/local/go", { stdio: "inherit" });
      },
    });

    const runtimeSection = defineSettings("go-versions", "Installed Versions")
      .description("Manage Go versions installed on this machine")
      .configPath("runtimes.go")
      .type("runtime-manager")
      .language("go")
      .build();

    const configSection = defineSettings("go-config", "Configuration")
      .description("Default Go settings for new projects")
      .configPath("runtimes.go")
      .field({
        id: "defaultVersion",
        label: "Default Version",
        type: "select",
        description: "Version used when creating new projects",
        options: VERSIONS.map((v) => ({ value: v.version, label: v.label })),
        defaultValue: "1.23",
      })
      .field({
        id: "gopath",
        label: "GOPATH",
        type: "text",
        description: "Go workspace directory",
        defaultValue: "~/go",
        placeholder: "~/go",
      })
      .build();

    api.registerSettingsPage(
      defineSettingsPage("go-settings", "Go")
        .description("Go runtime versions and configuration")
        .icon("go")
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
