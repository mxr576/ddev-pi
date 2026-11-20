import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";

const EXTENSION_PATH =
    process.env.PI_WEB_SERVICE_COMMANDS_EXTENSION_PATH ||
    path.resolve(
        import.meta.dirname,
        "../pi/global/agent/extensions/web-service-commands.ts"
    );

function runCommand(
    cmd: string,
    args: string[],
    options: { env?: NodeJS.ProcessEnv; cwd?: string; timeoutMs?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, {
            env: options.env,
            cwd: options.cwd,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
            p.kill();
            reject(new Error(`${cmd} ${args.join(" ")} timed out`));
        }, options.timeoutMs ?? 60_000);

        p.stdout.on("data", (d) => {
            stdout += d.toString();
        });
        p.stderr.on("data", (d) => {
            stderr += d.toString();
        });
        p.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}. Stderr: ${stderr}`));
            }
        });
        p.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

async function withTempAgentDir<T>(
    providers: Record<string, unknown>,
    fn: (env: NodeJS.ProcessEnv, tempAgentDir: string) => Promise<T>
): Promise<T> {
    const tempAgentDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-web-cmds-e2e-"));
    fs.writeFileSync(path.join(tempAgentDir, "models.json"), JSON.stringify({ providers }));
    try {
        return await fn(
            {
                ...process.env,
                PI_CODING_AGENT_DIR: tempAgentDir,
                PI_OFFLINE: "1",
            },
            tempAgentDir
        );
    } finally {
        fs.rmSync(tempAgentDir, { recursive: true, force: true });
    }
}

function getSystemPromptText(body: any): string {
    return (body.messages || [])
        .filter((m: any) => m.role === "system")
        .map((m: any) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
        .join("\n");
}

function startMockChatServer() {
    const capturedBodies: any[] = [];
    const server = http.createServer((req, res) => {
        if (req.url?.includes("/chat/completions")) {
            let body = "";
            req.on("data", (chunk) => {
                body += chunk.toString();
            });
            req.on("end", () => {
                try {
                    capturedBodies.push(JSON.parse(body));
                } catch {
                    capturedBodies.push(body);
                }
                res.writeHead(200, {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                });
                res.write(
                    "data: " +
                        JSON.stringify({
                            id: "chatcmpl-mock",
                            object: "chat.completion.chunk",
                            choices: [{ index: 0, delta: { role: "assistant", content: "ok" }, finish_reason: null }],
                        }) +
                        "\n\n"
                );
                res.write(
                    "data: " +
                        JSON.stringify({
                            id: "chatcmpl-mock",
                            object: "chat.completion.chunk",
                            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                        }) +
                        "\n\n"
                );
                res.write("data: [DONE]\n\n");
                res.end();
            });
            return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [] }));
    });

    return { capturedBodies, server };
}

test("Mock LLM E2E: injects <ddev_web_container> section and keeps system prompt stable across turns", async () => {
    const { capturedBodies, server } = startMockChatServer();

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const mockBaseUrl = `http://127.0.0.1:${address.port}/v1`;

    try {
        await withTempAgentDir(
            {
                "mock-provider": {
                    baseUrl: mockBaseUrl,
                    api: "openai-completions",
                    apiKey: "sk-mock",
                    models: [{ id: "mock-model" }],
                },
            },
            async (env, tempAgentDir) => {
                const sessionDir = path.join(tempAgentDir, "sessions");

                // 1. Default system prompt — Turn 1
                await runCommand(
                    "pi",
                    [
                        "-p",
                        "--session-dir",
                        sessionDir,
                        "--no-tools",
                        "--no-extensions",
                        "-e",
                        EXTENSION_PATH,
                        "--provider",
                        "mock-provider",
                        "--model",
                        "mock-model",
                        "Reply with ok.",
                    ],
                    { env }
                );

                // 2. Default system prompt — Turn 2 (continue session)
                await runCommand(
                    "pi",
                    [
                        "-p",
                        "-c",
                        "--session-dir",
                        sessionDir,
                        "--no-tools",
                        "--no-extensions",
                        "-e",
                        EXTENSION_PATH,
                        "--provider",
                        "mock-provider",
                        "--model",
                        "mock-model",
                        "Reply with ok again.",
                    ],
                    { env }
                );

                // 3. Custom system prompt (--system-prompt)
                await runCommand(
                    "pi",
                    [
                        "-p",
                        "--no-session",
                        "--no-tools",
                        "--no-extensions",
                        "-e",
                        EXTENSION_PATH,
                        "--provider",
                        "mock-provider",
                        "--model",
                        "mock-model",
                        "--system-prompt",
                        "Custom system prompt.",
                        "Reply with ok.",
                    ],
                    { env }
                );

                assert.equal(capturedBodies.length, 3, "Expected three /chat/completions requests");

                for (const [index, body] of capturedBodies.entries()) {
                    const systemText = getSystemPromptText(body);
                    assert.ok(
                        systemText.includes("<ddev_web_container>"),
                        `Request ${index + 1}: expected <ddev_web_container> XML section in system prompt`
                    );
                    assert.ok(
                        systemText.includes("The following tools automatically execute in the DDEV web container:"),
                        `Request ${index + 1}: expected web container tools rule in system prompt`
                    );
                    assert.ok(
                        systemText.includes("Use `/usr/bin/npm` to run `npm` locally inside the `pi` container."),
                        `Request ${index + 1}: expected /usr/bin/npm rule in system prompt`
                    );
                }

                assert.equal(
                    getSystemPromptText(capturedBodies[1]),
                    getSystemPromptText(capturedBodies[0]),
                    "Expected system prompt on turn 2 to be byte-for-byte identical to turn 1"
                );

                assert.ok(
                    getSystemPromptText(capturedBodies[2]).includes("Custom system prompt."),
                    "Request 3: expected custom system prompt to be preserved"
                );
            }
        );
    } finally {
        server.close();
    }
});
