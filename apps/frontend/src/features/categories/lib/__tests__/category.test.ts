import { describe, expect, it } from "vitest";

import { categorySchema } from "../../types/model";
import { getCategoryDisplayName, getCategoryPathNames } from "../category";

const movies = categorySchema.parse({
  id: "movies",
  parentId: null,
  name: "Movies",
  role: "spending",
  color: "#284EC3",
});

const shows = categorySchema.parse({
  id: "shows",
  parentId: "movies",
  name: "Shows",
  role: "spending",
  parent: movies,
});

describe("category path names", () => {
  it("returns the root name alone", () => {
    expect(getCategoryPathNames(movies)).toEqual(["Movies"]);
    expect(getCategoryDisplayName(movies)).toBe("Movies");
  });

  it("walks parent then child", () => {
    expect(getCategoryPathNames(shows)).toEqual(["Movies", "Shows"]);
    expect(getCategoryDisplayName(shows)).toBe("Movies / Shows");
  });

  it("resolves parent from the lookup map when parent is not embedded", () => {
    const orphanChild = categorySchema.parse({
      id: "shows",
      parentId: "movies",
      name: "Shows",
      role: "spending",
    });
    const categoryById = new Map([
      [movies.id, movies],
      [orphanChild.id, orphanChild],
    ]);

    expect(getCategoryPathNames(orphanChild, categoryById)).toEqual(["Movies", "Shows"]);
  });

  it("uses the immediate parent, not the full ancestry", () => {
    const subscriptions = categorySchema.parse({
      id: "subscriptions",
      parentId: null,
      name: "Subscriptions",
      role: "spending",
      color: "#284EC3",
    });
    const nestedMovies = categorySchema.parse({
      id: "movies",
      parentId: "subscriptions",
      name: "Movies",
      role: "spending",
      parent: subscriptions,
    });
    const nestedShows = categorySchema.parse({
      id: "shows",
      parentId: "movies",
      name: "Shows",
      role: "spending",
      parent: nestedMovies,
    });

    expect(getCategoryPathNames(nestedShows)).toEqual(["Movies", "Shows"]);
  });
});
