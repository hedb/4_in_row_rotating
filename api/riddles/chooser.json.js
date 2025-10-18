const fs = require('fs');
const path = require('path');

function toUtcDateStr(date = new Date()) {
	const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	return d.toISOString().slice(0, 10);
}

function daysSinceEpochUtc(dateStr) {
	return Math.floor(Date.parse(dateStr) / 86400000);
}

function isEnabled(dateStr, todayStr) {
	const todayDays = daysSinceEpochUtc(todayStr);
	const dDays = daysSinceEpochUtc(dateStr);
	return dDays <= todayDays && dDays >= todayDays - 19; // last 20 days including today
}

function clampToRange(dateStr, startStr, endStr) {
	return dateStr >= startStr && dateStr <= endStr;
}

module.exports = async (req, res) => {
	const requestStartMs = Date.now();
	const requestId = (req && (req.headers['x-vercel-id'] || req.headers['x-request-id'])) || Math.random().toString(36).slice(2);
	try {
		console.log('[chooser] start', {
			requestId,
			method: req && req.method,
			url: req && req.url,
			host: req && req.headers && req.headers.host,
			xForwardedFor: req && req.headers && req.headers['x-forwarded-for'],
			cwd: process.cwd(),
			__dirname,
			envHasCustomPath: Boolean(process.env.RIDDLES_JSON_PATH)
		});
		const SINCE = '2025-09-01';
		const todayUtc = toUtcDateStr();

		const riddlesPath = process.env.RIDDLES_JSON_PATH || path.join(process.cwd(), 'solving', 'output', 'riddles_calendar.json');
		console.log('[chooser] resolved paths', { requestId, riddlesPath });
		const raw = fs.readFileSync(riddlesPath, 'utf8');
		console.log('[chooser] file read ok', { requestId, bytes: raw.length });
		const all = JSON.parse(raw);
		const totalKeys = Object.keys(all || {}).length;
		console.log('[chooser] json parsed', { requestId, totalKeys });

		// Collect relevant dates between SINCE and todayUtc that exist in the source JSON
		const dates = Object.keys(all)
			.filter((d) => clampToRange(d, SINCE, todayUtc))
			.sort();

		const items = dates.map((date) => {
			const entry = all[date] || {};
			return {
				date,
				enabled: isEnabled(date, todayUtc),
				board: entry.board,
				rotation_counter: entry.rotation_counter,
				step_to_win: entry.step_to_win,
			};
		});

		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
		res.status(200).end(JSON.stringify({ since: '2025-09-01', todayUtc, items }));
		console.log('[chooser] success', { requestId, items: items.length, durationMs: Date.now() - requestStartMs });
	} catch (err) {
		res.statusCode = 500;
		res.setHeader('Content-Type', 'application/json');
		const message = err && err.message ? err.message : String(err);
		console.error('[chooser] error', { requestId, message, stack: err && err.stack, durationMs: Date.now() - requestStartMs });
		res.end(JSON.stringify({ error: 'internal_error', message }));
	}
};


