const { test, expect } = require("@playwright/test");

/**
 * Тікет #9: за дефолтної паралельності Playwright сюїта випадково падає
 * по таймауту (найчастіше "element is not stable"). Причина — нескінченний
 * requestAnimationFrame зоряного неба (app.js:245-257), який крутиться
 * в кожному браузерному контексті й лінійно множить навантаження на CPU
 * разом з кількістю паралельних воркерів. app.js уже поважає
 * prefers-reduced-motion (app.js:272: `if (!still.matches) draw()`), тож
 * джерело проблеми — тестовий контекст, який цю умову не емулює.
 */
test("зоряне небо не крутить нескінченний rAF у тестовому середовищі", async ({ page }) => {
  await page.addInitScript(() => {
    window.__rafCalls = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      window.__rafCalls++;
      return orig(cb);
    };
  });

  await page.goto("/");
  await page.waitForTimeout(300);

  const calls = await page.evaluate(() => window.__rafCalls);
  expect(calls).toBe(0);
});
