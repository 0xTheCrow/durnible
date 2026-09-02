package org.durnible.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    private OnBackPressedCallback webViewHistoryBackCallback;

    private static boolean hasPreviousHistoryEntry(WebView webView) {
        return webView.copyBackForwardList().getCurrentIndex() > 0;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (bridge == null) {
            return;
        }

        WebView webView = bridge.getWebView();

        webViewHistoryBackCallback =
            new OnBackPressedCallback(false) {
                @Override
                public void handleOnBackPressed() {
                    webView.evaluateJavascript("history.back()", null);
                }
            };
        getOnBackPressedDispatcher().addCallback(this, webViewHistoryBackCallback);

        bridge.setWebViewClient(
            new BridgeWebViewClient(bridge) {
                @Override
                public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                    super.doUpdateVisitedHistory(view, url, isReload);
                    webViewHistoryBackCallback.setEnabled(hasPreviousHistoryEntry(view));
                }
            }
        );
    }
}
