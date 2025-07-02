import { invoke } from "@tauri-apps/api/core";
import {
  AccessToken,
  AccessTokenSchemaFromString,
  IntegrationArray,
  IntegrationArraySchemaFromString,
} from "./types";
import { Stronghold } from "../stronghold";

const STORE_KEY = "gocardless_access_token";

async function getNewAccessToken(): Promise<AccessToken> {
  try {
    // Get the access token from the API
    const response = await invoke("call_gocardless_get_access_token");
    return AccessTokenSchemaFromString.parse(response);
  } catch (error) {
    throw new Error("Failed to refresh access tokens, " + error);
  }
}

async function refreshAccessToken(): Promise<AccessToken> {
  try {
    // Get the access token from the API
    const response = await invoke("call_gocardless_get_access_token");
    return AccessTokenSchemaFromString.parse(response);
  } catch (error) {
    throw new Error("Failed to refresh access tokens, " + error);
  }
}

async function getAccessToken(): Promise<AccessToken> {
  try {
    // Get the access token from the Stronghold
    const stronghold = await Stronghold.init();
    const storedToken = await stronghold.get(STORE_KEY);
    if (storedToken) {
      return AccessTokenSchemaFromString.parse(storedToken);
    }

    // Refresh the access token if it's expired
    const refreshedToken = await getNewAccessToken();

    // Store the access token in the Stronghold
    await stronghold.insert(STORE_KEY, JSON.stringify(refreshedToken));
    await stronghold.save();

    return refreshedToken;
  } catch (error) {
    throw new Error("Failed to get access tokens, " + error);
  }
}

async function getInstitutions(countryCode: string): Promise<IntegrationArray> {
  const accessToken = await getAccessToken();
  const response = await invoke("call_gocardless_get_institutions", {
    access_token: accessToken.access,
    country_code: countryCode,
  });
  return IntegrationArraySchemaFromString.parse(response);
}

export { getAccessToken, getInstitutions };
