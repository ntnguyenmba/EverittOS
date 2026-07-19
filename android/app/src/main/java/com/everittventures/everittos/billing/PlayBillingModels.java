package com.everittventures.everittos.billing;

import androidx.annotation.Nullable;

public final class PlayBillingModels {
    private PlayBillingModels() {}

    public static final class PurchasePayload {
        public final String productId;
        public final String purchaseToken;
        public final boolean pending;
        public final boolean cancelled;

        public PurchasePayload(String productId, @Nullable String purchaseToken, boolean pending, boolean cancelled) {
            this.productId = productId;
            this.purchaseToken = purchaseToken == null ? "" : purchaseToken;
            this.pending = pending;
            this.cancelled = cancelled;
        }
    }
}
