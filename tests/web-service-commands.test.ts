import test from "node:test";
import assert from "node:assert/strict";
import module from "node:module";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const PI_AGENT_PKG_DIR = "/home/pi/.npm-global/pi/node_modules/@earendil-works/pi-coding-agent";

module.registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "@earendil-works/pi-coding-agent") {
            return {
                shortCircuit: true,
                url: pathToFileURL(path.join(PI_AGENT_PKG_DIR, "dist/index.js")).href,
            };
        }
        return nextResolve(specifier, context);
    },
});

const { buildSystemPromptSections, diffSystemPromptSections } = await import(
    pathToFileURL(path.join(PI_AGENT_PKG_DIR, "dist/core/system-prompt.js")).href
);

const EXTENSION_PATH =
    process.env.PI_WEB_SERVICE_COMMANDS_EXTENSION_PATH ||
    path.resolve(
        import.meta.dirname,
        "../pi/global/agent/extensions/web-service-commands.ts"
    );

const { default: webServiceCommandsExtension } = await import(
    pathToFileURL(EXTENSION_PATH).href
);

function createMockPi() {
    const handlers: Record<string, Array<(event: any, ctx: any) => Promise<any> | any>> = {};
    const pi: any = {
        on(event: string, handler: (event: any, ctx: any) => Promise<any> | any) {
            handlers[event] = handlers[event] || [];
            handlers[event].push(handler);
        },
    };
    webServiceCommandsExtension(pi);
    return handlers;
}

test("web-service-commands before_agent_start", async (t) => {
    await t.test("sets structured ddev_web_container section without overriding systemPrompt", async () => {
        const handlers = createMockPi();
        const beforeAgentStart = handlers["before_agent_start"]?.[0];
        assert.ok(beforeAgentStart, "before_agent_start handler must be registered");

        const sections: Record<string, string> = {};
        const event = {
            type: "before_agent_start",
            messageType: "user",
            prompt: "Run phpunit",
            systemPrompt: "...",
            systemPromptOptions: { sections },
        };

        const result = await beforeAgentStart(event, {});

        assert.strictEqual(result, undefined, "must not return a systemPrompt override");
        assert.ok(
            typeof sections.ddev_web_container === "string" && sections.ddev_web_container.length > 0,
            "expected sections.ddev_web_container to be populated"
        );

        for (const tool of [
            "`php`",
            "`composer`",
            "`drush`",
            "`phpunit`",
            "`phpstan`",
            "`phpcs`",
            "`phpcbf`",
            "`behat`",
            "`yarn`",
            "`npm`",
        ]) {
            assert.ok(
                sections.ddev_web_container.includes(tool),
                `expected section to mention ${tool}`
            );
        }

        assert.ok(
            sections.ddev_web_container.includes("Use `/usr/bin/npm` to run `npm` locally inside the `pi` container."),
            "expected section to include local /usr/bin/npm instruction"
        );
        assert.ok(
            sections.ddev_web_container.includes("Run tools directly without prefixing with `ssh web` or `ddev exec`."),
            "expected section to instruct running tools directly"
        );
    });

    await t.test("is idempotent and produces zero section diff across turns", async () => {
        const handlers = createMockPi();
        const beforeAgentStart = handlers["before_agent_start"][0];

        const turn1Options = { cwd: "/var/www/html", sections: {} as Record<string, string> };
        await beforeAgentStart(
            {
                type: "before_agent_start",
                messageType: "user",
                prompt: "Turn 1",
                systemPrompt: "...",
                systemPromptOptions: turn1Options,
            },
            {}
        );
        const turn1Sections = buildSystemPromptSections(turn1Options);
        assert.ok(turn1Sections.ddev_web_container?.startsWith("<ddev_web_container>\n"));

        const turn2Options = { cwd: "/var/www/html", sections: {} as Record<string, string> };
        await beforeAgentStart(
            {
                type: "before_agent_start",
                messageType: "user",
                prompt: "Turn 2",
                systemPrompt: "...",
                systemPromptOptions: turn2Options,
            },
            {}
        );
        const turn2Sections = buildSystemPromptSections(turn2Options);

        assert.strictEqual(
            diffSystemPromptSections(turn1Sections, turn2Sections),
            undefined,
            "expected no system prompt section diff between turns"
        );
    });
});

test("web-service-commands tool_call", async (t) => {
    const createCtx = () => {
        const notifications: Array<{ message: string; level: string }> = [];
        return {
            notifications,
            ui: {
                notify(message: string, level: string) {
                    notifications.push({ message, level });
                },
            },
        };
    };

    await t.test("normalizes vendor/bin/ and ./ prefixes and notifies", async () => {
        const handlers = createMockPi();
        const toolCall = handlers["tool_call"]?.[0];
        assert.ok(toolCall, "tool_call handler must be registered");

        const cases = [
            { input: "vendor/bin/phpunit tests/", expected: "phpunit tests/", tool: "phpunit" },
            { input: "./drush cr", expected: "drush cr", tool: "drush" },
            { input: "./vendor/bin/phpstan analyse", expected: "phpstan analyse", tool: "phpstan" },
            {
                input: "SIMPLETEST_BASE_URL=http://web ./vendor/bin/phpunit",
                expected: "SIMPLETEST_BASE_URL=http://web phpunit",
                tool: "phpunit",
            },
            { input: "composer install", expected: "composer install", tool: "composer" },
        ];

        for (const c of cases) {
            const ctx = createCtx();
            const event = {
                type: "tool_call",
                toolName: "bash",
                input: { command: c.input },
            };

            await toolCall(event, ctx);

            assert.strictEqual(event.input.command, c.expected);
            assert.deepStrictEqual(ctx.notifications, [
                { message: `Routed to web container: ${c.tool}`, level: "info" },
            ]);
        }
    });

    await t.test("ignores ssh web commands, non-web commands, and non-bash tools", async () => {
        const handlers = createMockPi();
        const toolCall = handlers["tool_call"][0];

        for (const cmd of ["ssh web drush cr", "ls -la", "/usr/bin/npm --version"]) {
            const ctx = createCtx();
            const event = {
                type: "tool_call",
                toolName: "bash",
                input: { command: cmd },
            };
            await toolCall(event, ctx);
            assert.strictEqual(event.input.command, cmd);
            assert.deepStrictEqual(ctx.notifications, []);
        }

        const ctx = createCtx();
        const readEvent = {
            type: "tool_call",
            toolName: "read",
            input: { path: "composer.json" },
        };
        await toolCall(readEvent, ctx);
        assert.deepStrictEqual(ctx.notifications, []);
    });
});
