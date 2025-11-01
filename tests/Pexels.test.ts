process.env.LOG_LEVEL = "debug";

import nock from "nock";
import path from "path";
import fs from "fs-extra";
import { test, assert, expect, afterEach } from "vitest";
import { OrientationEnum } from "../src/types/shorts";
import { PexelsAPI } from "../src/short-creator/libraries/Pexels";

afterEach(() => {
  nock.cleanAll();
});

test("test pexels", async () => {
  const mockResponse = fs.readFileSync(
    path.resolve("__mocks__/pexels-response.json"),
    "utf-8",
  );
  nock("https://api.pexels.com")
    .get(/videos\/search/)
    .reply(200, mockResponse);
  const pexels = new PexelsAPI("asdf");
  const video = await pexels.findVideo(["dog"], 2.4, []);
  console.log(video);
  assert.isObject(video, "Video should be an object");
});

test("should time out", async () => {
  const pexels = new PexelsAPI("asdf");
  nock("https://api.pexels.com")
    .get(/videos\/search/)
    .delay(1000)
    .times(30)
    .reply(200, {});

  await expect(
    pexels.findVideo(["dog"], 2.4, [], OrientationEnum.portrait, 100),
  ).rejects.toThrow(
    expect.objectContaining({
      name: "TimeoutError",
    }),
  );
});

test("should retry 3 times", async () => {
  // First two attempts will timeout (100ms timeout with delay)
  nock("https://api.pexels.com")
    .get(/videos\/search/)
    .delay(200) // Delay longer than the timeout we'll pass (100ms)
    .times(2)
    .reply(200, {});

  // Third attempt succeeds
  const mockResponse = fs.readFileSync(
    path.resolve("__mocks__/pexels-response.json"),
    "utf-8",
  );
  nock("https://api.pexels.com")
    .get(/videos\/search/)
    .reply(200, mockResponse);

  const pexels = new PexelsAPI("asdf");
  // Use 100ms timeout to trigger timeouts on delayed requests
  const video = await pexels.findVideo(
    ["dog"],
    2.4,
    [],
    OrientationEnum.portrait,
    100,
  );
  console.log(video);
  assert.isObject(video, "Video should be an object");
}, 10000); // Increase test timeout to 10 seconds
