package org.durnible.app

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebViewClient

class MainActivity : BridgeActivity() {

    private lateinit var webViewHistoryBackCallback: OnBackPressedCallback
    private lateinit var createDocumentLauncher: ActivityResultLauncher<CreateDocumentRequest>
    private var fileSaveBridge: FileSaveBridge? = null

    private fun hasPreviousHistoryEntry(webView: WebView) = webView.copyBackForwardList().currentIndex > 0

    private fun checkIsFileSaveBridgeSupported() =
        WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
            WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        createDocumentLauncher = registerForActivityResult(CreateDocumentContract()) { createdUri ->
            fileSaveBridge?.onDocumentCreated(createdUri)
        }

        val bridge = this.bridge ?: return
        val webView = bridge.webView

        webViewHistoryBackCallback = object : OnBackPressedCallback(false) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("history.back()", null)
            }
        }
        onBackPressedDispatcher.addCallback(this, webViewHistoryBackCallback)

        if (checkIsFileSaveBridgeSupported()) {
            val saveBridge = FileSaveBridge(this) { request -> createDocumentLauncher.launch(request) }
            fileSaveBridge = saveBridge
            WebViewCompat.addWebMessageListener(
                webView,
                FILE_SAVE_BRIDGE_OBJECT_NAME,
                bridge.allowedOriginRules,
                saveBridge
            )
        }

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
