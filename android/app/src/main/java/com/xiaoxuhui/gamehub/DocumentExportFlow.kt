package com.xiaoxuhui.gamehub

import android.app.Application
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.lifecycle.AndroidViewModel
import java.util.concurrent.Executors

/** Retains an accepted request across rotation, never retaining an Activity. */
internal class DocumentExportFlow(app: Application) : AndroidViewModel(app) {
    private val tasks = ExportTaskState()
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var listener: (() -> Unit)? = null
    private var result: String? = null
    val pending get() = tasks.pending()
    val busy get() = tasks.busy()
    fun attach(listener: () -> Unit) { this.listener = listener; listener() }
    fun detach() { listener = null }
    fun consumeResult(): String? = result.also { result = null }
    fun offer(export: DocumentExport) = tasks.offer(export)
    fun cancelled() { if (tasks.cancel()) { result = "已取消保存"; listener?.invoke() } }
    fun finish(uri: Uri?) {
        if (tasks.writing()) return
        if (uri == null) { cancelled(); return }
        val export = tasks.selected()
        if (export == null) {
            result = "保存请求已失效，请回到游戏后重试"
            listener?.invoke()
            return
        }
        worker.execute {
            val outcome = runCatching {
                getApplication<Application>().contentResolver.openOutputStream(uri, "wt")?.use {
                    it.write(export.content.toByteArray(Charsets.UTF_8))
                    it.flush()
                } ?: error("无法写入所选文件")
            }
            main.post {
                if (tasks.finished(export)) {
                    result = outcome.fold({ "已保存 ${export.name}" }, { "保存失败：${it.message ?: "未知错误"}" })
                    listener?.invoke()
                }
            }
        }
    }
    override fun onCleared() {
        listener = null
        worker.shutdown()
        super.onCleared()
    }
}
