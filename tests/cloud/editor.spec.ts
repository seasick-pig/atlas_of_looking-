import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Archive } from "../../src/lib/model";
const seed: { records: Archive[] } = JSON.parse(
  readFileSync("data/archives.seed.json", "utf8"),
);

// Browser-to-API contract tests with mocked HTTP. Real RLS is tested separately;
// these tests don't claim a live Supabase project has been connected.
test("cloud editor creates drafts, publishes, exports, imports, and deletes", async ({
  page,
}) => {
  let records: typeof seed.records = [];
  let signedIn = false;
  const uid = "11111111-1111-4111-8111-111111111111";
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "admin@example.test",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: uid, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.browser-test-signature`;
  await page.route("https://atlas-test.supabase.co/**", async (route) => {
    const r = route.request(),
      url = new URL(r.url()),
      method = r.method();
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.pathname === "/auth/v1/token") {
      signedIn = true;
      return reply({
        access_token: token,
        refresh_token: "test-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    }
    if (url.pathname === "/auth/v1/user") return reply(user);
    if (url.pathname === "/auth/v1/logout") {
      signedIn = false;
      return reply({});
    }
    if (url.pathname === "/rest/v1/rpc/is_site_admin") return reply(signedIn);
    if (url.pathname === "/rest/v1/rpc/import_archives") {
      const body = r.postDataJSON();
      records.push(
        ...body.entries.map((a: (typeof seed.records)[number]) => ({
          ...a,
          status: "draft",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
      );
      return reply(body.entries.length);
    }
    if (url.pathname === "/rest/v1/archives") {
      if (method === "GET")
        return reply(
          signedIn ? records : records.filter((a) => a.status === "published"),
        );
      if (!signedIn) return reply({ message: "Not authorized" }, 403);
      const id = url.searchParams.get("id")?.replace("eq.", "");
      if (method === "POST") {
        records.push({
          ...r.postDataJSON(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        return reply(null, 201);
      }
      if (method === "PATCH") {
        const a = records.find((a) => a.id === id)!;
        Object.assign(a, r.postDataJSON(), {
          updated_at: new Date().toISOString(),
        });
        return reply([{ id }]);
      }
      if (method === "DELETE") {
        records = records.filter((a) => a.id !== id);
        return reply([{ id }]);
      }
    }
    return reply({ message: "Unexpected test API request" }, 400);
  });
  page.on("dialog", (d) => d.accept());
  await page.goto("/#/admin");
  await page.getByLabel("邮箱", { exact: true }).fill("admin@example.test");
  await page.getByLabel("密码", { exact: true }).fill("only-a-test-password");
  await page.getByRole("button", { name: "进入工作室" }).click();
  await page.getByRole("button", { name: "新建档案", exact: true }).click();
  await page.getByLabel("唯一 ID（创建后固定）").fill("new-research");
  await page.getByLabel("中文名／标题").fill("新的研究档案");
  await page
    .getByLabel("关键词（中英文逗号分隔）")
    .pressSequentially("image,history");
  await expect(page.getByLabel("关键词（中英文逗号分隔）")).toHaveValue(
    "image,history",
  );
  await page
    .getByLabel("研究正文", { exact: true })
    .fill("研究切入｜这是一份供后台交互验证的草稿。");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.locator(".admin-row")).toHaveCount(1);
  expect(records[0].status).toBe("draft");
  expect(records[0].tags).toEqual(["image", "history"]);
  await page.goto("/#/artists");
  await expect(page.locator(".archive-card")).toHaveCount(0);
  await page.goto("/#/admin");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("可见性").selectOption("published");
  await page.getByRole("button", { name: "保存并发布", exact: true }).click();
  await expect(page.locator(".admin-row .published")).toHaveCount(1);
  await page.goto("/#/artists");
  await expect(page.locator(".archive-card")).toHaveCount(1);
  await page.locator(".archive-card").click();
  await expect(page.locator(".prose")).toContainText("后台交互验证");
  await page.goto("/#/admin");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出全部 JSON" }).click();
  expect((await download).suggestedFilename()).toMatch(/^atlas-backup-/);
  await page.getByRole("button", { name: "批量导入", exact: true }).click();
  await page.getByLabel("选择 JSON 文件", { exact: true }).setInputFiles({
    name: "seed.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(seed)),
  });
  await expect(page.getByText("13 份有效档案", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "导入 13 份草稿" }).click();
  await expect(page.locator(".admin-row")).toHaveCount(14);
  expect(records.filter((a) => a.status === "draft")).toHaveLength(13);
  await page.getByLabel("筛选管理清单").fill("new-research");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.locator(".admin-row")).toHaveCount(0);
  expect(records).toHaveLength(13);
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page.getByRole("button", { name: "进入工作室" })).toBeVisible();
});

test("cloud failures never fall back to bundled drafts", async ({ page }) => {
  await page.route("https://atlas-test.supabase.co/**", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ message: "Access denied for test" }),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "档案暂时无法读取。" }),
  ).toBeVisible();
  await expect(page.locator(".archive-card")).toHaveCount(0);
  await expect(page.getByText("白南准", { exact: true })).toHaveCount(0);
  const response = await page.request.get("/demo-data.json");
  expect((await response.text()).includes("nam-june-paik")).toBe(false);
});
