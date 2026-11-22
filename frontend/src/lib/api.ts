/** Calls the backend with an optional JSON body. Resolves to null when the server cannot be reached. */
export async function send(method: string, path: string, body?: unknown): Promise<Response | null> {
  try {
    return await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

export const UNREACHABLE = "Could not reach the server. Check that the app is running, then try again.";
