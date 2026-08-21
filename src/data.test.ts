import { describe, expect, it } from "vitest";
import { appTopics, categories, getProductsForCategory, moreTopics, parentTopics, products, studentTopics, termsSections } from "./data";

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

describe("public privacy policy", () => {
  it("publishes the required mobile privacy and SMS consent protections", () => {
    const privacy = termsSections.find((section) => section.title === "Privacy Policy");

    expect(privacy?.content).toContain("will not be shared, sold, rented, or disclosed");
    expect(privacy?.content).toContain("third parties or affiliates for marketing or promotional purposes");
    expect(privacy?.content).toContain("Reply STOP to opt out and HELP for help");
  });
});

describe("app topic data", () => {
  it("groups the post-login launcher topics in the intended order", () => {
    expect(studentTopics.map((topic) => topic.label)).toEqual([
      "Today",
      "Classes",
      "My Progress",
      "Practice",
      "Programs",
      "Ask for Help"
    ]);

    expect(studentTopics.map((topic) => topic.path)).toEqual([
      "/",
      "/classes",
      "/my-account?topic=progress",
      "/programs?section=practice",
      "/programs",
      "/contact-us"
    ]);

    expect(parentTopics.map((topic) => topic.label)).toEqual(["Shop", "Bookings", "Orders", "Profile"]);
    expect(parentTopics.map((topic) => topic.path)).toEqual([
      "/shop",
      "/my-account?topic=bookings",
      "/my-account?topic=orders",
      "/my-account?topic=profile"
    ]);

    expect(moreTopics.map((topic) => topic.label)).toEqual([
      "Shop",
      "Bookings",
      "Orders",
      "Profile",
      "Private Lessons",
      "About Cho's",
      "Contact",
      "Terms"
    ]);

    expect(appTopics).toEqual([...studentTopics, ...parentTopics]);
  });
});
