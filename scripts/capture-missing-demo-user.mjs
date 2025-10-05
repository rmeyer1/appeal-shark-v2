import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";

async function main() {
  const browser = await chromium.launch({
    args: ["--no-sandbox"],
    chromiumSandbox: false,
  });
  const page = await browser.newPage();

  await page.goto(baseUrl, { waitUntil: "networkidle" });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles("tmp/dummy.pdf");

  await page.getByRole("button", { name: "Upload PDF" }).click();

  await page.getByText("Valid userId is required in form data.", { exact: true }).waitFor();

  await page.screenshot({ path: "tmp/invalid-demo-user.png", fullPage: true });

  await browser.close();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
