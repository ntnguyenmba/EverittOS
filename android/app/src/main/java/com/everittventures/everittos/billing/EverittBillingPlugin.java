package com.everittventures.everittos.billing;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@CapacitorPlugin(name = "EverittBilling")
public class EverittBillingPlugin extends Plugin {
    private PlayBillingManager billingManager;
    private PluginCall pendingPurchaseCall;
    private Consumer<PlayBillingModels.PurchasePayload> purchaseListener;

    private static final String[] DEFAULT_PRODUCT_IDS = new String[] {
            "everittos_pro",
            "everittos_business"
    };

    @Override
    public void load() {
        billingManager = new PlayBillingManager(getContext());
        purchaseListener = payload -> {
            PluginCall call = pendingPurchaseCall;
            pendingPurchaseCall = null;
            if (call == null) return;
            JSObject result = new JSObject();
            result.put("productId", payload.productId);
            result.put("purchaseToken", payload.purchaseToken);
            result.put("pending", payload.pending);
            result.put("cancelled", payload.cancelled);
            call.resolve(result);
        };
        billingManager.addPurchaseListener(purchaseListener);
    }

    @Override
    protected void handleOnDestroy() {
        if (billingManager != null && purchaseListener != null) {
            billingManager.removePurchaseListener(purchaseListener);
        }
        if (pendingPurchaseCall != null) {
            pendingPurchaseCall.reject("Purchase interrupted because the app closed.");
            pendingPurchaseCall = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void loadProducts(PluginCall call) {
        List<String> productIds = readProductIds(call);
        billingManager.queryProducts(productIds, products -> {
            JSArray array = new JSArray();
            for (Map<String, Object> product : products) {
                JSObject row = new JSObject();
                row.put("productId", String.valueOf(product.get("productId")));
                row.put("title", String.valueOf(product.get("title")));
                row.put("description", String.valueOf(product.get("description")));
                row.put("price", String.valueOf(product.get("price")));
                row.put("billingPeriod", String.valueOf(product.get("billingPeriod")));
                array.put(row);
            }
            JSObject result = new JSObject();
            result.put("products", array);
            call.resolve(result);
        }, call::reject);
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId", "");
        if (productId == null || productId.isEmpty()) {
            call.reject("productId is required");
            return;
        }
        if (pendingPurchaseCall != null) {
            call.reject("Another purchase is already in progress.");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        pendingPurchaseCall = call;
        billingManager.launchPurchase(activity, productId, error -> {
            PluginCall currentCall = pendingPurchaseCall;
            pendingPurchaseCall = null;
            if (currentCall != null) currentCall.reject(error);
        });
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        billingManager.queryExistingPurchases(purchases -> {
            JSArray array = new JSArray();
            for (PlayBillingModels.PurchasePayload purchase : purchases) {
                JSObject row = new JSObject();
                row.put("productId", purchase.productId);
                row.put("purchaseToken", purchase.purchaseToken);
                row.put("pending", purchase.pending);
                row.put("cancelled", purchase.cancelled);
                array.put(row);
            }
            JSObject result = new JSObject();
            result.put("purchases", array);
            call.resolve(result);
        }, call::reject);
    }

    @PluginMethod
    public void manageSubscriptions(PluginCall call) {
        String packageName = getContext().getPackageName();
        String url = "https://play.google.com/store/account/subscriptions?package=" + packageName;
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (ActivityNotFoundException error) {
            call.reject("Google Play subscription management is unavailable on this device.");
        }
    }

    @PluginMethod
    public void getProductIds(PluginCall call) {
        JSArray array = new JSArray();
        for (String id : DEFAULT_PRODUCT_IDS) {
            array.put(id);
        }
        JSObject result = new JSObject();
        result.put("productIds", array);
        call.resolve(result);
    }

    private List<String> readProductIds(PluginCall call) {
        List<String> ids = new ArrayList<>();
        JSArray array = call.getArray("productIds");
        if (array != null) {
            for (int i = 0; i < array.length(); i++) {
                try {
                    ids.add(array.getString(i));
                } catch (Exception ignored) {
                    // skip
                }
            }
        }
        if (ids.isEmpty()) {
            for (String id : DEFAULT_PRODUCT_IDS) {
                ids.add(id);
            }
        }
        return ids;
    }
}
