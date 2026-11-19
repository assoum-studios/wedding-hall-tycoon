# Google Play in-app products for Wedding Hall Tycoon 2.0.0

Create these in Play Console → Monetize with Play → Products → In-app products → Create product.
Use the Product ID exactly as written (it cannot be changed later). Set each product to Active.

| Product ID | Name | Description | Price (USD) |
|---|---|---|---|
| remove_ads | Remove Ads | No more ads between days. Bonus videos stay optional. | 0.99 |
| starter_bundle | Starter Bundle | No interstitial ads + $200,000 + the Luxury Decor Pack. | 1.99 |
| cash_small | $100,000 | $100,000 in-game money for your hall. | 0.99 |
| cash_medium | $200,000 | $200,000 in-game money for your hall. | 1.99 |
| cash_large | $1,000,000 | $1,000,000 in-game money for your hall. | 4.99 |
| luxury_decor_pack | Luxury Decor Pack | Royal chandelier, pearl tables, rose carpet, rose garden walls, pearl dance floor, fairytale stage and flower arches. | 0.99 |
| owner_style_pack | Owner Style Pack | 4 exclusive outfits and 3 dream cars for your owner. | 0.99 |

The cash packs are used up when bought, so they can be bought again. All the others are bought once and restored automatically.

AdMob (already inside the app):
- App ID: ca-app-pub-9264992960554966~7841706150 (android/app/src/main/AndroidManifest.xml)
- Rewarded: ca-app-pub-9264992960554966/1052936526 and Interstitial: ca-app-pub-9264992960554966/6825631245 (android/app/src/main/java/com/assoumstudios/weddinghalltycoon/Monetization.java)
