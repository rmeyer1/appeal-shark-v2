import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";

import {
  clearZillowLookupCache,
  extractAddressComponents,
  lookupZillowValuation,
} from "@/lib/zillow/zestimate";
import * as zillowClient from "@/lib/zillow/client";

const envZillowKey = process.env.ZILLOW_API_KEY;

describe("Zillow valuation helpers", () => {
  beforeEach(() => {
    clearZillowLookupCache();
    vi.restoreAllMocks();
    process.env.ZILLOW_API_KEY = "test-key";
  });

  afterAll(() => {
    process.env.ZILLOW_API_KEY = envZillowKey;
  });

  it("extracts address components from multiline input", () => {
    const result = extractAddressComponents("123 Main St\nColumbus, OH 43215");
    expect(result).toEqual({ addressLine: "123 Main St", cityStateZip: "Columbus, OH 43215" });
  });

  it("returns null when address cannot be parsed", async () => {
    const valuation = await lookupZillowValuation("Unknown");
    expect(valuation).toBeNull();
  });

  it("parses address without commas", () => {
    const components = extractAddressComponents("200 Test Ave Austin TX 73301");
    expect(components).toEqual({ addressLine: "200 Test Ave", cityStateZip: "Austin, TX 73301" });
  });

  it("parses multi-word city without commas", () => {
    const components = extractAddressComponents("15 Alamo Plaza San Antonio TX 78205");
    expect(components).toEqual({
      addressLine: "15 Alamo Plaza",
      cityStateZip: "San Antonio, TX 78205",
    });
  });

  it("fetches valuation using search and property endpoints", async () => {
    const zillowRequestSpy = vi.spyOn(zillowClient, "zillowRequest");

    zillowRequestSpy
      .mockResolvedValueOnce({
        props: [
          {
            zpid: "123456",
            address: "123 Main St, Columbus, OH 43215",
            price: 410000,
          },
        ],
      })
      .mockResolvedValueOnce({
        zpid: "123456",
        price: 405123,
        currency: "usd",
        details: {
          valuationDate: "2025-05-10T00:00:00Z",
        },
        taxHistory: [
          {
            time: new Date("2024-01-01T00:00:00Z").getTime(),
            value: 400000,
            taxPaid: 10000,
            taxIncreaseRate: 0.05,
            valueIncreaseRate: 0.03,
          },
          {
            time: new Date("2023-01-01T00:00:00Z").getTime(),
            value: 380000,
            taxPaid: 9500,
            taxIncreaseRate: 0.02,
            valueIncreaseRate: 0.01,
          },
        ],
        countyFIPS: "39049",
        livingArea: 2100,
        bedrooms: 4,
        bathroomsFloat: 2.5,
        pricePerSquareFoot: 200,
        zestimateHighPercent: "15",
      });

    const valuation = await lookupZillowValuation("123 Main St, Columbus, OH 43215");

    expect(zillowRequestSpy).toHaveBeenCalledWith(
      "/propertyExtendedSearch",
      { location: "123 Main St Columbus, OH 43215" },
      expect.objectContaining({}),
    );
    expect(zillowRequestSpy).toHaveBeenCalledWith(
      "/property",
      { zpid: "123456", details: true },
      expect.objectContaining({}),
    );

    expect(valuation).toMatchObject({
      provider: "zillow",
      zpid: "123456",
      amount: 405123,
      currency: "USD",
    });
    expect(valuation?.valuationDate?.toISOString()).toBe("2025-05-10T00:00:00.000Z");
    expect(valuation?.analytics?.countyFips).toBe("39049");
    expect(valuation?.analytics?.taxHistory).toHaveLength(2);
    expect(valuation?.analytics?.taxHistory?.[0]?.year).toBe(2024);
    expect(valuation?.analytics?.averageEffectiveTaxRate).toBeCloseTo(0.025, 6);
    expect(valuation?.analytics?.projectedTaxAtMarket).toBe(10128);
    expect(valuation?.analytics?.projectedSavingsVsLatest).toBe(-128);
    expect(valuation?.analytics?.propertyFacts.livingArea).toBe(2100);
    expect(valuation?.analytics?.valuationRange?.highEstimate).toBe(465891);
  });

  it("uses cached valuation on subsequent lookups", async () => {
    const zillowRequestSpy = vi.spyOn(zillowClient, "zillowRequest");

    zillowRequestSpy.mockResolvedValueOnce({
      props: [
        {
          zpid: "999",
          address: "10 Sample Rd, Austin, TX 73301",
          zestimate: 512340,
        },
      ],
    });
    zillowRequestSpy.mockResolvedValueOnce({
      zpid: "999",
      zestimate: 512340,
      currency: "USD",
    });

    const first = await lookupZillowValuation("10 Sample Rd, Austin, TX 73301", { useCache: true });
    const second = await lookupZillowValuation("10 Sample Rd, Austin, TX 73301", {
      useCache: true,
    });

    expect(first?.amount).toBe(512340);
    expect(second).toBe(first);
    expect(first?.analytics).not.toBeNull();
    expect(zillowRequestSpy).toHaveBeenCalledTimes(2);
  });

  it("returns valuation when property details are missing", async () => {
    const zillowRequestSpy = vi.spyOn(zillowClient, "zillowRequest");

    zillowRequestSpy.mockResolvedValueOnce({
      props: [
        {
          zpid: "777",
          address: "200 Test Ave, Chicago, IL 60601",
          price: "600,000",
        },
      ],
    });
    zillowRequestSpy.mockResolvedValueOnce({
      zpid: "777",
      price: "600,000",
      currency: "USD",
    });

    const valuation = await lookupZillowValuation("200 Test Ave, Chicago, IL 60601");

    expect(valuation).toMatchObject({
      provider: "zillow",
      zpid: "777",
      amount: 600000,
    });
    expect(valuation?.analytics?.taxHistory).toEqual([]);
  });

  it("handles direct object responses from extended search", async () => {
    const zillowRequestSpy = vi.spyOn(zillowClient, "zillowRequest");

    zillowRequestSpy.mockResolvedValueOnce({
      zpid: 33998887,
      address: "1290 London Dr, Columbus, OH 43221",
      zestimate: 650000,
    });

    zillowRequestSpy.mockResolvedValueOnce({
      zpid: "33998887",
      zestimate: 652000,
      currency: "USD",
    });

    const valuation = await lookupZillowValuation("1290 London Dr, Columbus, OH 43221");

    expect(zillowRequestSpy).toHaveBeenNthCalledWith(
      1,
      "/propertyExtendedSearch",
      { location: "1290 London Dr Columbus, OH 43221" },
      expect.objectContaining({}),
    );
    expect(zillowRequestSpy).toHaveBeenNthCalledWith(
      2,
      "/property",
      { zpid: "33998887", details: true },
      expect.objectContaining({}),
    );

    expect(valuation).toMatchObject({
      provider: "zillow",
      zpid: "33998887",
      amount: 652000,
    });
    expect(valuation?.analytics).not.toBeNull();
  });
});
