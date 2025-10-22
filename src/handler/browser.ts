import playwright from "playwright";
import type {
	Browser,
	LaunchOptions,
	BrowserContext,
	Response,
	Page,
} from "playwright";
import type { SpotifyToken } from "../types/spotify";
import { logs } from "../utils/logger";

export class SpotifyBrowser {
	private browser: Browser | undefined;
	private context: BrowserContext | undefined;
	private persistentPage: Page | undefined;

	private async ensureBrowser(): Promise<{
		browser: Browser;
		context: BrowserContext;
	}> {
		if (!this.browser || !this.context) {
			try {
				const executablePath =
					process.env.BROWSER_PATH && process.env.BROWSER_PATH.trim() !== ""
						? process.env.BROWSER_PATH
						: undefined;
				const launchOptions: LaunchOptions = {
					headless: true,
					args: [
						"--disable-gpu",
						"--disable-dev-shm-usage",
						"--disable-setuid-sandbox",
						"--no-sandbox",
						"--no-zygote",
						"--disable-extensions",
						"--disable-background-timer-throttling",
						"--disable-blink-features=AutomationControlled",
						"--disable-backgrounding-occluded-windows",
						"--disable-renderer-backgrounding",
						"--window-size=1920,1080",
					],
				};
				if (executablePath) launchOptions.executablePath = executablePath;

				this.browser = await playwright.chromium.launch(launchOptions);
				this.context = await this.browser.newContext({
					userAgent:
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
				});

				this.persistentPage = await this.context.newPage();
				
                // --- AJUSTE 1: Adicionado timeout e waitUntil na primeira navegação ---
				await this.persistentPage.goto("https://open.spotify.com/", {
                    waitUntil: "domcontentloaded",
                    timeout: 90000
                });

				logs("info", "Persistent page created and navigated to Spotify");
			} catch (err) {
				this.browser = undefined;
				this.context = undefined;
				logs("error", "Failed to launch browser or context", err);
				throw err;
			}
		} else {
			if (this.browser.isConnected() === false) {
				logs("warn", "Browser is not connected, relaunching...");
				this.browser = undefined;
				this.context = undefined;
				return this.ensureBrowser();
			}
			try {
				this.context.pages();
			} catch {
				logs("warn", "Context is closed, relaunching...");
				this.browser = undefined;
				this.context = undefined;
				return this.ensureBrowser();
			}
		}
		return { browser: this.browser, context: this.context };
	}

	public async fetchToken(
		cookies?: Array<{ name: string; value: string }>,
	): Promise<SpotifyToken> {
		const { context } = await this.ensureBrowser();

		return new Promise<SpotifyToken>((resolve, reject) => {
			(async () => {
				let page = this.persistentPage;
				let shouldClosePage = false;

				if (!page || page.isClosed()) {
					page = await context.newPage();
					shouldClosePage = true;
				}

				let responseReceived = false;

				try {
					await context.clearCookies();

					if (cookies && cookies.length > 0) {
						const cookieObjects = cookies.map((cookie) => ({
							name: cookie.name,
							value: cookie.value,
							domain: ".spotify.com",
							path: "/",
							httpOnly: false,
							secure: true,
							sameSite: "Lax" as const,
						}));
						await context.addCookies(cookieObjects);
						logs(
							"info",
							"Cookies set for request",
							cookieObjects.map((c) => ({
								name: c.name,
								value: `${c.value.slice(0, 20)}...`,
							})),
						);
					}

					const timeout = setTimeout(() => {
						if (!responseReceived) {
							logs("error", "Token fetch timeout");
							if (shouldClosePage) page.close();
							reject(new Error("Token fetch exceeded deadline"));
						}
					}, 25000); // Aumentado para 25s por segurança

					page.on("response", async (response: Response) => {
						// A implementação padrão do accessify usa 'client_token.json'. Usar ambas as verificações torna o código mais robusto.
						if (!response.url().includes("/api/token") && !response.url().includes("client_token.json")) return;

						responseReceived = true;
						clearTimeout(timeout);

						try {
							if (!response.ok()) {
								if (shouldClosePage) await page.close();
								return reject(new Error(`Invalid response from Spotify: ${response.status()}`));
							}

							const json = await response.json();
							
							if (
								json &&
								typeof json === "object" &&
								json !== null &&
								"_notes" in json
							) {
								delete (json as Record<string, unknown>)._notes;
							}

							if (shouldClosePage) await page.close();
							resolve(json as SpotifyToken);
						} catch (error) {
							if (shouldClosePage) await page.close();
							logs("error", `Failed to process token response: ${error}`);
							reject(new Error(`Failed to process token response: ${error}`));
						}
					});

					// --- AJUSTE 2: Lógica de bloqueio de rotas foi suavizada ---
					await page.route("**/*", (route) => {
						const request = route.request();
                        const url = request.url();
                        const type = request.resourceType();

						// Não bloqueia a requisição principal do documento
                        if (type === 'document' && url.includes("open.spotify.com")) {
                            return route.continue();
                        }

						const blockedTypes = new Set([
							"image",
							"stylesheet",
							"font",
							"media",
						]);

						const blockedPatterns = [
							"google-analytics",
							"googletagmanager.com",
						];

						const isBlockedUrl = (u: string) =>
							blockedPatterns.some((pat) => u.includes(pat));

						if (blockedTypes.has(type) || isBlockedUrl(url)) {
							return route.abort();
						}

						return route.continue();
					});

					// --- AJUSTE 3: Adicionado timeout e waitUntil na segunda navegação ---
					await page.goto("https://open.spotify.com/", {
                        waitUntil: "domcontentloaded",
                        timeout: 90000
                    });

				} catch (error) {
					if (!responseReceived) {
						if (shouldClosePage) await page.close();
						logs("error", `Navigation failed: ${error}`);
						reject(new Error(`Navigation failed: ${error}`));
					}
				}
			})();
		});
	}

	public async close(): Promise<void> {
		if (this.persistentPage && !this.persistentPage.isClosed()) {
			await this.persistentPage.close();
			this.persistentPage = undefined;
		}
		if (this.browser) {
			await this.browser.close();
			this.browser = undefined;
			this.context = undefined;
		}
	}
}
