import { describe, expect, it } from "vitest";
import { categories, getProductsForCategory, products } from "./data";

describe("shop data", () => {
  it("maps every category slug to the requested products", () => {
    expect(categories.map((category) => category.slug)).toEqual([
      "starter-program",
      "uniforms",
      "gloves",
      "youth-sparring-equipment",
      "adult-sparring-equipment",
      "chos-apparel"
    ]);

    expect(getProductsForCategory("uniforms").map((product) => product.name)).toEqual([
      "Leadership uniform",
      "Uniform (Black cross-over w/ patches and logo)",
      "Upgraded Red/blk V-neck",
      "White Basic Uniform w/ patches and logo"
    ]);

    expect(getProductsForCategory("adult-sparring-equipment").map((product) => product.name)).toEqual([
      "Adult inside groin cup",
      "Basic hand wraps Black",
      "Basic hand wraps red",
      "C2 MMA Sparring head guard L/XL",
      "KRBN MMA Shin Guards L/XL",
      "MMA Duffle Bag",
      "MMA Elbow Pads L/XL Black",
      "MMA Elbow Pads L/XL Red",
      "Mouth piece + Case"
    ]);

    expect(products).toHaveLength(21);
  });
});
