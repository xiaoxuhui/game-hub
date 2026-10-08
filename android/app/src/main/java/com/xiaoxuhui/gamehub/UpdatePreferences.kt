package com.xiaoxuhui.gamehub

import android.content.SharedPreferences

internal class UpdatePreferences(private val values: SharedPreferences) {
    fun backoff(): Map<String, Long> = listOf("apk", "resources").associateWith { values.getLong("backoff-$it", 0) }
    fun saveBackoff(channel: String, until: Long) {
        require(channel in setOf("apk", "resources"))
        check(values.edit().putLong("backoff-$channel", until).commit()) { "无法保存查询退避；本次仍暂停查询" }
    }
    fun automatic() = values.getBoolean("automatic", true)
    fun metered() = values.getBoolean("metered", false)
    fun settings(automatic: Boolean, metered: Boolean) = values.edit().putBoolean("automatic", automatic).putBoolean("metered", metered).commit()
}
