import { describe, expect, it } from "vitest";
import { browserAuthOptions } from "../src/lib/supabase/client";

describe("authentication session safety", () => {
  it("persists and refreshes sessions while accepting recovery links", () => {
    expect(browserAuthOptions).toEqual({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    });
  });
});
