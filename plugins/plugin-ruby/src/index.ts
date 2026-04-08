import {
  createPlugin,
  defineRuntime,
  defineSettings,
  defineSettingsPage,
} from "@aionima/sdk";

const VERSIONS = [
  { id: "ruby-32", label: "Ruby 3.2", version: "3.2", image: "ruby:3.2-alpine", port: 3000 },
  { id: "ruby-33", label: "Ruby 3.3", version: "3.3", image: "ruby:3.3-alpine", port: 3000 },
  { id: "ruby-34", label: "Ruby 3.4", version: "3.4", image: "ruby:3.4-alpine", port: 3000 },
];

export default createPlugin({
  async activate(api) {
    for (const v of VERSIONS) {
      api.registerRuntime(
        defineRuntime(v.id, v.label)
          .language("ruby")
          .version(v.version)
          .containerImage(v.image)
          .internalPort(v.port)
          .projectTypes(["app", "web"])
          .dependency({ name: "bundler", version: "bundled", type: "bundled" })
          .dependency({ name: "gem", version: "bundled", type: "bundled" })
          .installable(true)
          .build(),
      );
    }

    api.registerRuntimeInstaller({
      language: "ruby",
      listAvailable: () => VERSIONS.map((v) => v.version),
      async listInstalled() {
        const { execSync } = await import("node:child_process");
        try {
          const output = execSync("ruby --version", { encoding: "utf-8" });
          const match = output.match(/ruby (\d+\.\d+)/);
          return match ? [match[1]!] : [];
        } catch {
          return [];
        }
      },
      async install(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(
          [
            "sudo apt-get update",
            `sudo apt-get install -y ruby${version} ruby${version}-dev`,
          ].join(" && "),
          { stdio: "inherit" },
        );
      },
      async uninstall(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(`sudo apt-get remove -y ruby${version}*`, { stdio: "inherit" });
      },
    });

    const runtimeSection = defineSettings("ruby-versions", "Installed Versions")
      .description("Manage Ruby versions installed on this machine")
      .configPath("runtimes.ruby")
      .type("runtime-manager")
      .language("ruby")
      .build();

    const configSection = defineSettings("ruby-config", "Configuration")
      .description("Default Ruby settings for new projects")
      .configPath("runtimes.ruby")
      .field({
        id: "defaultVersion",
        label: "Default Version",
        type: "select",
        description: "Version used when creating new projects",
        options: VERSIONS.map((v) => ({ value: v.version, label: v.label })),
        defaultValue: "3.4",
      })
      .field({
        id: "framework",
        label: "Default Framework",
        type: "select",
        description: "Framework scaffolded for new web projects",
        options: [
          { value: "rails", label: "Ruby on Rails" },
          { value: "sinatra", label: "Sinatra" },
          { value: "hanami", label: "Hanami" },
          { value: "none", label: "None" },
        ],
        defaultValue: "rails",
      })
      .build();

    api.registerSettingsPage(
      defineSettingsPage("ruby-settings", "Ruby")
        .description("Ruby runtime versions and configuration")
        .icon("ruby")
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
