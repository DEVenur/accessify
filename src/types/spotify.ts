export interface SpotifyToken {
	accessToken: string;
	accessTokenExpirationTimestampMs: number;
	clientId?: string;
	isAnonymous?: boolean;
	[key: string]: unknown;
}

export interface TokenProxy {
	type: string;
	fetch: (
		cookies?: Array<{ name: string; value: string }>,
	) => Promise<SpotifyToken>;
	readonly data: SpotifyToken | undefined;
	valid(): boolean;
	refresh(): Promise<SpotifyToken>;
}
