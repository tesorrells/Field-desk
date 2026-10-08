import {storage} from './storage';
import type {FeedSnapshot} from './community';
// Namespace regional feeds in the existing source-cache table. No study data is written.
export async function readCommunity(id:string){const row=await storage().prepare('SELECT content FROM place_cache WHERE id=?').bind('community:'+id).first<{content:string}>();return row?JSON.parse(row.content) as FeedSnapshot:undefined;}
export async function writeCommunity(feed:FeedSnapshot){await storage().prepare('INSERT INTO place_cache (id,content,fetched_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,fetched_at=excluded.fetched_at').bind('community:'+feed.sourceId,JSON.stringify(feed),feed.checkedAt).run();}
