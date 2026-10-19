//#ddev-generated
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

// Tools forwarded to the DDEV web container via /usr/local/bin system shims.
const WEB_TOOLS = ["php", "composer", "drush", "phpunit", "phpstan", "phpcs", "phpcbf", "behat", "yarn", "npm"] as const;

// Pattern matching any web tool invocation, bare or prefixed with (./)vendor/bin/
const WEB_TOOL_PATTERN = new RegExp(
  `^(?:\\./)?(?:vendor/bin/)?(${WEB_TOOLS.join("|")})\\b`
);

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    const toolList = WEB_TOOLS.map((t) => `\`${t}\``).join(", ");

    const instruction =
      "\n\n### Web Container Tool Execution Rules\n" +
      `The following tools automatically execute in the DDEV web container: ${toolList}.\n` +
      "All required environment variables (SIMPLETEST_DB, SIMPLETEST_BASE_URL, MINK_DRIVER_ARGS_WEBDRIVER, etc.)\n" +
      "and working directory are preserved automatically.\n" +
      "Run tools directly without prefixing with `ssh web` or `ddev exec`.";

    return { systemPrompt: event.systemPrompt + instruction };
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    const originalCmd = event.input.command;
    if (originalCmd.startsWith("ssh web")) return;

    const match = originalCmd.match(WEB_TOOL_PATTERN);
    if (!match) return;

    const toolName = match[1];

    // Normalize any prefixed invocation (e.g., `vendor/bin/phpunit`, `./drush`)
    // to the bare tool name so it resolves directly to the /usr/local/bin shim.
    if (!originalCmd.startsWith(toolName)) {
      event.input.command = originalCmd.replace(
        new RegExp(`^(?:\\./)?(?:vendor/bin/)?${toolName}`),
        toolName
      );
    }

    ctx.ui.notify(`Routed to web container: ${toolName}`, "info");
  });
}
