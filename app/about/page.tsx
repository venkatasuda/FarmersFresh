import { InfoPage } from "@/app/(shop)/info-layout";

export const metadata = { title: "About · Farmers Fresh" };

export default function AboutPage() {
  return (
    <InfoPage title="About Farmers Fresh">
      <p>
        Farmers Fresh started with a simple idea: sell only what we&apos;d serve
        our own family. We raise our meat, keep our own birds, and grow produce
        on our farms — then bring it to your door the same day it&apos;s ready.
      </p>

      <h2>Our own, not resold</h2>
      <p>
        Almost everything we sell carries our name because we made it. Meat and
        eggs come from our farms. Rice, dal and flour are milled and packed at
        our own unit. Spices are ground in small batches. Pickles and snacks are
        made in our kitchen. No repacking of someone else&apos;s stock.
      </p>

      <h2>Fresh, honestly</h2>
      <p>
        Meat is cut the morning it goes out — never frozen and sold as fresh.
        Cuts are weighed at packing, so you pay for exactly what you receive. If
        something isn&apos;t right, you can check it at the door before you pay.
      </p>

      <h2>Where we are</h2>
      <p>
        We&apos;re based in Telangana and delivering across a growing set of
        neighbourhoods. If we don&apos;t reach you yet, we likely will soon.
      </p>
    </InfoPage>
  );
}
