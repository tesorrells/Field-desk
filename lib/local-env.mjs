import {openLocalDatabase} from './local-database.mjs';
// Survive development hot reloads without opening multiple SQLite connections.
const key=Symbol.for('area-study.local-database');
export const env={get DB(){globalThis[key]??=openLocalDatabase();return globalThis[key];},get OSRM_BASE_URL(){return process.env.OSRM_BASE_URL;}};
// Private starter locations from the hosted installation are intentionally absent.
