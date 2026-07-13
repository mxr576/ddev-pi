//#ddev-generated
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

// Tools that must run inside the DDEV web container.
// Used both for system-prompt guidance and tool_call interception — single source of truth.
const WEB_CONTAINER_TOOLS: { name: string; pattern: RegExp }[] = [
  { name: "php",     pattern: /^php\b/ },
  { name: "drush",   pattern: /^(?:\.\/)?(?:vendor\/bin\/)?drush/ },
  { name: "composer",pattern: /^composer/ },
  { name: "phpunit", pattern: /^(?:\.\/)?(?:vendor\/bin\/)?phpunit/ },
  { name: "phpstan", pattern: /^(?:\.\/)?(?:vendor\/bin\/)?phpstan/ },
  { name: "phpcs",   pattern: /^(?:\.\/)?(?:vendor\/bin\/)?phpcs/ },
  { name: "phpcbf",  pattern: /^(?:\.\/)?(?:vendor\/bin\/)?phpcbf/ },
];

// Tools that live exclusively under vendor/bin/ inside the web container and
// are not on $PATH. Any bare or prefixed invocation is rewritten to the
// canonical vendor/bin/<tool> path before being sent to the container.
const VENDOR_BIN_CANONICAL: Record<string, string> = {
  drush:   "vendor/bin/drush",
  phpunit: "vendor/bin/phpunit",
  phpstan: "vendor/bin/phpstan",
  phpcs:   "vendor/bin/phpcs",
  phpcbf:  "vendor/bin/phpcbf",
};

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const toolList = WEB_CONTAINER_TOOLS.map(t => `\`${t.name}\``).join(", ");

    const instruction =
        "\n\n### Web Container Tool Execution Rules\n" +
        `The following tools MUST be called bare, without any \`cd /path &&\` prefix: ${toolList}.\n` +
        "They are automatically intercepted and routed into the DDEV web container — all required environment\n" +
        "variables (SIMPLETEST_DB, SIMPLETEST_BASE_URL, MINK_DRIVER_ARGS_WEBDRIVER, etc.) are already available there.\n" +
        "The working directory inside the container is `/var/www/html`, so no `cd` is ever needed.\n" +
        "**NEVER** write `cd /var/www/html && vendor/bin/phpunit` — the `cd ... &&` prefix breaks interception.\n" +
        "**ALWAYS** start commands directly with the tool, e.g. `vendor/bin/phpunit`, `composer install`, `php -r ...`\n\n" +
        "PHPUnit specifics:\n" +
        "- Always invoke as: `vendor/bin/phpunit -c web/core/phpunit.xml <further args>`\n" +
        "- Do NOT pass env vars manually — they are provided automatically by the container.\n" +
        "- If run without arguments and exits with code 1, treat as SUCCESS when the first output line starts with\n" +
        "  \"PHPUnit [Version] by Sebastian Bergmann\". State it succeeded; do not apologize or attempt fixes.\n" +
        "- Any other non-zero exit code is a real failure.";

    return { systemPrompt: event.systemPrompt + instruction };
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    const originalCmd = event.input.command;
    if (originalCmd.startsWith("ssh web")) return;

    const matched = WEB_CONTAINER_TOOLS.find(t => t.pattern.test(originalCmd));
    if (!matched) return;

    // Rewrite commands for tools that live exclusively under vendor/bin/ so they
    // resolve correctly inside the container regardless of how the caller spelled
    // them (bare `drush`, `./drush`, `vendor/bin/drush`, etc.).
    let effectiveCmd = originalCmd;
    const canonicalBin = VENDOR_BIN_CANONICAL[matched.name];
    if (canonicalBin) {
      const toolName = matched.name;
      effectiveCmd = originalCmd.replace(
          new RegExp(`^(?:\\./)?(vendor/bin/)?${toolName}`),
          canonicalBin
      );
    }

    // Wrap in ssh web. Prepend a /proc/1/environ export so the non-login SSH shell
    // inherits the Docker web_environment vars that are otherwise only visible in
    // interactive `ddev ssh` sessions.
    const escaped = effectiveCmd.replace(/'/g, "'\\''");
    event.input.command =
        `printf '%s' 'export $(cat /proc/1/environ | tr "\\0" "\\n" | grep -E "^[a-zA-Z_][a-zA-Z0-9_]*=" | xargs -d "\\n") 2>/dev/null; ${escaped}' | ssh web bash -s`;

    ctx.ui.notify(`Enforced web container execution for: ${matched.name}`, "info");
  });
}
