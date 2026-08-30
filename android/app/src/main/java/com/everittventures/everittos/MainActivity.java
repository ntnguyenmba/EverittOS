package com.everittventures.everittos;

import android.os.Bundle;

import com.everittventures.everittos.billing.EverittBillingPlugin;
import com.everittventures.everittos.field.EverittFieldStorePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EverittBillingPlugin.class);
        registerPlugin(EverittFieldStorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
