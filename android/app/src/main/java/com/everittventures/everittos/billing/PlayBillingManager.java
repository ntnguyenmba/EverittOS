package com.everittventures.everittos.billing;

import android.app.Activity;
import android.content.Context;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

/**
 * Google Play Billing Library wrapper.
 * Acknowledgement of purchases is performed by the EverittOS backend after verification.
 * Pending purchases never unlock paid access on the client.
 */
public final class PlayBillingManager implements PurchasesUpdatedListener {
    private static final String MONTHLY_BASE_PLAN_ID = "monthly";

    public interface ProductInfo {
        String getProductId();
        String getTitle();
        String getDescription();
        String getPrice();
    }

    private final Context appContext;
    private BillingClient billingClient;
    private final Map<String, ProductDetails> productDetailsById = new HashMap<>();
    private final CopyOnWriteArrayList<Consumer<PlayBillingModels.PurchasePayload>> purchaseListeners =
            new CopyOnWriteArrayList<>();

    public PlayBillingManager(Context context) {
        this.appContext = context.getApplicationContext();
    }

    public void connect(Runnable onReady, Consumer<String> onError) {
        if (billingClient != null && billingClient.isReady()) {
            onReady.run();
            return;
        }

        billingClient = BillingClient.newBuilder(appContext)
                .setListener(this)
                .enablePendingPurchases(
                        PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
                )
                .build();

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    onReady.run();
                } else {
                    onError.accept(billingResult.getDebugMessage());
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Caller may reconnect on next request.
            }
        });
    }

    public void queryProducts(List<String> productIds, Consumer<List<Map<String, Object>>> onSuccess, Consumer<String> onError) {
        ensureReady(() -> {
            List<QueryProductDetailsParams.Product> products = new ArrayList<>();
            for (String id : productIds) {
                products.add(
                        QueryProductDetailsParams.Product.newBuilder()
                                .setProductId(id)
                                .setProductType(BillingClient.ProductType.SUBS)
                                .build()
                );
            }

            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(products)
                    .build();

            billingClient.queryProductDetailsAsync(params, (billingResult, queryResult) -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    onError.accept(billingResult.getDebugMessage());
                    return;
                }
                // Billing Library 9 returns QueryProductDetailsResult rather than a
                // directly iterable List<ProductDetails>.
                List<ProductDetails> productDetailsList = queryResult.getProductDetailsList();

                // Merge into the cache instead of clearing it. The billing screen loads
                // several plan cards in parallel, and clearing here made whichever query
                // completed last the only plan that could still be purchased.
                List<Map<String, Object>> mapped = new ArrayList<>();
                for (ProductDetails details : productDetailsList) {
                    productDetailsById.put(details.getProductId(), details);
                    String price = "";
                    ProductDetails.SubscriptionOfferDetails monthlyOffer = findMonthlyOffer(details);
                    if (monthlyOffer != null) {
                        List<ProductDetails.PricingPhase> phases =
                                monthlyOffer.getPricingPhases().getPricingPhaseList();
                        if (!phases.isEmpty()) {
                            price = phases.get(0).getFormattedPrice();
                        }
                    }
                    Map<String, Object> row = new HashMap<>();
                    row.put("productId", details.getProductId());
                    row.put("title", details.getTitle());
                    row.put("description", details.getDescription());
                    row.put("price", price);
                    row.put("billingPeriod", "monthly");
                    mapped.add(row);
                }
                onSuccess.accept(mapped);
            });
        }, onError);
    }

    public void launchPurchase(Activity activity, String productId, Consumer<String> onError) {
        ensureReady(() -> {
            ProductDetails details = productDetailsById.get(productId);
            if (details != null) {
                launchLoadedPurchase(activity, details, onError);
                return;
            }

            // A user can tap before the price-loading request finishes. Load the exact
            // subscription on demand instead of failing with "Product not loaded".
            queryProducts(
                    Collections.singletonList(productId),
                    ignored -> {
                        ProductDetails loaded = productDetailsById.get(productId);
                        if (loaded == null) {
                            onError.accept("Product unavailable");
                            return;
                        }
                        launchLoadedPurchase(activity, loaded, onError);
                    },
                    onError
            );
        }, onError);
    }

    private void launchLoadedPurchase(Activity activity, ProductDetails details, Consumer<String> onError) {
        ProductDetails.SubscriptionOfferDetails monthlyOffer = findMonthlyOffer(details);
        if (monthlyOffer == null) {
            onError.accept("Monthly base plan is unavailable");
            return;
        }

        BillingFlowParams.ProductDetailsParams productDetailsParams =
                BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(details)
                        .setOfferToken(monthlyOffer.getOfferToken())
                        .build();
        BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(productDetailsParams))
                .build();
        BillingResult result = billingClient.launchBillingFlow(activity, flowParams);
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            onError.accept(result.getDebugMessage());
        }
    }

    public void queryExistingPurchases(Consumer<List<PlayBillingModels.PurchasePayload>> onSuccess, Consumer<String> onError) {
        ensureReady(() -> {
            billingClient.queryPurchasesAsync(
                    QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                    (billingResult, purchases) -> {
                        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            onError.accept(billingResult.getDebugMessage());
                            return;
                        }
                        List<PlayBillingModels.PurchasePayload> mapped = new ArrayList<>();
                        for (Purchase purchase : purchases) {
                            String productId = purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0);
                            boolean pending = purchase.getPurchaseState() == Purchase.PurchaseState.PENDING;
                            mapped.add(new PlayBillingModels.PurchasePayload(
                                    productId,
                                    purchase.getPurchaseToken(),
                                    pending,
                                    false
                            ));
                        }
                        onSuccess.accept(mapped);
                    }
            );
        }, onError);
    }

    public void addPurchaseListener(Consumer<PlayBillingModels.PurchasePayload> listener) {
        purchaseListeners.add(listener);
    }

    public void removePurchaseListener(Consumer<PlayBillingModels.PurchasePayload> listener) {
        purchaseListeners.remove(listener);
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, @Nullable List<Purchase> purchases) {
        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            for (Consumer<PlayBillingModels.PurchasePayload> listener : purchaseListeners) {
                listener.accept(new PlayBillingModels.PurchasePayload("", "", false, true));
            }
            return;
        }
        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) {
            return;
        }
        for (Purchase purchase : purchases) {
            String productId = purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0);
            boolean pending = purchase.getPurchaseState() == Purchase.PurchaseState.PENDING;
            PlayBillingModels.PurchasePayload payload = new PlayBillingModels.PurchasePayload(
                    productId,
                    purchase.getPurchaseToken(),
                    pending,
                    false
            );
            for (Consumer<PlayBillingModels.PurchasePayload> listener : purchaseListeners) {
                listener.accept(payload);
            }
        }
    }

    @Nullable
    private ProductDetails.SubscriptionOfferDetails findMonthlyOffer(ProductDetails details) {
        List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;

        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            if (MONTHLY_BASE_PLAN_ID.equals(offer.getBasePlanId())) {
                return offer;
            }
        }
        return null;
    }

    private void ensureReady(Runnable ready, Consumer<String> onError) {
        connect(ready, onError);
    }
}
