const { test, expect } = require("@playwright/test");

/**
 * Заголовок результату. Формат єдиний для всіх тестів — «Ти — X», де X береться
 * з `results[ключ].title`. Якщо поле назване інакше, падіння немає: заголовок
 * мовчки стає «Ти — undefined». Саме так і сталося в тесті «past» (#7),
 * тому перевіряємо всі тести, а не лише той, на який поскаржилися.
 */

const TEST_COUNT = 4;

/** Проходить відкритий тест до кінця. Між питаннями app.js тримає блокування ~320мс. */
async function answerAll(page) {
  const total = Number((await page.locator("#q-index").textContent()).match(/з (\d+)/)[1]);
  for (let i = 0; i < total; i++) {
    await expect(page.locator("#q-index")).toContainText(`Питання ${i + 1} з ${total}`);
    // Картка питання зʼявляється з анімацією: клік по ще рухомій кнопці нестабільний.
    await page.locator(".option").first().click({ trial: false, timeout: 10_000 });
  }
  await expect(page.locator("#screen-result")).toBeVisible();
}

for (let i = 0; i < TEST_COUNT; i++) {
  test(`заголовок результату не «undefined» — тест №${i + 1}`, async ({ page }) => {
    await page.goto("/");
    const card = page.locator(".test-card").nth(i);
    const name = (await card.locator("h3").textContent()).trim();

    await card.click();
    await answerAll(page);

    const title = (await page.locator("#result-title").textContent()).trim();
    expect(title, `тест «${name}»`).not.toContain("undefined");
    expect(title, `тест «${name}»`).toMatch(/^Ти — \S/);
  });
}
