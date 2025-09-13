// Minimal analytics helper for PWA game

const STORAGE_KEYS = {
	playerId: 'analytics_player_id',
	firstSeen: 'analytics_first_seen',
	lastActiveDay: 'analytics_last_active_day',
};

function generateId(prefix = 'u') {
	return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function getOrCreatePlayerId() {
	let id = localStorage.getItem(STORAGE_KEYS.playerId);
	if (!id) {
		id = generateId('player');
		localStorage.setItem(STORAGE_KEYS.playerId, id);
		// mark first seen
		if (!localStorage.getItem(STORAGE_KEYS.firstSeen)) {
			localStorage.setItem(STORAGE_KEYS.firstSeen, String(Date.now()));
		}
	}
	return id;
}

function getDayNumberSinceSignup() {
	const first = Number(localStorage.getItem(STORAGE_KEYS.firstSeen) || Date.now());
	const msPerDay = 24 * 60 * 60 * 1000;
	return Math.floor((Date.now() - first) / msPerDay) + 1;
}

function maybeTrackDailyReturn(trackFn) {
	try {
		const today = new Date();
		const key = `${today.getUTCFullYear()}-${today.getUTCMonth()+1}-${today.getUTCDate()}`;
		const last = localStorage.getItem(STORAGE_KEYS.lastActiveDay);
		if (last !== key) {
			localStorage.setItem(STORAGE_KEYS.lastActiveDay, key);
			trackFn('daily_return', {
				player_id: getOrCreatePlayerId(),
				day_number_since_signup: getDayNumberSinceSignup(),
			});
		}
	} catch (_) {}
}

function getDeviceContext() {
	const ua = navigator.userAgent || '';
	const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua);
	const isTablet = /iPad|Tablet/i.test(ua);
	const device_type = isTablet ? 'tablet' : (isMobile ? 'mobile' : 'desktop');
	const platform = /Android/i.test(ua) ? 'Android' : (/iPhone|iPad|iPod/i.test(ua) ? 'iOS' : 'Web');
	const pwa_install_status = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone ? 'installed' : 'browser';
	const language = (navigator.language || 'en').toLowerCase();
	return { device_type, platform, pwa_install_status, language };
}

// Replace this with real endpoint/SDK later
async function sendEvent(name, params) {
	// Forward to GA4 if available (and not on localhost), while still logging locally
	try {
		const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
		if (!isLocalhost && typeof window !== 'undefined' && typeof window.gtag === 'function') {
			// Avoid sending a duplicate identifier as a parameter when using GA4 user_id
			const { player_id, ...rest } = params || {};
			window.gtag('event', name, rest);
		}
	} catch (_) {}

	// Always keep console log for debugging
	console.log('[analytics]', name, params);
}

function nowIso() {
	return new Date().toISOString();
}

export const Analytics = (() => {
	let currentSessionId = null;

	function startSession() {
		currentSessionId = generateId('session');
		// Set GA user context once per session if GA is present
		try {
			const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
			if (!isLocalhost && typeof window !== 'undefined' && typeof window.gtag === 'function') {
				const playerId = getOrCreatePlayerId();
				// Set stable user_id for cross-session attribution
				window.gtag('set', { user_id: playerId });
				// Set useful user properties (device, platform, PWA install status, language)
				window.gtag('set', 'user_properties', getDeviceContext());
			}
		} catch (_) {}
		return currentSessionId;
	}

	function endSession() {
		currentSessionId = null;
	}

	async function trackEvent(name, params = {}) {
		const player_id = getOrCreatePlayerId();
		const session_id = params.session_id || currentSessionId || null;
		const base = {
			player_id,
			session_id,
			timestamp: nowIso(),
			...getDeviceContext(),
		};
		await sendEvent(name, { ...base, ...params });
	}

	return {
		startSession,
		endSession,
		trackEvent,
		maybeTrackDailyReturn: () => maybeTrackDailyReturn(trackEvent),
		getPlayerId: getOrCreatePlayerId,
		getSessionId: () => currentSessionId,
	};
})();


