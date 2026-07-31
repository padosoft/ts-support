export const formatTimeLeft = (date?: Date | null | undefined): string => {
	if (!date) return "unknown";

	const ms = date.getTime() - Date.now();
	if (ms <= 0) return "EXPIRED";

	const totalSeconds = Math.floor(ms / 1000);

	const yearSeconds = 365 * 24 * 3600;
	const monthSeconds = 30 * 24 * 3600;
	const daySeconds = 24 * 3600;

	const y = Math.floor(totalSeconds / yearSeconds);
	const mo = Math.floor((totalSeconds % yearSeconds) / monthSeconds);
	const d = Math.floor((totalSeconds % monthSeconds) / daySeconds);
	const h = Math.floor((totalSeconds % daySeconds) / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;

	if (y > 0) return `${y}y ${mo}mo ${d}d ${h}h`;
	if (mo > 0) return `${mo}mo ${d}d ${h}h ${m}m`;
	if (d > 0) return `${d}d ${h}h ${m}m`;
	if (h > 0) return `${h}h ${m}m ${s}s`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
};
