import type { QueryClient } from "@tanstack/react-query";
import { idb } from "@/lib/idb";

export const CACHE_OWNER_KEY = "uhura-cache-owner";

export async function clearPrivateData(queryClient: QueryClient) {
  await queryClient.cancelQueries();
  queryClient.clear();

  await idb.transaction("rw", [idb.classes, idb.topics, idb.sentences, idb.progress], async () => {
    await idb.classes.clear();
    await idb.topics.clear();
    await idb.sentences.clear();
    await idb.progress.clear();
  });

  localStorage.removeItem(CACHE_OWNER_KEY);
  localStorage.removeItem("lastClassId");
}
