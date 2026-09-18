import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test('public shop renders without browser errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto('/');expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toBeVisible();expect(errors).toEqual([]);
});
test('anonymous staff access redirects to login',async({page})=>{
  await page.goto('/dashboard');await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('input[type="password"]')).toBeVisible();
});
test('staff login has no serious WCAG accessibility violations',async({page})=>{
  await page.goto('/login');const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(results.violations.filter(v=>['critical','serious'].includes(v.impact ?? ''))).toEqual([]);
});
test('security headers are present on rendered response',async({request})=>{
  const response=await request.get('/login');expect(response.status()).toBe(200);
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['x-frame-options']).toBe('SAMEORIGIN');
});
test('live payment API rejects a forged callback',async({request})=>{
  const response=await request.post('/api/razorpay/verify',{data:{orderId:'ci-forged',razorpay_order_id:'ci-rp',razorpay_payment_id:'ci-pay',razorpay_signature:'fake'}});
  expect(response.status()).toBe(400);
});
test('live webhook rejects a forged signature',async({request})=>{
  const response=await request.post('/api/razorpay/webhook',{data:{event:'payment.captured'},headers:{'x-razorpay-signature':'fake'}});
  expect(response.status()).toBe(400);
});
test('responsive cart has no horizontal overflow',async({page})=>{
  await page.goto('/cart');await expect(page.getByRole('main')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
