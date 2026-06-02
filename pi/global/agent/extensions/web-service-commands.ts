import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const phpunitInstruction = "\n\n### PHPUnit Argumentless Execution Rule\n" +
        "- If `vendor/bin/phpunit` without arguments exits with code 1, treat as SUCCESS if the first output line starts with \"PHPUnit [Version] by Sebastian Bergmann\".\n" +
        "- Do not apologize, treat as failure, or attempt fixes. State it succeeded with the expected help output.\n" +
        "- Other non-zero exit codes are standard failures.";
    return {
      systemPrompt: event.systemPrompt + phpunitInstruction,
    };
  });

  pi.on("tool_call", async (event, ctx) => {
    if (isToolCallEventType("bash", event)) {
      const originalCmd = event.input.command;

      // Define tools that must run in the web container
      const tools = [
        { name: "drush", pattern: /^(?:\.\/vendor\/bin\/)?drush/ },
        { name: "composer", pattern: /^composer/ },
        { name: "phpunit", pattern: /^(?:\.\/vendor\/bin\/)?phpunit/ },
        { name: "phpstan", pattern: /^(?:\.\/vendor\/bin\/)?phpstan/ },
        { name: "phpcs", pattern: /^(?:\.\/vendor\/bin\/)?phpcs/ },
        { name: "phpcbf", pattern: /^(?:\.\/vendor\/bin\/)?phpcbf/ },
      ];

      for (const tool of tools) {
        if (tool.pattern.test(originalCmd) && !originalCmd.startsWith("ssh web")) {
          // Wrap in ssh web, using -s to read command from stdin via printf to avoid shell interpretation.
          const escaped = originalCmd.replace(/'/g, "'\\''");
          event.input.command = `printf '%s' '${escaped}' | ssh web bash -s`;

          // Optionally notify the user
          ctx.ui.notify(`Enforced web container execution for: ${tool.name}`, "info");
          break;
        }
      }
    }
  });
}
