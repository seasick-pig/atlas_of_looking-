import { test, expect } from "@playwright/test";
test("homepage and all 13 dossiers render without JS errors or horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /观看，\s*是另一种\s*抵达/ }),
  ).toBeVisible();
  await expect(page.getByText("本地预览", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "全部档案", exact: true }).click();
  await expect(page.locator(".archive-card")).toHaveCount(13);
  await page.getByRole("textbox", { name: "搜索档案" }).fill("Google");
  await expect(page.locator(".archive-card")).toHaveCount(1);
  await page.locator(".archive-card").click();
  await expect(
    page.getByRole("heading", { name: "迈克尔·沃尔夫", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("研究整理稿 · 信息待核实", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".prose")).toContainText(
    "屏幕再摄影的像素、纹理和画质损失",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/reading-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("search, filtering, sorting and list layout work", async ({ page }) => {
  await page.goto("/#/artists");
  await expect(page.locator(".archive-card")).toHaveCount(13);
  await page.getByRole("button", { name: "摄影", exact: true }).click();
  await expect(page.locator(".archive-card")).toHaveCount(1);
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索档案" }).fill("NOT-AN-ARTIST");
  await expect(
    page.getByText("未找到匹配的档案。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page.locator(".archive-card")).toHaveCount(13);
  await page.getByRole("combobox", { name: "档案排序" }).selectOption("name");
  await page.getByRole("button", { name: "列表", exact: true }).click();
  await expect(page.locator(".archive-list>a")).toHaveCount(13);
});
test("works, research, notes, references and crosslinks retain honest content boundaries", async ({
  page,
}) => {
  await page.goto("/#/works");
  await expect(
    page.getByRole("heading", { name: /原稿中的作品线索/ }),
  ).toBeVisible();
  await expect(page.locator(".work-mentions>a")).toHaveCount(13);
  await page.goto("/#/research");
  await expect(page.locator(".topic-grid>a")).toHaveCount(25);
  await page.locator(".topic-grid>a").first().click();
  await expect(page.getByRole("heading", { name: /艺术家档案/ })).toBeVisible();
  await page.goto("/#/notes");
  await expect(page.getByText("这里等待第一份公开档案。")).toBeVisible();
  await page.goto("/#/references");
  await page.getByRole("textbox", { name: "搜索文献" }).fill("沃尔夫");
  await expect(page.locator(".bibliography>.source")).toHaveCount(1);
  await expect(page.locator(".bibliography")).toContainText(
    "https://photomichaelwolf.com/",
  );
  await page.goto("/#/connections");
  await expect(page.locator(".connection-list>div")).toHaveCount(4);
});
test("deep links, history, missing records, and read-only studio work", async ({
  page,
}) => {
  await page.goto("/#/archive/nam-june-paik");
  await expect(
    page.getByRole("heading", { name: "白南准", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "返回艺术家档案" }).click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "白南准", exact: true }),
  ).toBeVisible();
  await page.goto("/#/archive/missing");
  await expect(
    page.getByRole("heading", { name: "这一页尚未归档。" }),
  ).toBeVisible();
  await page.goto("/#/admin");
  await expect(page.getByText("当前为只读本地预览。")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "密码" })).toHaveCount(0);
});
test("mobile navigation and keyboard access", async ({ page }, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "打开导航" }).click();
    await page
      .getByRole("navigation", { name: "主导航" })
      .getByRole("link", { name: "艺术家 Artists" })
      .click();
    await expect(
      page.getByRole("heading", { name: /艺术家档案/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "打开导航" }),
    ).toHaveAttribute("aria-expanded", "false");
  }
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
