package com.xiaoxuhui.gamehub

import android.webkit.CookieManager
import android.webkit.WebView

/** Cookie parent-domain scoping cannot isolate sibling games. These offline games use Web Storage. */
internal object WebViewCookiePolicy {
    fun disable() { CookieManager.getInstance().setAcceptCookie(false) }
    fun configure(view: WebView) {
        disable()
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false)
    }
}
