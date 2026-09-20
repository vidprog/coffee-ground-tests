const { test, expect } = require("@playwright/test");

/**
 * Критерії приймання з тікета #10 — правове застереження в підвалі.
 * Кожен test() відповідає одному пункту специфікації.
 *
 * Абзац живе в <footer>, а той лежить поза <main>, тому мусить бути видимим
 * на всіх трьох екранах — включно з тим, куди користувач потрапляє за прямим
 * посиланням і одразу йде в тест.
 */

// Як і в theme.spec.js: Playwright за замовчуванням емулює світлу системну тему,
// тож стартову тему фіксуємо явно, щоб перевірки кольору мали однозначний зміст.
test.use({ colorScheme: "dark" });

const legal = (page) => page.locator("footer .legal");

/** Відносна яскравість за WCAG. */
function luminance([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const rgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number);

/** Проходить перший тест до кінця. Між питаннями app.js блокує кліки на ~320мс. */
async function answerAll(page) {
  await page.locator(".test-card").first().click();
  const total = Number((await page.locator("#q-index").textContent()).match(/з (\d+)/)[1]);
  for (let i = 0; i < total; i++) {
    await expect(page.locator("#q-index")).toContainText(`Питання ${i + 1} з ${total}`);
    await page.locator(".option").first().click();
  }
  await expect(page.locator("#screen-result")).toBeVisible();
}

test("на головній у підвалі видно абзац застереження", async ({ page }) => {
  await page.goto("/");
  await expect(legal(page)).toBeVisible();
  await expect(legal(page)).toContainText("Сайт створено для розваги");
});

test("на екрані питань абзац лишається видимим", async ({ page }) => {
  await page.goto("/");
  await page.locator(".test-card").first().click();
  await expect(page.locator("#screen-quiz")).toBeVisible();
  await expect(legal(page)).toBeVisible();
});

test("на екрані результату абзац лишається видимим", async ({ page }) => {
  await page.goto("/");
  await answerAll(page);
  await expect(legal(page)).toBeVisible();
});

test("жартівливий рядок на головній не змінився", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#screen-home .disclaimer")).toContainText(
    "Приймати не більше 3 тестів на добу"
  );
});

test("колір тексту взято зі змінної --muted, а не захардкоджено", async ({ page }) => {
  await page.goto("/");
  const [actual, fromVar] = await page.evaluate(() => {
    const el = document.querySelector("footer .legal");
    // Підставляємо значення змінної в тимчасовий вузол, щоб порівнювати
    // обчислені rgb(), а не рядок «#a294c4» проти «rgb(162, 148, 196)».
    const probe = document.createElement("span");
    probe.style.color = "var(--muted)";
    document.body.appendChild(probe);
    const pair = [getComputedStyle(el).color, getComputedStyle(probe).color];
    probe.remove();
    return pair;
  });
  expect(actual).toBe(fromVar);
});

test("контраст абзацу не нижчий за 4.5:1 в обох темах", async ({ page }) => {
  await page.goto("/");

  for (const expected of ["dark", "light"]) {
    const current = await page.evaluate(() => document.documentElement.dataset.theme);
    if (current !== expected) await page.locator("#theme-toggle").click();

    const [ink, bg] = await page.evaluate(() => [
      getComputedStyle(document.querySelector("footer .legal")).color,
      getComputedStyle(document.body).backgroundColor
    ]);
    expect(contrast(rgb(ink), rgb(bg)), `тема ${expected}`).toBeGreaterThanOrEqual(4.5);
  }
});

test.describe("вузький екран", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("на 360px абзац не дає горизонтального скролу на жодному екрані", async ({ page }) => {
    const noOverflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );

    await page.goto("/");
    await expect(legal(page)).toBeVisible();
    expect(await noOverflow(), "головна").toBe(false);

    await page.locator(".test-card").first().click();
    await expect(page.locator("#screen-quiz")).toBeVisible();
    expect(await noOverflow(), "питання").toBe(false);

    await page.goto("/");
    await answerAll(page);
    expect(await noOverflow(), "результат").toBe(false);
  });
});
