package com.assoumstudios.weddinghalltycoon;

import android.app.Activity;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Ads (AdMob rewarded + interstitial, with Google's consent message for Europe/UK) and Google Play purchases.
 * The game (JavaScript) talks to this class through window.NativeBridge, and gets answers through
 * window.__nativeEvent({...}).
 */
public class Monetization {
    private static final String TAG = "WHT-Money";
    // AdMob ad units for Wedding Hall Tycoon (the app ID is in AndroidManifest.xml).
    static final String REWARDED_ID = "ca-app-pub-9264992960554966/1052936526";
    static final String INTERSTITIAL_ID = "ca-app-pub-9264992960554966/6825631245";
    // Google Play products (create these in Play Console > Monetize > Products > In-app products).
    static final String[] CONSUMABLES = { "cash_small", "cash_medium", "cash_large" };
    static final String[] ONE_TIME = { "remove_ads", "starter_bundle", "luxury_decor_pack", "owner_style_pack" };

    private final Activity act; private final WebView web;
    private ConsentInformation consent; private final AtomicBoolean adsStarted = new AtomicBoolean(false);
    private RewardedAd rewarded; private InterstitialAd interstitial; private boolean loadingRewarded, loadingInterstitial;
    private BillingClient billing; private final Map<String, ProductDetails> products = new HashMap<>();

    Monetization(Activity act, WebView web) { this.act = act; this.web = web; }

    void start() {
        // 1) Consent (GDPR) first, then ads.
        try {
            consent = UserMessagingPlatform.getConsentInformation(act);
            ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
            consent.requestConsentInfoUpdate(act, params,
                    () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(act, err -> { if (consent.canRequestAds()) startAds(); }),
                    err -> { Log.w(TAG, "consent: " + err.getMessage()); startAds(); });
            if (consent.canRequestAds()) startAds();
        } catch (Throwable t) { Log.w(TAG, "consent failed", t); startAds(); }
        // 2) Purchases.
        startBilling();
    }

    // ---------------- Ads ----------------
    private void startAds() {
        if (!adsStarted.compareAndSet(false, true)) return;
        new Thread(() -> {
            try { MobileAds.initialize(act, status -> act.runOnUiThread(() -> { loadRewarded(); loadInterstitial(); })); }
            catch (Throwable t) { Log.w(TAG, "ads init failed", t); }
        }).start();
    }
    private void loadRewarded() {
        if (rewarded != null || loadingRewarded) return; loadingRewarded = true;
        RewardedAd.load(act, REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull RewardedAd ad) { rewarded = ad; loadingRewarded = false; send("{\"type\":\"adReady\",\"kind\":\"rewarded\"}"); }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { rewarded = null; loadingRewarded = false; retry(Monetization.this::loadRewarded); }
        });
    }
    private void loadInterstitial() {
        if (interstitial != null || loadingInterstitial) return; loadingInterstitial = true;
        InterstitialAd.load(act, INTERSTITIAL_ID, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull InterstitialAd ad) { interstitial = ad; loadingInterstitial = false; }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { interstitial = null; loadingInterstitial = false; retry(Monetization.this::loadInterstitial); }
        });
    }
    private void retry(Runnable r) { web.postDelayed(r, 60_000); }

    private void showRewardedNow(String tag) {
        RewardedAd ad = rewarded;
        if (ad == null) { send(evt("reward", tag, false)); loadRewarded(); return; }
        rewarded = null; final boolean[] earned = { false };
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() { send(evt("reward", tag, earned[0])); loadRewarded(); }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) { send(evt("reward", tag, false)); loadRewarded(); }
        });
        ad.show(act, item -> earned[0] = true);
    }
    private void showInterstitialNow() {
        InterstitialAd ad = interstitial; if (ad == null) { loadInterstitial(); return; }
        interstitial = null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() { loadInterstitial(); send("{\"type\":\"interstitialDone\"}"); }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) { loadInterstitial(); }
        });
        ad.show(act);
    }

    // ---------------- Purchases ----------------
    private void startBilling() {
        try {
            billing = BillingClient.newBuilder(act)
                    .setListener((result, purchases) -> {
                        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) for (Purchase p : purchases) handlePurchase(p, true);
                        else if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) send("{\"type\":\"purchaseCancelled\"}");
                        else send("{\"type\":\"purchaseFailed\",\"code\":" + result.getResponseCode() + "}");
                    })
                    .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                    .build();
            connectBilling();
        } catch (Throwable t) { Log.w(TAG, "billing init failed", t); }
    }
    private void connectBilling() {
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult r) {
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                queryProducts(); restore();
            }
            @Override public void onBillingServiceDisconnected() { web.postDelayed(Monetization.this::connectBilling, 15_000); }
        });
    }
    private void queryProducts() {
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        for (String id : CONSUMABLES) list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        for (String id : ONE_TIME) list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (r, result) -> {
            try {
                JSONArray arr = new JSONArray();
                for (ProductDetails d : result.getProductDetailsList()) {
                    products.put(d.getProductId(), d);
                    ProductDetails.OneTimePurchaseOfferDetails o = d.getOneTimePurchaseOfferDetails();
                    JSONObject j = new JSONObject(); j.put("id", d.getProductId()); j.put("price", o != null ? o.getFormattedPrice() : ""); arr.put(j);
                }
                send("{\"type\":\"products\",\"list\":" + arr + "}");
            } catch (Throwable t) { Log.w(TAG, "products", t); }
        });
    }
    private void restore() {
        if (billing == null || !billing.isReady()) return;
        billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (r, purchases) -> {
            JSONArray owned = new JSONArray();
            for (Purchase p : purchases) {
                if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                boolean consumable = isConsumable(p);
                if (consumable) handlePurchase(p, true); // a cash pack that was never consumed: grant it now
                else { for (String id : p.getProducts()) owned.put(id); if (!p.isAcknowledged()) acknowledge(p); }
            }
            send("{\"type\":\"owned\",\"list\":" + owned + "}");
        });
    }
    private boolean isConsumable(Purchase p) { for (String id : p.getProducts()) for (String c : CONSUMABLES) if (c.equals(id)) return true; return false; }
    private void handlePurchase(Purchase p, boolean isNew) {
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) { send("{\"type\":\"purchasePending\"}"); return; }
        if (isConsumable(p)) {
            billing.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), (r, token) -> {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) for (String id : p.getProducts()) send(purchaseEvt(id, p.getOrderId()));
            });
        } else {
            if (!p.isAcknowledged()) acknowledge(p);
            for (String id : p.getProducts()) send(purchaseEvt(id, p.getOrderId()));
        }
    }
    private void acknowledge(Purchase p) { billing.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), r -> {}); }

    // ---------------- Bridge to the game ----------------
    private void send(String json) { act.runOnUiThread(() -> web.evaluateJavascript("window.__nativeEvent && window.__nativeEvent(" + json + ")", null)); }
    private static String evt(String type, String tag, boolean ok) { return "{\"type\":\"" + type + "\",\"tag\":" + JSONObject.quote(tag) + ",\"ok\":" + ok + "}"; }
    private static String purchaseEvt(String id, String order) { return "{\"type\":\"purchase\",\"id\":" + JSONObject.quote(id) + ",\"order\":" + JSONObject.quote(order == null ? "" : order) + "}"; }

    @JavascriptInterface public boolean isNative() { return true; }
    @JavascriptInterface public boolean rewardedReady() { return rewarded != null; }
    @JavascriptInterface public void showRewarded(String tag) { act.runOnUiThread(() -> showRewardedNow(tag)); }
    @JavascriptInterface public void showInterstitial() { act.runOnUiThread(this::showInterstitialNow); }
    @JavascriptInterface public void buy(String id) {
        act.runOnUiThread(() -> {
            ProductDetails d = products.get(id);
            if (billing == null || !billing.isReady() || d == null) { send("{\"type\":\"purchaseFailed\",\"code\":-100}"); if (billing != null && billing.isReady()) queryProducts(); return; }
            List<BillingFlowParams.ProductDetailsParams> l = new ArrayList<>();
            l.add(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build());
            billing.launchBillingFlow(act, BillingFlowParams.newBuilder().setProductDetailsParamsList(l).build());
        });
    }
    @JavascriptInterface public void restorePurchases() { act.runOnUiThread(this::restore); }
    @JavascriptInterface public boolean privacyOptionsRequired() { return consent != null && consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED; }
    @JavascriptInterface public void showPrivacyOptions() { act.runOnUiThread(() -> UserMessagingPlatform.showPrivacyOptionsForm(act, err -> {})); }

    void onResume() { if (billing != null && billing.isReady()) restore(); }
}
