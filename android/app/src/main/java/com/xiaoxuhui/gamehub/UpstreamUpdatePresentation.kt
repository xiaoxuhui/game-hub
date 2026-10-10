package com.xiaoxuhui.gamehub

internal data class SourceVersionMessage(val text: String, val update: Boolean = false)

/** Publication hints never grant download or activation authority. */
internal object UpstreamUpdatePresentation {
    fun describe(check: UpstreamCheck?, actualVersion: String?, localKnown: Boolean,
                 catalogVersion: String?, catalogIssue: String?, eligible: Boolean,
                 readyVersion: String?, readyFresh: Boolean): SourceVersionMessage {
        if (check == null) return SourceVersionMessage("源仓库尚未检查")
        val publication = check.publication
        check.issue?.let { issue ->
            return SourceVersionMessage("源检查：$issue" + (publication?.let { "；上次源发布 v${it.version}（待检查）" } ?: ""))
        }
        if (publication == null || check.checkedAt == null) return SourceVersionMessage("未获得有效源发布，待检查")
        val latest = publication.version
        if (!localKnown) return SourceVersionMessage("源正式发布 v$latest；本地实际版本未核验")
        for (version in listOfNotNull(actualVersion, catalogVersion, readyVersion)) {
            if (runCatching { UpstreamReleasePolicy.compare(version, version) }.isFailure)
                return SourceVersionMessage("源正式发布 v$latest；本地或资源版本格式待核验")
        }
        val issue = catalogIssue?.let { "；资源：$it" } ?: ""
        if (actualVersion == null) return SourceVersionMessage("源正式发布 v$latest；尚未安装" +
            if (readyVersion != null) "；资源 v$readyVersion " + if (readyFresh) "待生效" else "已过期，待检查" else issue)
        val comparison = UpstreamReleasePolicy.compare(latest, actualVersion)
        if (comparison <= 0) return SourceVersionMessage("源正式发布 v$latest；已安装 v$actualVersion（已核对发布）$issue")
        val prefix = "源正式发布 v$latest；已安装 v$actualVersion"
        if (readyVersion != null && UpstreamReleasePolicy.compare(readyVersion, latest) >= 0) {
            if (catalogIssue != null) return SourceVersionMessage("$prefix$issue；候选尚未生效", true)
            return SourceVersionMessage(prefix + if (readyFresh) "；新资源待生效" else "；候选已过期，待检查", true)
        }
        if (catalogVersion != null && UpstreamReleasePolicy.compare(catalogVersion, latest) >= 0) {
            return SourceVersionMessage(prefix + when {
                catalogIssue != null -> issue
                eligible -> "；签名资源可更新"
                else -> "；资源暂不可安装，请查看游戏状态"
            }, true)
        }
        return SourceVersionMessage("$prefix；资源包待制作$issue", true)
    }
}
