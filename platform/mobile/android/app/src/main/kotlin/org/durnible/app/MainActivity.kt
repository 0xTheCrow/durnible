package org.durnible.app

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebViewClient

class MainActivity : BridgeActivity() {

    private lateinit var webViewHistoryBackCallback: OnBackPressedCallback

    private fun hasPreviousHistoryEntry(webView: WebView) = webView.copyBackForwardList().currentIndex > 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val bridge = this.bridge ?: return
        val webView = bridge.webView

        webViewHistoryBackCallback = object : OnBackPressedCallback(false) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("history.back()", null)
            }
        }
        onBackPressedDispatcher.addCallback(this, webViewHistoryBackCallback)

        bridge.setWebViewClient(
            object : BridgeWebViewClient(bridge) {
                override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
                    super.doUpdateVisitedHistory(view, url, isReload)
                    webViewHistoryBackCallback.isEnabled = hasPreviousHistoryEntry(view)
                }
            }
        )
    }
}
