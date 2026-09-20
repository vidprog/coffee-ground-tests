const { test, expect } = require("@playwright/test");

/**
 * Критерії приймання з тікета #5 — світла тема й перемикач.
 * Кожен test() відповідає одному пункту специфікації.
 */

// Playwright за замовчуванням емулює світлу системну тему, і тоді сторінка
// законно стартує світлою. Для тестів про перемикання фіксуємо темний старт,
// щоб «перший клік» мав однозначний зміст. Системну світлу перевіряє окремий describe.
test.use({ colorScheme: "dark" });

const themeOf = (page) => page.evaluate(() => document.documentElement.dataset.theme);
const bodyBg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const toggle = (page) => page.locator("#theme-toggle");

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

/** Середній колір зір на canvas — щоб побачити, чи вони перефарбувалися. */
async function starTone(page) {
  return page.evaluate(() => {
    const c = document.querySelector("#stars");
    const ctx = c.getContext("2d");
    const { data } = ctx.getImageData(0, 0, c.width, Math.min(c.height, 800));
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 60) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    }
    return n ? [r / n, g / n, b / n] : null;
  });
}

test("у шапці є кнопка теми з українським aria-label", async ({ page }) => {
  await page.goto("/");
  await expect(toggle(page)).toBeVisible();
  await expect(toggle(page)).toHaveAttribute("aria-label", /тему$/);
});

test("клік перемикає data-theme і повертає назад", async ({ page }) => {
  await page.goto("/");
  expect(await themeOf(page)).toBe("dark");
  await toggle(page).click();
  expect(await themeOf(page)).toBe("light");
  await toggle(page).click();
  expect(await themeOf(page)).toBe("dark");
});

test("після кліку змінюється колір фону сторінки", async ({ page }) => {
  await page.goto("/");
  const before = await bodyBg(page);
  await toggle(page).click();
  expect(await bodyBg(page)).not.toBe(before);
});

test("вибір теми переживає перезавантаження", async ({ page }) => {
  await page.goto("/");
  await toggle(page).click();
  expect(await themeOf(page)).toBe("light");
  await page.reload();
  expect(await themeOf(page)).toBe("light");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light");
});

test.describe("системна світла тема", () => {
  test.use({ colorScheme: "light" });

  test("без збереженого вибору сторінка стартує світлою", async ({ page }) => {
    await page.goto("/");
    expect(await themeOf(page)).toBe("light");
  });
});

test("перемикач працює на всіх трьох екранах", async ({ page }) => {
  await page.goto("/");
  await toggle(page).click();
  expect(await themeOf(page)).toBe("light");

  await page.locator(".test-card").first().click();
  await expect(page.locator("#screen-quiz")).toBeVisible();
  await toggle(page).click();
  expect(await themeOf(page)).toBe("dark");

  for (let i = 0; i < 5; i++) {
    await page.waitForFunction(
      (n) => document.querySelector("#q-index")?.textContent.includes(`Питання ${n} з`), i + 1
    );
    await page.locator(".option").first().click();
  }
  await expect(page.locator("#screen-result")).toBeVisible();
  await toggle(page).click();
  expect(await themeOf(page)).toBe("light");
});

test.describe("вузький екран", () => {
  test.use({ viewport: { width: 360, height: 760 } });

  test("на 360px кнопка не перекриває заголовок і немає горизонтального скролу", async ({ page }) => {
    await page.goto("/");
    const btn = await toggle(page).boundingBox();
    const h1 = await page.locator("h1").boundingBox();
    expect(btn).not.toBeNull();
    // кнопка мусить закінчуватися вище, ніж починається заголовок
    expect(btn.y + btn.height).toBeLessThanOrEqual(h1.y);
    expect(btn.x + btn.width).toBeLessThanOrEqual(360);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });
});

test.describe("зменшена анімація", () => {
  test.use({ reducedMotion: "reduce" });

  test("перемикання без переходів, зорі беруть колір нової теми", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(400);

    const transition = await page.evaluate(
      () => getComputedStyle(document.querySelector(".test-card")).transitionDuration
    );
    expect(transition).toBe("0s");

    const darkStars = await starTone(page);
    expect(darkStars).not.toBeNull();

    await toggle(page).click();
    await page.waitForTimeout(400);
    const lightStars = await starTone(page);

    expect(luminance(darkStars)).toBeGreaterThan(luminance(lightStars));
  });
});

test("контраст основного тексту не нижчий за 4.5:1 в обох темах", async ({ page }) => {
  await page.goto("/");

  for (const expected of ["dark", "light"]) {
    if ((await themeOf(page)) !== expected) await toggle(page).click();
    const [ink, bg] = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return [s.color, s.backgroundColor];
    });
    expect(contrast(rgb(ink), rgb(bg)), `тема ${expected}`).toBeGreaterThanOrEqual(4.5);
  }
});
