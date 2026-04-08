import {
  createPlugin,
  defineRuntime,
  defineSettings,
  defineSettingsPage,
} from "@aionima/sdk";

const VERSIONS = [
  { id: "python-310", label: "Python 3.10", version: "3.10", image: "python:3.10-alpine", port: 8000 },
  { id: "python-311", label: "Python 3.11", version: "3.11", image: "python:3.11-alpine", port: 8000 },
  { id: "python-312", label: "Python 3.12", version: "3.12", image: "python:3.12-alpine", port: 8000 },
  { id: "python-313", label: "Python 3.13", version: "3.13", image: "python:3.13-alpine", port: 8000 },
];

export default createPlugin({
  async activate(api) {
    for (const v of VERSIONS) {
      api.registerRuntime(
        defineRuntime(v.id, v.label)
          .language("python")
          .version(v.version)
          .containerImage(v.image)
          .internalPort(v.port)
          .projectTypes(["app", "web"])
          .dependency({ name: "pip", version: "bundled", type: "bundled" })
          .installable(true)
          .build(),
      );
    }

    api.registerRuntimeInstaller({
      language: "python",
      listAvailable: () => VERSIONS.map((v) => v.version),
      async listInstalled() {
        const { execSync } = await import("node:child_process");
        const installed: string[] = [];
        for (const v of VERSIONS) {
          try {
            execSync(`python${v.version} --version`, { encoding: "utf-8", stdio: "pipe" });
            installed.push(v.version);
          } catch {
            // not installed
          }
        }
        return installed;
      },
      async install(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(
          [
            "sudo add-apt-repository -y ppa:deadsnakes/ppa",
            "sudo apt-get update",
            `sudo apt-get install -y python${version} python${version}-venv python${version}-dev`,
          ].join(" && "),
          { stdio: "inherit" },
        );
      },
      async uninstall(version: string) {
        const { execSync } = await import("node:child_process");
        execSync(`sudo apt-get remove -y python${version}*`, { stdio: "inherit" });
      },
    });

    const runtimeSection = defineSettings("python-versions", "Installed Versions")
      .description("Manage Python versions installed on this machine")
      .configPath("runtimes.python")
      .type("runtime-manager")
      .language("python")
      .build();

    const configSection = defineSettings("python-config", "Configuration")
      .description("Default Python settings for new projects")
      .configPath("runtimes.python")
      .field({
        id: "defaultVersion",
        label: "Default Version",
        type: "select",
        description: "Version used when creating new projects",
        options: VERSIONS.map((v) => ({ value: v.version, label: v.label })),
        defaultValue: "3.12",
      })
      .field({
        id: "virtualEnv",
        label: "Virtual Environment Tool",
        type: "select",
        description: "Tool for creating isolated environments",
        options: [
          { value: "venv", label: "venv (built-in)" },
          { value: "poetry", label: "Poetry" },
          { value: "uv", label: "uv" },
          { value: "conda", label: "Conda" },
        ],
        defaultValue: "venv",
      })
      .build();

    api.registerSettingsPage(
      defineSettingsPage("python-settings", "Python")
        .description("Python runtime versions and configuration")
        .icon("python")
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
