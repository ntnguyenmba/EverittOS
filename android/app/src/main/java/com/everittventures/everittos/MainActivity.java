package com.everittventures.everittos;

import android.os.Bundle;

import com.everittventures.everittos.billing.EverittBillingPlugin;
import com.everittventures.everittos.field.EverittFieldStorePlugin;
import com.everittventures.everittos.security.EverittBiometricPlugin;
import com.everittventures.everittos.security.EverittSecureStorePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EverittBillingPlugin.class);
        registerPlugin(EverittFieldStorePlugin.class);
        registerPlugin(EverittSecureStorePlugin.class);
        registerPlugin(EverittBiometricPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
