package org.durnible.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.webkit.WebView
import androidx.activity.result.contract.ActivityResultContract
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONObject
import java.io.OutputStream
import java.util.concurrent.Executors

const val FILE_SAVE_BRIDGE_OBJECT_NAME = "durnibleFileSave"

private const val MAX_FILENAME_LENGTH = 200
private const val MAX_EXTENSION_LENGTH = 16

data class CreateDocumentRequest(val filename: String, val mimeType: String)

class CreateDocumentContract : ActivityResultContract<CreateDocumentRequest, Uri?>() {
    override fun createIntent(context: Context, input: CreateDocumentRequest): Intent =
        Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(input.mimeType)
            .putExtra(Intent.EXTRA_TITLE, input.filename)

    override fun parseResult(resultCode: Int, intent: Intent?): Uri? =
        if (resultCode == Activity.RESULT_OK) intent?.data else null
}

class FileSaveBridge(
    private val context: Context,
    private val launchCreateDocument: (CreateDocumentRequest) -> Unit
) : WebViewCompat.WebMessageListener {

    private val ioExecutor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    private var documentUri: Uri? = null
    private var outputStream: OutputStream? = null
    private var awaitingDocumentReply: JavaScriptReplyProxy? = null

    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy
    ) {
        if (!isMainFrame) return
        when (message.type) {
            WebMessageCompat.TYPE_ARRAY_BUFFER -> {
                val chunk = message.arrayBuffer
                replyFromIo(replyProxy) {
                    writeChunk(chunk)
                    acknowledgedMessage()
                }
            }

            WebMessageCompat.TYPE_STRING -> handleControlMessage(message.data, replyProxy)

            else -> replyOnMain(replyProxy, errorMessage("Unsupported file save message type"))
        }
    }

    private class SaveInProgressException : Exception("A file save is already in progress")

    private fun handleControlMessage(payload: String?, replyProxy: JavaScriptReplyProxy) {
        val control = JSONObject(payload ?: "{}")
        when (control.optString("type")) {
            "begin" -> beginSave(
                filename = control.getString("filename"),
                mimeType = control.getString("mimeType"),
                replyProxy = replyProxy
            )

            "finish" -> replyFromIo(replyProxy) {
                JSONObject(mapOf("type" to "done", "savedTo" to finishSave())).toString()
            }

            "abort" -> replyFromIo(replyProxy) {
                discardPendingSave()
                acknowledgedMessage()
            }

            else -> replyOnMain(replyProxy, errorMessage("Unknown file save command"))
        }
    }

    private fun beginSave(filename: String, mimeType: String, replyProxy: JavaScriptReplyProxy) {
        ioExecutor.execute {
            if (outputStream != null || awaitingDocumentReply != null) {
                replyOnMain(replyProxy, errorMessage(SaveInProgressException().message))
                return@execute
            }
            awaitingDocumentReply = replyProxy
            val request = CreateDocumentRequest(sanitizeFilename(filename), mimeType)
            mainHandler.post { launchCreateDocument(request) }
        }
    }

    fun onDocumentCreated(createdUri: Uri?) {
        ioExecutor.execute {
            val replyProxy = awaitingDocumentReply
            awaitingDocumentReply = null
            if (replyProxy == null) {
                createdUri?.let { deleteDocument(it) }
                return@execute
            }
            if (createdUri == null) {
                replyOnMain(replyProxy, JSONObject(mapOf("type" to "cancelled")).toString())
                return@execute
            }
            try {
                documentUri = createdUri
                outputStream = context.contentResolver.openOutputStream(createdUri)
                    ?: error("Could not open the chosen location for writing")
                replyOnMain(replyProxy, acknowledgedMessage())
            } catch (error: Throwable) {
                discardPendingSave()
                replyOnMain(
                    replyProxy,
                    errorMessage(error.message ?: "Could not open the chosen location")
                )
            }
        }
    }

    private fun replyFromIo(replyProxy: JavaScriptReplyProxy, work: () -> String) {
        ioExecutor.execute {
            val reply = try {
                work()
            } catch (error: SaveInProgressException) {
                errorMessage(error.message)
            } catch (error: Throwable) {
                discardPendingSave()
                errorMessage(error.message ?: "Saving the file failed")
            }
            replyOnMain(replyProxy, reply)
        }
    }

    private fun replyOnMain(replyProxy: JavaScriptReplyProxy, message: String) {
        mainHandler.post { replyProxy.postMessage(message) }
    }

    private fun writeChunk(chunk: ByteArray) {
        val stream = outputStream ?: error("No file save is in progress")
        stream.write(chunk)
    }

    private fun finishSave(): String {
        val savedUri = documentUri ?: error("No file save is in progress")
        outputStream?.flush()
        outputStream?.close()
        outputStream = null
        documentUri = null
        return readDisplayName(savedUri)
    }

    private fun discardPendingSave() {
        runCatching { outputStream?.close() }
        outputStream = null
        documentUri?.let { deleteDocument(it) }
        documentUri = null
        awaitingDocumentReply = null
    }

    private fun deleteDocument(target: Uri) {
        runCatching { DocumentsContract.deleteDocument(context.contentResolver, target) }
    }

    private fun readDisplayName(savedUri: Uri): String {
        val columns = arrayOf(OpenableColumns.DISPLAY_NAME)
        context.contentResolver.query(savedUri, columns, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) return cursor.getString(0)
        }
        return savedUri.lastPathSegment ?: "the chosen location"
    }

    private fun sanitizeFilename(filename: String): String {
        val leafName = filename.substringAfterLast('/').substringAfterLast('\\').trim()
        if (leafName.isEmpty() || leafName.all { it == '.' }) return "download"
        if (leafName.length <= MAX_FILENAME_LENGTH) return leafName
        val extension = leafName.substringAfterLast('.', "").take(MAX_EXTENSION_LENGTH)
        val suffix = if (extension.isEmpty()) "" else ".$extension"
        return leafName.take(MAX_FILENAME_LENGTH - suffix.length) + suffix
    }

    private fun acknowledgedMessage() = JSONObject(mapOf("type" to "acknowledged")).toString()

    private fun errorMessage(message: String?) =
        JSONObject(mapOf("type" to "error", "message" to (message ?: "Saving the file failed")))
            .toString()
}
