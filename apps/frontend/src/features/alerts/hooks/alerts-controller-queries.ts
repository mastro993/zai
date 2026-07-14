import { Result } from "@praha/byethrow";

import { getUnreadAlertCount } from "../commands/alerts";

export const fetchUnreadCount = async (): Promise<number | null> => {
  const countResult = await getUnreadAlertCount();
  return Result.isSuccess(countResult) ? countResult.value : null;
};
