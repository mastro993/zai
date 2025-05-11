import { invoke } from "@tauri-apps/api/core";
import { AccessToken, AccessTokenSchemaFromString } from "./types";

export const getAccessToken = async (): Promise<AccessToken> => {
  try {
    const response = await invoke("call_gocardless_get_access_token");
    return AccessTokenSchemaFromString.parse(response);
  } catch (error) {
    throw new Error("Failed to get access tokens");
  }
};
