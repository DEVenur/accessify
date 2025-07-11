import type { Context } from "hono";
import type { SpotifyToken, TokenProxy } from "../types/spotify";
import { logs } from "../utils/logger";
import type { Semaphore } from "../utils/semaphore";

export async function handleRequest(
	c: Context,
	isForce: boolean,
	getToken: (
		cookies?: Array<{ name: string; value: string }>,
	) => Promise<SpotifyToken>,
	getCachedToken: () => SpotifyToken | undefined,
	setCachedToken: (token: SpotifyToken) => void,
	semaphore: Semaphore,
	cookies?: Array<{ name: string; value: string }>,
): Promise<Response> {
	const token: TokenProxy = {
		type: "cachedAccessToken",
		fetch: () => getToken(cookies),
		get data() {
			return getCachedToken();
		},
		valid() {
			return (
				(this.data?.accessTokenExpirationTimestampMs || 0) - 10000 > Date.now()
			);
		},
		async refresh() {
			const data = await this.fetch();
			setCachedToken(data);
			return data;
		},
	};

	if (cookies && cookies.length > 0) {
		const release = await semaphore.acquire();
		try {
			const freshToken = await token.refresh();
			return c.json(freshToken, 200);
		} catch (e) {
			logs("error", e);
			return c.json({}, 500);
		} finally {
			release();
		}
	}

	if (!isForce && token.valid()) {
		return c.json(token.data, 200);
	}

	const release = await semaphore.acquire();
	try {
		if (!isForce && token.valid()) {
			return c.json(token.data, 200);
		} else {
			const refreshed = await token.refresh();
			return c.json(refreshed, 200);
		}
	} catch (e) {
		logs("error", e);
		return c.json({}, 500);
	} finally {
		release();
	}
}
