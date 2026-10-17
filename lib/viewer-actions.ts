"use server";

import { listTrackedCompanies } from "@/lib/company-actions";
import { listLikedCvIds } from "@/lib/cv-actions";
import { listFavorites, listNotifications, listSubmissions } from "@/lib/data-actions";
import { getMyProfile } from "@/lib/profile-actions";

/**
 * Everything the signed-in chrome needs, in one request. Each server action
 * called from the browser is its own Worker request and they run one after
 * another, so loading these separately cost a round-trip each per page load.
 * The session comes from the signed cookie cache, so the D1 reads are the
 * only database work.
 */
export async function getViewerState() {
  const [profile, favorites, tracked, submissions, notifications, likedCvs] = await Promise.all([
    getMyProfile(),
    listFavorites(),
    listTrackedCompanies(),
    listSubmissions(),
    listNotifications(),
    listLikedCvIds(),
  ]);
  return { profile, favorites, tracked, submissions, notifications, likedCvs };
}
